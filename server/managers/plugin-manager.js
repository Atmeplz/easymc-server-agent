/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Plugin Manager - install, enable, disable, and delete plugins.
 * Used for Bukkit, Paper, and Spigot servers.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class PluginManager {
  constructor(serverDir) {
    this.pluginsDir = path.join(serverDir, 'plugins');
  }

  /**
   * List all plugins, including disabled ones.
   */
  async listPlugins() {
    if (!fs.existsSync(this.pluginsDir)) return [];

    const files = fs.readdirSync(this.pluginsDir);
    const jars = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

    return Promise.all(jars.map(async (file) => {
      const stat = fs.statSync(path.join(this.pluginsDir, file));
      const disabled = file.endsWith('.jar.disabled');
      return {
        name: file.replace(/\.jar(\.disabled)?$/, ''),
        fileName: file,
        size: stat.size,
        lastModified: stat.mtime,
        enabled: !disabled,
        meta: await this.readPluginMeta(path.join(this.pluginsDir, file)),
      };
    }));
  }

  /**
   * Install a plugin from a URL.
   */
  async installFromUrl(url) {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }

    // Extract the file name from the URL.
    const urlPath = new URL(url).pathname;
    let fileName = path.basename(urlPath);
    if (!fileName.endsWith('.jar')) {
      fileName += '.jar';
    }

    const targetPath = path.join(this.pluginsDir, fileName);

    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 120000,
    });

    const writer = fs.createWriteStream(targetPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { success: true, fileName, path: targetPath };
  }

  /**
   * Enable or disable a plugin by renaming .jar and .jar.disabled files.
   */
  async togglePlugin(name, enabled) {
    const enabledPath = path.join(this.pluginsDir, `${name}.jar`);
    const disabledPath = path.join(this.pluginsDir, `${name}.jar.disabled`);

    if (enabled) {
      if (fs.existsSync(disabledPath)) {
        fs.renameSync(disabledPath, enabledPath);
        return { success: true, enabled: true };
      }
      return { success: false, error: '插件文件不存在' };
    } else {
      if (fs.existsSync(enabledPath)) {
        fs.renameSync(enabledPath, disabledPath);
        return { success: true, enabled: false };
      }
      return { success: false, error: '插件文件不存在' };
    }
  }

  /**
   * Delete a plugin by moving it to the .trash directory.
   */
  async removePlugin(name) {
    const trashDir = path.join(this.pluginsDir, '.trash');
    fs.mkdirSync(trashDir, { recursive: true });

    let removed = false;
    for (const ext of ['.jar', '.jar.disabled']) {
      const filePath = path.join(this.pluginsDir, `${name}${ext}`);
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, path.join(trashDir, `${name}${ext}`));
        removed = true;
      }
    }

    return removed
      ? { success: true }
      : { success: false, error: '插件文件不存在' };
  }

  /**
   * Read plugin.yml metadata.
   */
  async readPluginMeta(jarPath) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      const entry = zip.getEntry('plugin.yml');
      if (!entry) return null;
      const yaml = require('js-yaml');
      const content = zip.readAsText(entry);
      return yaml.load(content);
    } catch {
      return null;
    }
  }
}

module.exports = PluginManager;
