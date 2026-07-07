/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Server Manager - manages the Minecraft server process.
 * Handles start, stop, status, and stdin communication.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ServerManager {
  constructor(config, javaManager, terminalManager) {
    this.config = config;
    this.javaManager = javaManager;
    this.terminalManager = terminalManager;
    this.process = null;
    this.status = 'stopped'; // stopped | starting | running | stopping
    this.statusListeners = [];
    this.serverDir = path.resolve(config.mc.serverDir);
    this.mcVersion = null;
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

    // Handle stdout.
    this.process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        this.terminalManager.addOutput(line);
        this.detectServerReady(line);
      }
    });

    // Handle stderr.
    this.process.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        this.terminalManager.addOutput(line);
      }
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
   * Detect when the server is ready.
   */
  detectServerReady(line) {
    if (this.status === 'starting') {
      if (line.includes('Done (') || line.includes('For help, type')) {
        this.setStatus('running');
        // Try to parse the Minecraft version from logs.
        const verMatch = line.match(/for Minecraft (\S+)/);
        if (verMatch) {
          this.mcVersion = verMatch[1];
        }
      }
    }
  }

  /**
   * Stop the Minecraft server gracefully.
   */
  async stop(timeout = 30000) {
    if (!this.process) {
      return;
    }

    this.setStatus('stopping');

    // Send the stop command.
    this.sendCommand('stop');

    // Wait for the process to exit.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Force kill after timeout.
        if (this.process) {
          this.terminalManager.addOutput('[EasyMC] 超时，强制关闭服务器');
          this.process.kill('SIGKILL');
        }
        reject(new Error('服务器停止超时'));
      }, timeout);

      const checkExit = setInterval(() => {
        if (!this.process) {
          clearTimeout(timer);
          clearInterval(checkExit);
          resolve();
        }
      }, 200);
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
    this.process.stdin.write(command + '\n');
    this.terminalManager.addOutput(`> ${command}`);
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

    // Fall back to system java.
    return 'java';
  }
}

module.exports = ServerManager;
