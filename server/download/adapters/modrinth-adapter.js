/*
 * AI maintenance note: Keep all code comments in English.
 */
const axios = require('axios');

const TYPE_MAP = {
  Mods: 'mod',
};

const PLUGIN_LOADERS = new Set(['bukkit', 'paper', 'spigot', 'folia', 'purpur', 'sponge', 'velocity', 'waterfall']);

class ModrinthAdapter {
  constructor(config = {}, cache) {
    this.id = 'modrinth';
    this.name = 'Modrinth';
    this.baseUrl = 'https://api.modrinth.com/v2';
    this.cache = cache;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent': config.userAgent || 'EasyMC_Server_Agent/1.0',
      },
    });
  }

  get enabled() {
    return true;
  }

  sourceInfo() {
    return {
      id: this.id,
      name: this.name,
      enabled: true,
      supports: ['Mods', 'Plugins'],
      requiresKey: false,
    };
  }

  async search({ query = '', type = 'All', gameVersion = '', loader = '' } = {}) {
    const projectType = TYPE_MAP[type];
    const facets = [];
    if (projectType) facets.push([`project_type:${projectType}`]);
    if (type === 'Plugins') {
      facets.push(Array.from(PLUGIN_LOADERS).map(loaderName => `categories:${loaderName}`));
    }
    if (gameVersion) facets.push([`versions:${gameVersion}`]);
    if (loader) facets.push([`categories:${loader.toLowerCase()}`]);

    const params = {
      query,
      limit: 20,
      index: 'relevance',
    };
    if (facets.length) params.facets = JSON.stringify(facets);

    const cacheKey = `modrinth:search:${JSON.stringify(params)}`;
    const data = await this.cache.wrap(cacheKey, async () => {
      const response = await this.client.get('/search', { params });
      return response.data;
    });

    return (data.hits || []).map(hit => this.normalizeSearchHit(hit));
  }

  async getProject(projectId) {
    const data = await this.cache.wrap(`modrinth:project:${projectId}`, async () => {
      const response = await this.client.get(`/project/${encodeURIComponent(projectId)}`);
      return response.data;
    });
    return this.normalizeProject(data);
  }

  async listFiles(projectId, { gameVersion = '', loader = '' } = {}) {
    const params = {};
    if (gameVersion) params.game_versions = JSON.stringify([gameVersion]);
    if (loader) params.loaders = JSON.stringify([loader.toLowerCase()]);

    const cacheKey = `modrinth:versions:${projectId}:${JSON.stringify(params)}`;
    const versions = await this.cache.wrap(cacheKey, async () => {
      const response = await this.client.get(`/project/${encodeURIComponent(projectId)}/version`, { params });
      return response.data;
    });

    return versions
      .map(version => this.normalizeVersion(projectId, version))
      .filter(Boolean);
  }

  async resolveFile({ projectId, fileId, gameVersion = '', loader = '' }) {
    const files = await this.listFiles(projectId, { gameVersion, loader });
    if (!files.length) {
      throw new Error('No compatible Modrinth files were found.');
    }
    if (fileId) {
      const match = files.find(file => file.fileId === fileId || file.versionId === fileId);
      if (match) return match;
    }
    return files[0];
  }

  normalizeSearchHit(hit) {
    return {
      source: this.id,
      sourceName: this.name,
      sourceId: hit.project_id,
      slug: hit.slug,
      type: this.inferType(hit.categories, hit.project_type),
      name: hit.title,
      summary: hit.description || '',
      descriptionHtml: null,
      iconUrl: hit.icon_url || null,
      websiteUrl: `https://modrinth.com/${hit.project_type}/${hit.slug}`,
      downloads: hit.downloads || 0,
      follows: hit.follows || 0,
      categories: hit.categories || [],
      loaders: hit.categories || [],
      gameVersions: hit.versions || [],
      license: hit.license || null,
      updatedAt: hit.date_modified || null,
      status: 'API',
    };
  }

  normalizeProject(project) {
    return {
      source: this.id,
      sourceName: this.name,
      sourceId: project.id,
      slug: project.slug,
      type: this.inferType(project.loaders || project.categories, project.project_type),
      name: project.title,
      summary: project.description || '',
      descriptionHtml: project.body || null,
      iconUrl: project.icon_url || null,
      websiteUrl: `https://modrinth.com/${project.project_type}/${project.slug}`,
      downloads: project.downloads || 0,
      follows: project.followers || 0,
      categories: project.categories || [],
      loaders: project.loaders || project.categories || [],
      gameVersions: project.game_versions || [],
      license: project.license?.id || null,
      updatedAt: project.updated || null,
      status: 'API',
    };
  }

  normalizeVersion(projectId, version) {
    const file = version.files?.find(entry => entry.primary) || version.files?.[0];
    if (!file?.url) return null;
    return {
      source: this.id,
      projectId,
      versionId: version.id,
      fileId: file.hashes?.sha512 || file.hashes?.sha1 || file.filename,
      name: file.filename,
      versionName: version.name,
      versionNumber: version.version_number,
      gameVersions: version.game_versions || [],
      loaders: version.loaders || [],
      releaseType: version.version_type || 'unknown',
      size: file.size || null,
      hashes: file.hashes || {},
      downloadUrl: file.url,
      dependencies: (version.dependencies || []).map(dep => ({
        source: this.id,
        projectId: dep.project_id,
        versionId: dep.version_id,
        required: dep.dependency_type === 'required',
        type: dep.dependency_type || 'unknown',
      })),
      publishedAt: version.date_published || null,
    };
  }

  inferType(categories = [], projectType = 'mod') {
    if (projectType === 'plugin') return 'Plugins';
    if ((categories || []).some(category => PLUGIN_LOADERS.has(String(category).toLowerCase()))) {
      return 'Plugins';
    }
    return 'Mods';
  }
}

module.exports = ModrinthAdapter;
