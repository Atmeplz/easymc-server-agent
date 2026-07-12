import { Package, Puzzle, Server } from 'lucide-react';

export function decorateDownloadResource(resource) {
  const type = resource.type || 'Mods';
  const source = resource.source || resource.sourceName || 'local';
  const categories = resource.categories || resource.loaders || [];
  const icon = type === 'Server Core' ? Server : type === 'Plugins' ? Package : Puzzle;
  return {
    id: `${source}:${resource.sourceId || resource.slug || resource.name}`,
    source,
    sourceName: resource.sourceName || resource.source || 'Local',
    sourceId: resource.sourceId || resource.slug || resource.id,
    slug: resource.slug,
    type,
    name: resource.name,
    summary: resource.summary || 'No summary is available.',
    version: resource.gameVersions?.[0] || resource.version || 'latest',
    loader: resource.loaders?.[0] || resource.loader || 'Any',
    target: type === 'Plugins' ? 'plugins/' : type === 'Mods' ? 'mods/' : 'server.jar',
    size: resource.downloads ? `${resource.downloads.toLocaleString?.() || resource.downloads} downloads` : 'unknown',
    downloads: resource.downloads || '',
    updated: resource.updatedAt || resource.updated || '',
    status: resource.status || 'API',
    icon,
    iconUrl: resource.iconUrl || resource.icon_url || '',
    tags: categories.slice(0, 4),
    details: resource.descriptionHtml || resource.summary || 'No details are available.',
  };
}

export function resourceCountLabel(items = []) {
  const enabled = items.filter(item => item.enabled === true || String(item.status || '').toLowerCase() === 'enabled').length;
  return `${enabled}/${items.length}`;
}
