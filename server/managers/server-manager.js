/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Server Manager - manages the Minecraft server process.
 * Handles start, stop, status, and stdin communication.
 */
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const IngameMemoryStore = require('../agent/ingame-memory-store');

// Standard ANSI escape sequence regex.
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Server-ready log markers for common Minecraft server implementations.
const READY_MARKERS = ['Done (', 'For help, type', 'Loading complete!'];

class ServerManager {
  constructor(config, javaManager, terminalManager, pluginAutoDeployer = null) {
    this.config = config;
    this.javaManager = javaManager;
    this.terminalManager = terminalManager;
    this.pluginAutoDeployer = pluginAutoDeployer;
    this.process = null;
    this.status = 'stopped'; // stopped | starting | running | stopping
    this.statusListeners = [];
    this.serverDir = path.resolve(config.mc.serverDir);
    this.mcVersion = null;
    this.encoding = 'utf-8';
    this._stdoutReader = null;
    this._stderrReader = null;
  }

  /**
   * Start the Minecraft server.
   */
  async start() {
    if (this.process) {
      throw new Error('服务器已在运行中');
    }

    const jarPath = path.join(this.serverDir, this.config.mc.jarFile);
    if (!fs.existsSync(jarPath)) {
      throw new Error(`找不到服务端文件: ${jarPath}`);
    }

    // Resolve the Java path.
    const javaPath = await this.resolveJavaPath();

    this.setStatus('starting');

    // Deploy built-in plugins if the detected core supports them.
    if (this.pluginAutoDeployer) {
      try {
        await this.pluginAutoDeployer.deployIfSupported();
      } catch (error) {
        console.error('[ServerManager] Plugin auto-deploy failed:', error.message);
      }
    }

    // Archive stale ingame memory if the world appears to have been replaced.
    this.archiveMemoryIfWorldReplaced();

    const args = [
      ...this.config.mc.jvmArgs,
      '-jar', this.config.mc.jarFile,
      'nogui',
    ];

    console.log(`[ServerManager] 启动: ${javaPath} ${args.join(' ')}`);

    this.process = spawn(javaPath, args, {
      cwd: this.serverDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._setupTerminalStreams();

    // Clean up readline interfaces when the streams close.
    this._stdoutReader.on('close', () => {
      console.log('[ServerManager] stdout stream closed');
    });
    this._stderrReader.on('close', () => {
      console.log('[ServerManager] stderr stream closed');
    });

    // Handle process exit.
    this.process.on('exit', (code, signal) => {
      console.log(`[ServerManager] 进程退出: code=${code}, signal=${signal}`);
      this.terminalManager.addOutput(`[EasyMC] 服务器进程已退出 (code: ${code})`);
      this.process = null;
      this.setStatus('stopped');
    });

    // Handle process errors.
    this.process.on('error', (err) => {
      console.error(`[ServerManager] 进程错误:`, err.message);
      this.terminalManager.addOutput(`[EasyMC] 服务器错误: ${err.message}`);
      this.process = null;
      this.setStatus('stopped');
    });
  }

  /**
   * Set up terminal streams with the current encoding.
   * Pipes raw process stdout/stderr through iconv-lite decoder,
   * then through readline for line-by-line processing.
   */
  _setupTerminalStreams() {
    const normalizeLine = (raw) => raw.replace(ANSI_REGEX, '').replace(/\r$/, '');

    const stdoutDecoder = iconv.decodeStream(this.encoding);
    this.process.stdout.pipe(stdoutDecoder);
    this._stdoutReader = readline.createInterface({ input: stdoutDecoder });
    this._stdoutReader.on('line', (raw) => {
      const line = normalizeLine(raw);
      this.terminalManager.addOutput(line);
      this.detectServerReady(line);
    });

    const stderrDecoder = iconv.decodeStream(this.encoding);
    this.process.stderr.pipe(stderrDecoder);
    this._stderrReader = readline.createInterface({ input: stderrDecoder });
    this._stderrReader.on('line', (raw) => {
      const line = normalizeLine(raw);
      this.terminalManager.addOutput(line);
    });
  }

  /**
   * Change the terminal encoding dynamically.
   * Closes existing readline interfaces and recreates them with the new encoding.
   */
  setEncoding(encoding) {
    if (this.encoding === encoding || !this.process) return false;
    this.encoding = encoding;
    console.log(`[ServerManager] Terminal encoding changed to ${encoding}`);

    // Close existing readline interfaces.
    if (this._stdoutReader) this._stdoutReader.close();
    if (this._stderrReader) this._stderrReader.close();

    // Recreate with new encoding.
    this._setupTerminalStreams();
    return true;
  }

  /**
   * Detect when the server is ready.
   */
  detectServerReady(line) {
    if (this.status === 'starting') {
      if (READY_MARKERS.some(marker => line.includes(marker))) {
        this.setStatus('running');
        // Try to parse the Minecraft version from logs.
        const verMatch = line.match(/for Minecraft ([\d.]+[a-zA-Z0-9\-._]*)/);
        if (verMatch) {
          this.mcVersion = verMatch[1];
        }
      }
    }
  }

  /**
   * Archive ingame memory if the world folder appears to have been replaced.
   */
  archiveMemoryIfWorldReplaced() {
    try {
      const serverDir = this.serverDir;
      const ingameMemoryDir = this.config.agent?.ingameMemoryDir
        ? path.relative(serverDir, path.resolve(this.config.agent.ingameMemoryDir))
        : 'ingame_memory';
      const store = new IngameMemoryStore(serverDir, { ingameMemoryDir });
      store.ensureStructure();
      if (store.isWorldReplaced(this.config.mc?.worldName || 'world')) {
        const result = store.archiveOldMemory();
        if (result.skipped) {
          console.log('[ServerManager] World replaced but no player memory to archive.');
        } else {
          console.log(`[ServerManager] World replaced; archived ingame memory to ${result.archivedTo}`);
          this.terminalManager.addOutput(`[EasyMC] 检测到世界已更换，旧的游戏记忆已归档到 ${result.archivedTo}`);
        }
      }
    } catch (error) {
      console.error('[ServerManager] Failed to archive ingame memory:', error.message);
    }
  }

  /**
   * Stop the Minecraft server gracefully.
   *
   * Uses an event-driven approach: listens for the process 'exit' event
   * instead of polling with setInterval. This eliminates the 200ms delay
   * and the race condition where this.process could become null between
   * the check and the SIGKILL.
   */
  async stop(timeout = 30000) {
    if (!this.process) {
      return;
    }

    this.setStatus('stopping');

    // Capture the process reference — the exit handler in start() will
    // set this.process = null, but we still hold our local ref.
    const proc = this.process;

    // Send the stop command.
    this.sendCommand('stop');

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.terminalManager.addOutput('[EasyMC] 超时，强制关闭服务器');
          try {
            proc.kill('SIGKILL');
          } catch (_) {
            // Process may have already exited — ignore.
          }
          reject(new Error('服务器停止超时'));
        }
      }, timeout);

      const onExit = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      };

      // Listen for the exit event directly — no polling needed.
      proc.on('exit', onExit);
    });
  }

  /**
   * Restart the server.
   */
  async restart() {
    await this.stop();
    // Wait briefly so the port can be released.
    await new Promise(r => setTimeout(r, 2000));
    await this.start();
  }

  /**
   * Send a command to the server.
   */
  sendCommand(command) {
    if (!this.process || !this.process.stdin.writable) {
      return false;
    }
    // Prevent multi-command injection through embedded newlines.
    const safeCommand = String(command).replace(/[\r\n]/g, ' ');
    this.process.stdin.write(safeCommand + '\n');
    this.terminalManager.addOutput(`> ${safeCommand}`);
    return true;
  }

  /**
   * Get server status.
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get the Minecraft version.
   */
  getMcVersion() {
    return this.mcVersion;
  }

  /**
   * Set status and notify listeners.
   */
  setStatus(status) {
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * Register a status-change callback.
   */
  onStatusChange(callback) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== callback);
    };
  }

  /**
   * Resolve the Java path.
   */
  async resolveJavaPath() {
    // Use the configured Java path when provided.
    if (this.config.java?.customPath) {
      return this.config.java.customPath;
    }

    // Detect the Java version required by the Minecraft version.
    const mcVersion = this.config.mc?.version || '1.21.4';
    const javaInfo = this.javaManager.selectJavaForMcVersion(mcVersion);

    if (javaInfo) {
      return javaInfo.path;
    }

    // Fall back to system java, but only if it appears to be available.
    try {
      const { execFileSync } = require('child_process');
      execFileSync('java', ['-version'], { stdio: 'ignore' });
      return 'java';
    } catch (_) {
      throw new Error('未找到可用的 Java 运行时。请在设置中配置 Java 路径，或让 EasyMC 自动下载。');
    }
  }
}

module.exports = ServerManager;
