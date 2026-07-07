/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Source Registry - registry for server core download sources.
 * Provides a unified interface for Vanilla, Paper, Purpur, Fabric, and Forge downloads.
 */
const axios = require('axios');
const PaperScraper = require('./paper-scraper');
const ForgeParser = require('./forge-parser');

class SourceRegistry {
  constructor() {
    this.paperScraper = new PaperScraper();
    this.forgeParser = new ForgeParser();
  }

  /**
   * Get a download URL for a specific core type and version.
   */
  async getDownloadUrl(coreType, version) {
    switch (coreType) {
      case 'vanilla': return this.getVanillaUrl(version);
      case 'paper':   return this.getPaperUrl(version);
      case 'purpur':  return this.getPurpurUrl(version);
      case 'fabric':  return this.getFabricUrl(version);
      case 'forge':   return this.getForgeUrl(version);
      default: throw new Error(`不支持的核心类型: ${coreType}`);
    }
  }

  /**
   * Get version lists.
   */
  async getVersionList(coreType) {
    switch (coreType) {
      case 'vanilla': return this.getVanillaVersions();
      case 'paper':   return this.paperScraper.getAvailableVersions();
      case 'purpur':  return this.getPurpurVersions();
      case 'fabric':  return this.getFabricVersions();
      case 'forge':   return this.forgeParser.getAvailableMcVersions();
      default: return [];
    }
  }

  // Vanilla
  async getVanillaVersions() {
    try {
      const { data } = await axios.get(
        'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
        { timeout: 10000 }
      );
      return data.versions
        .filter(v => v.type === 'release')
        .map(v => ({ id: v.id, releaseTime: v.releaseTime }));
    } catch (err) {
      console.error('[SourceRegistry] Vanilla 版本列表获取失败:', err.message);
      return [];
    }
  }

  async getVanillaUrl(version) {
    const { data: manifest } = await axios.get(
      'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
      { timeout: 10000 }
    );
    const entry = manifest.versions.find(v => v.id === version);
    if (!entry) throw new Error(`版本 ${version} 不存在`);

    const { data: meta } = await axios.get(entry.url, { timeout: 10000 });
    const server = meta.downloads?.server;
    if (!server) throw new Error(`版本 ${version} 没有服务端下载`);

    return { url: server.url, sha1: server.sha1, size: server.size };
  }

  // Paper
  async getPaperUrl(version) {
    const buildInfo = await this.paperScraper.getLatestBuild(version);
    if (!buildInfo) return null;
    return {
      url: buildInfo.downloadUrl,
      build: buildInfo.buildNumber,
      sha256: buildInfo.sha256,
    };
  }

  // Purpur
  async getPurpurVersions() {
    try {
      const { data } = await axios.get('https://api.purpurmc.org/v2/purpur', { timeout: 10000 });
      return (data.versions || []).reverse();
    } catch (err) {
      console.error('[SourceRegistry] Purpur 版本列表获取失败:', err.message);
      return [];
    }
  }

  async getPurpurUrl(version) {
    const { data } = await axios.get(
      `https://api.purpurmc.org/v2/purpur/${version}`,
      { timeout: 10000 }
    );
    const latestBuild = data.builds?.latest;
    if (!latestBuild) throw new Error(`Purpur 没有版本 ${version} 的构建`);

    return {
      url: `https://api.purpurmc.org/v2/purpur/${version}/${latestBuild}/download`,
      build: latestBuild,
    };
  }

  // Fabric
  async getFabricVersions() {
    try {
      const { data } = await axios.get('https://meta.fabricmc.net/v2/versions/game', { timeout: 10000 });
      return data.filter(g => g.stable).map(g => ({ id: g.version }));
    } catch (err) {
      console.error('[SourceRegistry] Fabric 版本列表获取失败:', err.message);
      return [];
    }
  }

  async getFabricUrl(mcVersion) {
    const [loaders, installers] = await Promise.all([
      axios.get('https://meta.fabricmc.net/v2/versions/loader', { timeout: 10000 }),
      axios.get('https://meta.fabricmc.net/v2/versions/installer', { timeout: 10000 }),
    ]);

    const latestLoader = loaders.data.find(l => l.stable) || loaders.data[0];
    const latestInstaller = installers.data.find(i => i.stable) || installers.data[0];

    return {
      url: `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${latestLoader.version}/${latestInstaller.version}/server/jar`,
      loaderVersion: latestLoader.version,
      installerVersion: latestInstaller.version,
    };
  }

  // Forge
  async getForgeUrl(mcVersion) {
    const forgeVersion = await this.forgeParser.getLatestBuildForMc(mcVersion);
    if (!forgeVersion) throw new Error(`没有找到 MC ${mcVersion} 对应的 Forge 版本`);

    return {
      url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`,
      forgeVersion,
    };
  }
}

module.exports = SourceRegistry;
