/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Plugin Auto Deployer - deploys built-in plugins when the server core
 * supports them (Bukkit / Spigot / Paper / Purpur).
 *
 * Built-in plugins live under .easymc/plugins/. When the detected core
 * supports plugins, they are copied into mc-server/plugins/. When it does
 * not, no copy is performed and existing plugin files in mc-server are left
 * untouched.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_BUILTIN_PLUGINS_DIR = path.join(process.cwd(), '.easymc', 'plugins');

class PluginAutoDeployer {
  /**
   * @param {string} serverDir - mc-server directory.
   * @param {object} coreDetector - CoreDetector instance.
   * @param {object} [options]
   * @param {string} [options.builtinPluginsDir] - Override built-in plugins source dir.
   */
  constructor(serverDir, coreDetector, options = {}) {
    this.serverDir = serverDir;
    this.coreDetector = coreDetector;
    this.builtinPluginsDir = options.builtinPluginsDir || DEFAULT_BUILTIN_PLUGINS_DIR;
    this.targetPluginsDir = path.join(serverDir, 'plugins');
  }

  /**
   * Detect the core and copy built-in plugins if supported.
   */
  async deployIfSupported() {
    const info = await this.coreDetector.detect();
    if (!info.supportsPlugins) {
      console.log('[PluginAutoDeployer] Core does not support plugins, skipping built-in plugin deployment.');
      return { deployed: false, reason: 'Core does not support plugins' };
    }

    if (!fs.existsSync(this.builtinPluginsDir)) {
      return { deployed: false, reason: 'No built-in plugins directory' };
    }

    fs.mkdirSync(this.targetPluginsDir, { recursive: true });

    const files = fs.readdirSync(this.builtinPluginsDir).filter(f => f.endsWith('.jar'));
    const copied = [];
    for (const file of files) {
      const source = path.join(this.builtinPluginsDir, file);
      const target = path.join(this.targetPluginsDir, file);
      fs.copyFileSync(source, target);
      copied.push(file);
    }

    if (copied.length) {
      console.log('[PluginAutoDeployer] Deployed built-in plugins:', copied.join(', '));
    }
    return { deployed: true, copied };
  }
}

module.exports = PluginAutoDeployer;
module.exports.DEFAULT_BUILTIN_PLUGINS_DIR = DEFAULT_BUILTIN_PLUGINS_DIR;
