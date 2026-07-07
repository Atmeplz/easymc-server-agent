/*
 * AI maintenance note: Keep all code comments in English.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Detect Minecraft server core type and version by reading the jar file.
 * Fallback: run `java -jar server.jar --version` or `version` and parse output.
 */
class CoreDetector {
  constructor(config) {
    this.config = config;
    this.serverDir = path.resolve(config.mc.serverDir);
    this.jarFile = config.mc.jarFile || 'server.jar';
    this._cache = null;
  }

  _jarPath() {
    return path.join(this.serverDir, this.jarFile);
  }

  async detect() {
    if (this._cache) return this._cache;

    const jarPath = this._jarPath();
    if (!fs.existsSync(jarPath)) {
      return { name: 'unknown', version: 'unknown', supportsMods: false, supportsPlugins: false };
    }

    let result = this._detectFromJar(jarPath);
    if (!result || result.name === 'unknown') {
      result = await this._detectFromConsole(jarPath);
    }

    this._cache = result;
    return result;
  }

  invalidateCache() {
    this._cache = null;
  }

  _detectFromJar(jarPath) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(jarPath);
      const entries = zip.getEntries();

      const manifestEntry = entries.find(e => e.entryName === 'META-INF/MANIFEST.MF');
      const versionJsonEntry = entries.find(e => e.entryName === 'version.json');
      const paperYmlEntry = entries.find(e => e.entryName === 'paper.yml');
      const paperGlobalYmlEntry = entries.find(e => e.entryName === 'config/paper-global.yml');
      const bukkitYmlEntry = entries.find(e => e.entryName === 'bukkit.yml');
      const fabricModJson = entries.find(e => e.entryName === 'fabric.mod.json');
      const forgeModToml = entries.find(e =>
        e.entryName.endsWith('/mods.toml') || e.entryName === 'META-INF/mods.toml'
      );

      let manifestText = '';
      if (manifestEntry) {
        manifestText = manifestEntry.getData().toString('utf-8');
      }

      let versionJson = null;
      if (versionJsonEntry) {
        try {
          versionJson = JSON.parse(versionJsonEntry.getData().toString('utf-8'));
        } catch {
          versionJson = null;
        }
      }

      const nameByJar = this._inferNameFromPath(jarPath);
      const manifestName = this._extractManifestName(manifestText);
      let name = nameByJar !== 'unknown' ? nameByJar : manifestName;
      let version = versionJson?.id || versionJson?.name || 'unknown';

      if (fabricModJson || manifestText.toLowerCase().includes('fabric')) {
        return { name: 'Fabric', version, supportsMods: true, supportsPlugins: false };
      }
      if (forgeModToml || manifestText.toLowerCase().includes('forge')) {
        return { name: 'Forge', version, supportsMods: true, supportsPlugins: false };
      }
      if (paperYmlEntry || paperGlobalYmlEntry || manifestText.toLowerCase().includes('paper')) {
        return { name: 'Paper', version, supportsMods: false, supportsPlugins: true };
      }
      if (manifestText.toLowerCase().includes('purpur') || jarPath.toLowerCase().includes('purpur')) {
        return { name: 'Purpur', version, supportsMods: false, supportsPlugins: true };
      }
      if (bukkitYmlEntry || manifestText.toLowerCase().includes('spigot') || manifestText.toLowerCase().includes('bukkit')) {
        return { name: name && name !== 'unknown' ? name : 'Spigot', version, supportsMods: false, supportsPlugins: true };
      }

      // Vanilla jar has version.json with id/name but no plugin/mod markers.
      if (versionJson && (versionJson.id || versionJson.name)) {
        return { name: 'Vanilla', version, supportsMods: false, supportsPlugins: false };
      }

      if (name === 'unknown') {
        return null;
      }

      return this._resultFromName(name, version);
    } catch (err) {
      console.warn('[CoreDetector] Failed to read jar:', err.message);
      return null;
    }
  }

  _extractManifestName(manifestText) {
    const lines = manifestText.split(/\r?\n/);
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('paper')) return 'Paper';
      if (lower.includes('purpur')) return 'Purpur';
      if (lower.includes('spigot')) return 'Spigot';
      if (lower.includes('bukkit')) return 'Bukkit';
      if (lower.includes('fabric')) return 'Fabric';
      if (lower.includes('forge')) return 'Forge';
      if (lower.includes('minecraft')) return 'Vanilla';
    }
    return 'unknown';
  }

  _inferNameFromPath(jarPath) {
    const lower = jarPath.toLowerCase();
    if (lower.includes('paper')) return 'Paper';
    if (lower.includes('purpur')) return 'Purpur';
    if (lower.includes('spigot')) return 'Spigot';
    if (lower.includes('bukkit')) return 'Bukkit';
    if (lower.includes('fabric')) return 'Fabric';
    if (lower.includes('forge')) return 'Forge';
    if (lower.includes('vanilla')) return 'Vanilla';
    return 'unknown';
  }

  _resultFromName(name, version) {
    const n = name.toLowerCase();
    const supportsMods = n === 'fabric' || n === 'forge';
    const supportsPlugins = ['paper', 'purpur', 'spigot', 'bukkit'].includes(n);
    return { name, version, supportsMods, supportsPlugins };
  }

  async _detectFromConsole(jarPath) {
    return new Promise((resolve) => {
      const javaPath = this.config.java?.javaPath || 'java';
      let output = '';
      let timeout = null;

      const args = ['-jar', jarPath, '--version'];
      const proc = spawn(javaPath, args, { cwd: this.serverDir, detached: false });

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });

      timeout = setTimeout(() => {
        try {
          proc.kill('SIGTERM');
        } catch {
          // ignore
        }
      }, 8000);

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve({ name: 'unknown', version: 'unknown', supportsMods: false, supportsPlugins: false });
      });

      proc.on('close', () => {
        clearTimeout(timeout);
        resolve(this._parseConsoleOutput(output));
      });
    });
  }

  _parseConsoleOutput(output) {
    const lower = output.toLowerCase();
    const nameByPath = this._inferNameFromPath(this._jarPath());
    let name = 'unknown';
    let version = 'unknown';

    if (lower.includes('paper')) name = 'Paper';
    else if (lower.includes('purpur')) name = 'Purpur';
    else if (lower.includes('spigot')) name = 'Spigot';
    else if (lower.includes('bukkit')) name = 'Bukkit';
    else if (lower.includes('fabric')) name = 'Fabric';
    else if (lower.includes('forge')) name = 'Forge';
    else if (lower.includes('vanilla') || output.includes('Minecraft')) name = 'Vanilla';
    else if (nameByPath !== 'unknown') name = nameByPath;

    const versionMatch = output.match(/(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)/);
    if (versionMatch) version = versionMatch[1];

    if (name === 'unknown') {
      return { name: 'unknown', version: 'unknown', supportsMods: false, supportsPlugins: false };
    }

    return this._resultFromName(name, version);
  }
}

module.exports = CoreDetector;
