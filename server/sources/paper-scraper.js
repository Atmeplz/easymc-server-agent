/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * PaperScraper - scrapes the PaperMC downloads page.
 * PaperMC API v2 is sunset, so this uses HTML scraping as a fallback.
 */
const axios = require('axios');
const cheerio = require('cheerio');

class PaperScraper {
  constructor() {
    this.downloadsUrl = 'https://papermc.io/downloads/paper';
    // Download URL pattern: https://fill-data.papermc.io/v1/objects/{sha256}/paper-{version}-{build}.jar
    this.downloadUrlPattern = /https:\/\/fill-data\.papermc\.io\/v1\/objects\/([a-f0-9]+)\/paper-([\d.]+)-(\d+)\.jar/;
  }

  /**
   * Get latest build information for a version.
   */
  async getLatestBuild(targetVersion) {
    try {
      const { data: html } = await axios.get(this.downloadsUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'EasyMC-Server-Agent/1.0' },
      });
      const $ = cheerio.load(html);

      const builds = [];
      $('a[href*="fill-data.papermc.io"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(this.downloadUrlPattern);
        if (match) {
          const [, sha256, version, buildNumber] = match;
          builds.push({
            version,
            buildNumber: parseInt(buildNumber),
            sha256,
            downloadUrl: href,
          });
        }
      });

      if (builds.length === 0) return null;

      // Specific version returns its latest build.
      if (targetVersion) {
        const filtered = builds
          .filter(b => b.version === targetVersion)
          .sort((a, b) => b.buildNumber - a.buildNumber);
        return filtered[0] || null;
      }

      // Use the latest build for each version.
      const latestByVer = {};
      for (const b of builds) {
        if (!latestByVer[b.version] || latestByVer[b.version].buildNumber < b.buildNumber) {
          latestByVer[b.version] = b;
        }
      }
      return Object.values(latestByVer).sort((a, b) => b.buildNumber - a.buildNumber);
    } catch (err) {
      console.error('[PaperScraper] 抓取失败:', err.message);
      return null;
    }
  }

  /**
   * Get available versions.
   */
  async getAvailableVersions() {
    const builds = await this.getLatestBuild();
    if (!builds || !Array.isArray(builds)) return [];
    return builds.map(b => b.version).sort().reverse();
  }
}

module.exports = PaperScraper;
