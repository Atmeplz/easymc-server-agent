/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Mod Manager - install, enable, disable, and delete mods.
 * Used for Forge and Fabric servers.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class ModManager {
  constructor(serverDir) {
    this.modsDir = path.join(serverDir, 'mods');
  }

  /**
   * List all mods, including disabled ones.
   */
  async listMods() {
    if (!fs.existsSync(this.modsDir)) return [];

    const files = fs.readdirSync(this.modsDir);
    const jars = files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));

    return Promise.all(jars.map(async (file) => {
      const stat = fs.statSync(path.join(this.modsDir, file));
      const disabled = file.endsWith('.jar.disabled');
      return {
        name: file.replace(/\.jar(\.disabled)?$/, ''),
        fileName: file,
        size: stat.size,
        lastModified: stat.mtime,
        enabled: !disabled,
        meta: await this.readModMeta(path.join(this.modsDir, file)),
      };
    }));
  }

  /**
   * Install a mod from a URL.
   */
  async installFromUrl(url) {
    if (!fs.existsSync(this.modsDir)) {
      fs.mkdirSync(this.modsDir, { recursive: true });
    }

    const urlPath = new URL(url).pathname;
    let fileName = path.basename(urlPath);
    if (!fileName.endsWith('.jar')) {
      fileName += '.jar';
    }

    const targetPath = path.join(this.modsDir, fileName);

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
   * Enable or disable a mod.
   */
  async toggleMod(name, enabled) {
    const enabledPath = path.join(this.modsDir, `${name}.jar`);
    const disabledPath = path.join(this.modsDir, `${name}.jar.disabled`);

    if (enabled) {
      if (fs.existsSync(disabledPath)) {
        fs.renameSync(disabledPath, enabledPath);
        return { success: true, enabled: true };
      }
      return { success: false, error: 'Mod 文件不存在' };
    } else {
      if (fs.existsSync(enabledPath)) {
        fs.renameSync(enabledPath, disabledPath);
        return { success: true, enabled: false };
      }
      return { success: false, error: 'Mod 文件不存在' };
    }
  }

  /**
   * Delete a mod.
   */
  async removeMod(name) {
    const trashDir = path.join(this.modsDir, '.trash');
    fs.mkdirSync(trashDir, { recursive: true });

    let removed = false;
    for (const ext of ['.jar', '.jar.disabled']) {
      const filePath = path.join(this.modsDir, `${name}${ext}`);
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, path.join(trashDir, `${name}${ext}`));
        removed = true;
      }
    }

    return removed
      ? { success: true }
      : { success: false, error: 'Mod 文件不存在' };
  }

  /**
   * Read mod metadata for Fabric or Forge.
   */
  async readModMeta(jarPath) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);

      // Fabric format.
      const fabricEntry = zip.getEntry('fabric.mod.json');
      if (fabricEntry) {
        return { type: 'fabric', ...JSON.parse(zip.readAsText(fabricEntry)) };
      }

      // Forge format.
      const forgeEntry = zip.getEntry('META-INF/mods.toml');
      if (forgeEntry) {
        try {
          const toml = require('toml');
          return { type: 'forge', ...toml.parse(zip.readAsText(forgeEntry)) };
        } catch {
          return { type: 'forge', raw: zip.readAsText(forgeEntry) };
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}

module.exports = ModManager;
