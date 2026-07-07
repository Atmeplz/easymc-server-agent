/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Deploy Manager - downloads and deploys server cores.
 * One-click deployment: Java check, mirror detection, core download, directories, EULA, first start.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const SourceRegistry = require('../sources/source-registry');
const MirrorDetector = require('../sources/mirror-detector');

class DeployManager extends EventEmitter {
  constructor(config, javaManager) {
    super();
    this.config = config;
    this.javaManager = javaManager;
    this.serverDir = path.resolve(config.mc.serverDir);
    this.sourceRegistry = new SourceRegistry();
    this.mirrorDetector = new MirrorDetector();
  }

  /**
   * Get supported core types.
   */
  getCoreTypes() {
    return [
      { id: 'vanilla', name: 'Vanilla 原版', desc: 'Mojang 官方原版服务端' },
      { id: 'paper', name: 'Paper', desc: '高性能 Paper 服务端（兼容 Spigot 插件）' },
      { id: 'purpur', name: 'Purpur', desc: 'Paper 的增强分支，更多配置选项' },
      { id: 'fabric', name: 'Fabric', desc: '轻量模组加载器' },
      { id: 'forge', name: 'Forge', desc: '老牌模组加载器，生态最大' },
    ];
  }

  /**
   * Get versions for a core type.
   */
  async getVersionList(coreType) {
    return this.sourceRegistry.getVersionList(coreType);
  }

  /**
   * Run the full one-click deployment flow.
   */
  async deploy({ coreType, version, jvmArgs }) {
    const steps = [];

    try {
      // Step 1: check or download Java.
      this.emit('deploy:step', { step: 'java', message: '检查 Java 环境...' });
      const requiredJava = this.javaManager.getRequiredJavaVersion(version);
      let javaInfo = this.javaManager.selectJavaForMcVersion(version);

      if (!javaInfo) {
        this.emit('deploy:step', { step: 'java_download', message: `需要 Java ${requiredJava}，开始下载...` });
        javaInfo = await this.javaManager.downloadJre(requiredJava, (progress) => {
          this.emit('deploy:java_progress', progress);
        });
        this.emit('deploy:step', { step: 'java', message: `Java ${requiredJava} 已就绪` });
      } else {
        this.emit('deploy:step', { step: 'java', message: `Java ${javaInfo.majorVersion} 已就绪` });
      }
      steps.push({ name: 'java', result: javaInfo });

      // Step 2: resolve the download URL.
      this.emit('deploy:step', { step: 'resolve', message: `获取 ${coreType} ${version} 下载链接...` });
      const downloadInfo = await this.sourceRegistry.getDownloadUrl(coreType, version);

      if (!downloadInfo) {
        // Fallback when Paper HTML scraping fails.
        if (coreType === 'paper') {
          return {
            success: false,
            error: 'paper_scrape_failed',
            message: '无法自动获取 Paper 下载链接。请手动下载 Paper jar 放入 mc-server/ 目录，或改用 Purpur（兼容 Paper 插件）。',
          };
        }
        throw new Error('无法获取下载链接');
      }
      steps.push({ name: 'resolve', result: downloadInfo });

      // Step 3: download the server core jar.
      this.emit('deploy:step', { step: 'download', message: '下载服务端文件...' });
      const jarPath = await this.downloadCore(downloadInfo, (progress) => {
        this.emit('deploy:progress', progress);
      });
      this.emit('deploy:step', { step: 'download', message: '下载完成' });
      steps.push({ name: 'download', result: jarPath });

      // Step 4: create the directory structure.
      this.emit('deploy:step', { step: 'setup', message: '创建服务器目录...' });
      this.setupDirectory();
      steps.push({ name: 'setup' });

      // Step 5: prewrite eula.txt.
      this.emit('deploy:step', { step: 'eula', message: '接受 EULA...' });
      this.writeEula();
      steps.push({ name: 'eula' });

      // Step 6: update the configured Minecraft version.
      this.config.mc.version = version;
      this.config.mc.coreType = coreType;

      const result = {
        success: true,
        serverDir: this.serverDir,
        coreType,
        version,
        jarPath,
        javaPath: javaInfo.path,
        javaVersion: javaInfo.majorVersion,
      };

      this.emit('deploy:complete', result);
      return result;

    } catch (err) {
      this.emit('deploy:error', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Download the server core jar.
   */
  async downloadCore(downloadInfo, onProgress) {
    const jarPath = path.join(this.serverDir, this.config.mc.jarFile);

    // Ensure the directory exists.
    fs.mkdirSync(this.serverDir, { recursive: true });

    const response = await axios({
      method: 'GET',
      url: downloadInfo.url,
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 300000,
    });

    const total = parseInt(response.headers['content-length'] || 0);
    let downloaded = 0;

    const writer = fs.createWriteStream(jarPath);
    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (onProgress) {
        onProgress({
          downloaded,
          total,
          percent: total ? Math.round(downloaded / total * 100) : 0,
        });
      }
    });

    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Verify SHA1 when available.
    if (downloadInfo.sha1) {
      const actual = await this.calculateSha1(jarPath);
      if (actual !== downloadInfo.sha1) {
        throw new Error(`SHA1 校验失败: 期望 ${downloadInfo.sha1}, 实际 ${actual}`);
      }
    }

    return jarPath;
  }

  /**
   * Create server directories.
   */
  setupDirectory() {
    const dirs = ['plugins', 'mods', 'config', 'world', 'logs'];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(this.serverDir, dir), { recursive: true });
    }
  }

  /**
   * Prewrite eula.txt.
   */
  writeEula() {
    if (this.config.deploy?.autoAcceptEula !== false) {
      const eulaPath = path.join(this.serverDir, 'eula.txt');
      fs.writeFileSync(eulaPath, 'eula=true\n');
    }
  }

  /**
   * Calculate a file SHA1 hash.
   */
  async calculateSha1(filePath) {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    return new Promise((resolve, reject) => {
      stream.on('data', d => hash.update(d));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check whether the server has been deployed.
   */
  isDeployed() {
    const jarPath = path.join(this.serverDir, this.config.mc.jarFile);
    return fs.existsSync(jarPath);
  }
}

module.exports = DeployManager;
