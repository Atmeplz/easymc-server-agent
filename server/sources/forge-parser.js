/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * ForgeParser - parses Forge Maven metadata XML.
 * Forge has no standard REST API, so Maven metadata is used for version lists.
 */
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

class ForgeParser {
  constructor() {
    this.metadataUrl = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
    this.baseUrl = 'https://maven.minecraftforge.net/net/minecraftforge/forge';
    this.parser = new XMLParser();
    this._cache = null;
    this._cacheTime = 0;
  }

  /**
   * Get all Forge versions grouped by Minecraft version.
   */
  async getVersions() {
    // Cache for ten minutes.
    if (this._cache && Date.now() - this._cacheTime < 600000) {
      return this._cache;
    }

    try {
      const { data: xml } = await axios.get(this.metadataUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'EasyMC-Server-Agent/1.0' },
      });

      const parsed = this.parser.parse(xml);
      const versions = parsed?.metadata?.versioning?.versions?.version;
      const versionArray = Array.isArray(versions) ? versions : versions ? [versions] : [];

      // Version format: "1.20.1-47.4.5" or "1.21-51.0.33".
      const byMcVersion = {};
      for (const v of versionArray) {
        const mcMatch = v.match(/^([\d.]+?)-/);
        if (mcMatch) {
          const mcVer = mcMatch[1];
          if (!byMcVersion[mcVer]) byMcVersion[mcVer] = [];
          byMcVersion[mcVer].push(v);
        }
      }

      this._cache = byMcVersion;
      this._cacheTime = Date.now();
      return byMcVersion;
    } catch (err) {
      console.error('[ForgeParser] 解析失败:', err.message);
      return {};
    }
  }

  /**
   * Get the latest Forge build for a Minecraft version.
   */
  async getLatestBuildForMc(mcVersion) {
    const byMcVersion = await this.getVersions();
    const builds = byMcVersion[mcVersion];
    if (!builds || builds.length === 0) {
      return null;
    }
    // Use the last entry, which is the latest stable version.
    return builds[builds.length - 1];
  }

  /**
   * Get available Minecraft versions.
   */
  async getAvailableMcVersions() {
    const byMcVersion = await this.getVersions();
    return Object.keys(byMcVersion).sort().reverse();
  }
}

module.exports = ForgeParser;
