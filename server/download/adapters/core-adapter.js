/*
 * AI maintenance note: Keep all code comments in English.
 */

const CORE_METADATA = {
  vanilla: {
    name: 'Vanilla',
    summary: 'Official Mojang server jar.',
    sourceName: 'Mojang',
    loaders: ['Vanilla'],
  },
  paper: {
    name: 'Paper',
    summary: 'High-performance Bukkit-compatible server core.',
    sourceName: 'PaperMC',
    loaders: ['Paper', 'Bukkit', 'Spigot'],
  },
  purpur: {
    name: 'Purpur',
    summary: 'Paper fork with additional configuration and gameplay options.',
    sourceName: 'Purpur',
    loaders: ['Purpur', 'Paper', 'Bukkit'],
  },
  fabric: {
    name: 'Fabric',
    summary: 'Lightweight mod loader server.',
    sourceName: 'Fabric',
    loaders: ['Fabric'],
  },
  forge: {
    name: 'Forge',
    summary: 'Classic Minecraft mod loader server.',
    sourceName: 'Forge',
    loaders: ['Forge'],
  },
};

class CoreAdapter {
  constructor(deployManager, cache) {
    this.id = 'core';
    this.name = 'Server Core';
    this.deployManager = deployManager;
    this.cache = cache;
  }

  get enabled() {
    return Boolean(this.deployManager);
  }

  sourceInfo() {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      supports: ['Server Core'],
      requiresKey: false,
    };
  }

  async search({ query = '', type = 'All' } = {}) {
    if (type !== 'All' && type !== 'Server Core') return [];
    const normalizedQuery = query.trim().toLowerCase();
    return Object.entries(CORE_METADATA)
      .filter(([id, meta]) => {
        if (!normalizedQuery) return true;
        return id.includes(normalizedQuery)
          || meta.name.toLowerCase().includes(normalizedQuery)
          || meta.summary.toLowerCase().includes(normalizedQuery);
      })
      .map(([id, meta]) => this.normalizeCore(id, meta));
  }

  async getProject(coreType) {
    const meta = CORE_METADATA[coreType];
    if (!meta) throw new Error(`Unsupported core type: ${coreType}`);
    return this.normalizeCore(coreType, meta);
  }

  async listFiles(coreType) {
    const meta = CORE_METADATA[coreType];
    if (!meta) throw new Error(`Unsupported core type: ${coreType}`);

    const versions = await this.cache.wrap(`core:versions:${coreType}`, () =>
      this.deployManager.getVersionList(coreType)
    );

    return (versions || []).slice(0, 40).map(version => {
      const versionId = typeof version === 'string' ? version : version.id;
      return {
        source: this.id,
        projectId: coreType,
        fileId: `${coreType}:${versionId}`,
        name: `${meta.name} ${versionId}`,
        versionName: versionId,
        versionNumber: versionId,
        gameVersions: [versionId],
        loaders: meta.loaders,
        releaseType: 'release',
        size: null,
        hashes: {},
        downloadUrl: null,
        dependencies: [],
        publishedAt: version.releaseTime || null,
        coreType,
        coreVersion: versionId,
      };
    });
  }

  async resolveFile({ projectId, fileId }) {
    const files = await this.listFiles(projectId);
    if (fileId) {
      const match = files.find(file => file.fileId === fileId || file.versionNumber === fileId);
      if (match) return match;
    }
    if (!files.length) throw new Error(`No versions were found for ${projectId}.`);
    return files[0];
  }

  normalizeCore(id, meta) {
    return {
      source: this.id,
      sourceName: meta.sourceName,
      sourceId: id,
      slug: id,
      type: 'Server Core',
      name: meta.name,
      summary: meta.summary,
      descriptionHtml: null,
      iconUrl: null,
      websiteUrl: null,
      downloads: null,
      follows: null,
      categories: meta.loaders,
      loaders: meta.loaders,
      gameVersions: [],
      license: null,
      updatedAt: null,
      status: 'Available',
    };
  }
}

module.exports = CoreAdapter;
