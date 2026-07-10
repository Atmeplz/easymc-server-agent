/*
 * AI maintenance note: Keep all code comments in English.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const DownloadCache = require('./download-cache');
const DownloadQueue = require('./download-queue');
const ModrinthAdapter = require('./adapters/modrinth-adapter');
const CoreAdapter = require('./adapters/core-adapter');

class DisabledAdapter {
  constructor(id, name, reason, supports = []) {
    this.id = id;
    this.name = name;
    this.reason = reason;
    this.supports = supports;
  }

  get enabled() {
    return false;
  }

  sourceInfo() {
    return {
      id: this.id,
      name: this.name,
      enabled: false,
      reason: this.reason,
      supports: this.supports,
    };
  }

  async search() {
    return [];
  }
}

class DownloadService {
  constructor({ config, modManager, pluginManager, deployManager }) {
    this.config = config;
    this.modManager = modManager;
    this.pluginManager = pluginManager;
    this.deployManager = deployManager;
    this.cache = new DownloadCache(config.download?.cacheTtlMs);
    this.queue = new DownloadQueue();
    this.adapters = new Map();

    this.register(new ModrinthAdapter(config.download || {}, this.cache));
    this.register(new CoreAdapter(deployManager, this.cache));
    this.register(new DisabledAdapter('curseforge', 'CurseForge', 'CurseForge API key is not configured.', ['Mods', 'Plugins']));
    this.register(new DisabledAdapter('hangar', 'Hangar', 'Hangar integration is not enabled in this build yet.', ['Plugins']));
    this.register(new DisabledAdapter('spiget', 'Spiget', 'Spigot browsing is planned as a best-effort source.', ['Plugins']));
  }

  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }

  sourceList() {
    return Array.from(this.adapters.values()).map(adapter => adapter.sourceInfo());
  }

  async search(filters = {}) {
    const requestedSource = this.normalizeSource(filters.source);
    const adapters = requestedSource
      ? [this.getAdapter(requestedSource)].filter(Boolean)
      : Array.from(this.adapters.values()).filter(adapter => adapter.enabled);

    const settled = await Promise.allSettled(
      adapters.map(adapter => adapter.search(filters).then(results => ({ adapter, results })))
    );

    const results = [];
    const errors = [];
    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        results.push(...entry.value.results);
      } else {
        errors.push(entry.reason?.message || String(entry.reason));
      }
    }

    return {
      results: results.slice(0, 80),
      errors,
      sources: this.sourceList(),
    };
  }

  async getProject(source, projectId) {
    const adapter = this.requireAdapter(source);
    return adapter.getProject(projectId);
  }

  async listFiles(source, projectId, filters = {}) {
    const adapter = this.requireAdapter(source);
    return adapter.listFiles(projectId, filters);
  }

  async install({ source, projectId, fileId, type, gameVersion, loader, confirmCoreInstall }) {
    const adapter = this.requireAdapter(source);
    const file = await adapter.resolveFile({ projectId, fileId, gameVersion, loader });
    const queueItem = this.queue.create({
      source,
      projectId,
      fileId: file.fileId,
      name: file.name,
      type,
      target: this.targetFor(type),
    });

    try {
      this.queue.update(queueItem.id, { status: 'running', progress: 5 });

      if (type === 'Server Core') {
        if (!confirmCoreInstall) {
          throw new Error('Core installation requires confirmCoreInstall=true.');
        }
        const result = await this.deployManager.deploy({
          coreType: file.coreType || projectId,
          version: file.coreVersion || file.versionNumber,
        });
        if (!result.success) throw new Error(result.message || result.error || 'Core deployment failed.');
        this.queue.complete(queueItem.id, { result });
        return { success: true, queueItem: this.queue.items.find(item => item.id === queueItem.id), result };
      }

      const result = await this.installJar(type, file, (progress) => {
        this.queue.update(queueItem.id, progress);
      });
      this.queue.complete(queueItem.id, { result });
      return { success: true, queueItem: this.queue.items.find(item => item.id === queueItem.id), result };
    } catch (err) {
      this.queue.fail(queueItem.id, err);
      return {
        success: false,
        error: err.message,
        queueItem: this.queue.items.find(item => item.id === queueItem.id),
      };
    }
  }

  async installJar(type, file, onProgress) {
    const manager = type === 'Plugins' ? this.pluginManager : this.modManager;
    if (!manager) throw new Error(`No manager is available for ${type}.`);

    const result = await this.downloadJarToManager(manager, file, onProgress);
    if (file.hashes?.sha1 && result.path) {
      const actual = await this.calculateHash(result.path, 'sha1');
      if (actual !== file.hashes.sha1) {
        fs.unlinkSync(result.path);
        throw new Error(`SHA1 verification failed for ${file.name}.`);
      }
    }
    return result;
  }

  async downloadJarToManager(manager, file, onProgress) {
    const targetDir = manager.pluginsDir || manager.modsDir;
    if (!targetDir) throw new Error('Unknown install target directory.');
    fs.mkdirSync(targetDir, { recursive: true });

    const safeName = this.safeFileName(file.name || path.basename(new URL(file.downloadUrl).pathname));
    if (!safeName.endsWith('.jar')) throw new Error('Only .jar downloads are supported.');

    const targetPath = path.join(targetDir, safeName);
    const partPath = `${targetPath}.part`;
    const response = await axios({
      method: 'GET',
      url: file.downloadUrl,
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 300000,
    });

    const total = Number(response.headers['content-length'] || file.size || 0);
    let downloaded = 0;
    const writer = fs.createWriteStream(partPath);

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      onProgress?.({
        downloaded,
        total,
        progress: total ? Math.max(5, Math.min(99, Math.round((downloaded / total) * 100))) : 50,
      });
    });

    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    if (fs.existsSync(targetPath)) {
      const backupPath = `${targetPath}.${Date.now()}.bak`;
      fs.renameSync(targetPath, backupPath);
    }
    try {
      fs.renameSync(partPath, targetPath);
    } catch (err) {
      try {
        fs.unlinkSync(partPath);
      } catch (_) {
        // Best-effort cleanup.
      }
      throw err;
    }

    return {
      success: true,
      fileName: safeName,
      path: targetPath,
      size: fs.statSync(targetPath).size,
    };
  }

  targetFor(type) {
    if (type === 'Plugins') return 'plugins/';
    if (type === 'Mods') return 'mods/';
    if (type === 'Server Core') return 'server.jar';
    return 'downloads/';
  }

  normalizeSource(source) {
    if (!source || source === 'All') return '';
    return String(source).toLowerCase();
  }

  getAdapter(source) {
    return this.adapters.get(this.normalizeSource(source));
  }

  requireAdapter(source) {
    const adapter = this.getAdapter(source);
    if (!adapter) throw new Error(`Unknown download source: ${source}`);
    if (!adapter.enabled) throw new Error(adapter.reason || `${adapter.name} is disabled.`);
    return adapter;
  }

  safeFileName(fileName) {
    return path.basename(String(fileName)).replace(/[<>:"/\\|?*]/g, '_');
  }

  calculateHash(filePath, algorithm) {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

module.exports = DownloadService;
