/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Mirror Detector - detects mirror availability.
 * Detects available download sources and chooses the fastest mirror.
 */
const axios = require('axios');

const SOURCES = [
  {
    name: 'Mojang 官方',
    url: 'https://piston-meta.mojang.com',
    type: 'vanilla',
    regions: ['global'],
  },
  {
    name: 'Purpur 官方',
    url: 'https://api.purpurmc.org',
    type: 'purpur',
    regions: ['global'],
  },
  {
    name: 'Fabric Meta',
    url: 'https://meta.fabricmc.net',
    type: 'fabric',
    regions: ['global'],
  },
  {
    name: 'Forge Maven',
    url: 'https://maven.minecraftforge.net',
    type: 'forge',
    regions: ['global'],
  },
  {
    name: 'BMCLAPI (bangbang93)',
    url: 'https://bmclapi2.bangbang93.com',
    type: 'mirror',
    mirrors: ['vanilla', 'forge', 'fabric'],
    regions: ['cn'],
  },
];

class MirrorDetector {
  constructor() {
    this.sources = SOURCES;
    this.cache = new Map(); // coreType -> [{ source, latency, available }]
  }

  /**
   * Detect available download sources for a core type.
   */
  async detectAvailableSources(coreType) {
    // Check the five-minute cache.
    const cached = this.cache.get(coreType);
    if (cached && cached.timestamp > Date.now() - 300000) {
      return cached.sources;
    }

    const candidates = this.sources.filter(
      s => s.type === coreType || (s.type === 'mirror' && s.mirrors?.includes(coreType))
    );

    const results = await Promise.allSettled(
      candidates.map(async (source) => {
        const start = Date.now();
        try {
          const res = await axios.get(`${source.url}/`, {
            timeout: 5000,
            headers: { 'User-Agent': 'EasyMC-Server-Agent/1.0' },
          });
          return {
            source,
            latency: Date.now() - start,
            available: res.status >= 200 && res.status < 400,
          };
        } catch {
          return { source, latency: Infinity, available: false };
        }
      })
    );

    const available = results
      .filter(r => r.status === 'fulfilled' && r.value.available)
      .map(r => r.value)
      .sort((a, b) => a.latency - b.latency);

    // Cache the result.
    this.cache.set(coreType, { sources: available, timestamp: Date.now() });

    return available;
  }

  /**
   * Get the best download source.
   */
  async getBestSource(coreType) {
    const sources = await this.detectAvailableSources(coreType);
    return sources[0] || null;
  }
}

module.exports = MirrorDetector;
