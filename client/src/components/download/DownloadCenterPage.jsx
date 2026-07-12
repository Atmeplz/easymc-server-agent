import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Download, Loader2, Search } from 'lucide-react';
import { DOWNLOAD_RESOURCES, DOWNLOAD_SOURCE_OPTIONS, DOWNLOAD_TYPES } from '../../constants/app.js';
import { matchesFuzzyQuery } from '../../utils/fuzzySearch.js';
import { decorateDownloadResource } from '../../utils/download.js';
import PageShell from '../ui/PageShell.jsx';
import DownloadDetailsPanel from './DownloadDetailsPanel.jsx';
import DownloadFilterButton from './DownloadFilterButton.jsx';
import DownloadResultItem from './DownloadResultItem.jsx';

export default function DownloadCenterPage({ queue, refreshQueue }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Mods');
  const [source, setSource] = useState('All');
  const [sources, setSources] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState('');

  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const backendConnected = sources.some(item => item.enabled);
  const catalogReady = sourcesLoaded && searchLoaded;

  useEffect(() => {
    let cancelled = false;
    setSourcesLoaded(false);
    fetch('/api/download/sources')
      .then(response => response.json())
      .then(data => {
        if (!cancelled) {
          setSources(data.sources || []);
          setSourcesLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSources([]);
          setSourcesLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setDownloadNotice('');
      try {
        const params = new URLSearchParams({
          query,
          type,
          source,
        });
        const response = await fetch(`/api/download/search?${params.toString()}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errors?.[0] || 'Download search failed.');
        const nextResources = (data.results || []).map(decorateDownloadResource);
        setResources(nextResources.length ? nextResources : DOWNLOAD_RESOURCES);
        if (data.errors?.length) setDownloadNotice(data.errors.join(' | '));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setDownloadNotice(`Download search unavailable: ${err.message}`);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setSearchLoaded(true);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, type, source]);

  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      const matchesQuery = matchesFuzzyQuery(query, [
        resource.name,
        resource.summary,
        resource.sourceName,
        resource.source,
        resource.type,
        ...(resource.tags || []),
      ]);
      const matchesType = resource.type === type;
      const sourceKey = source.toLowerCase();
      const matchesSource = source === 'All'
        || resource.source?.toLowerCase() === sourceKey
        || resource.sourceName?.toLowerCase() === sourceKey;
      return matchesQuery && matchesType && matchesSource;
    });
  }, [query, type, source, resources]);

  const selectedResource = filteredResources.find(resource => resource.id === selectedId) || filteredResources[0] || null;
  const selectedDownloadItem = selectedResource
    ? queue.find(item => item.projectId === selectedResource.sourceId || item.id === selectedResource.id) || null
    : null;
  const sourceOptions = useMemo(() => {
    const enabledSources = sources
      .filter(item => item.enabled)
      .map(item => ({ value: item.id, label: item.name }));
    const fallbackSources = DOWNLOAD_SOURCE_OPTIONS;
    const merged = new Map([['All', { value: 'All', label: 'All' }]]);
    for (const option of [...enabledSources, ...fallbackSources]) merged.set(option.value, option);
    return Array.from(merged.values());
  }, [sources]);

  useEffect(() => {
    if (!selectedResource?.sourceId) {
      setFiles([]);
      return;
    }

    const controller = new AbortController();
    setFiles([]);
    setFilesLoading(true);
    setSelectedFileId('');
    fetch(`/api/download/project/${selectedResource.source}/${encodeURIComponent(selectedResource.sourceId)}/files`, { signal: controller.signal })
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Failed to load files.');
        setFiles(data.files || []);
        setSelectedFileId(data.files?.[0]?.fileId || '');
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setFiles([]);
          setDownloadNotice(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilesLoading(false);
      });

    return () => controller.abort();
  }, [selectedResource?.source, selectedResource?.sourceId]);

  const installSelected = async () => {
    if (!selectedResource || selectedResource.type === 'Server Core') {
      setDownloadNotice('Server core installation is available in the backend but requires an explicit confirmed flow.');
      return;
    }

    const selectedFile = files.find(file => file.fileId === selectedFileId) || files[0];
    if (!selectedFile) {
      setDownloadNotice('No compatible file is selected.');
      return;
    }

    setInstalling(true);
    setDownloadNotice('');
    try {
      const response = await fetch('/api/download/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedResource.source,
          projectId: selectedResource.sourceId,
          fileId: selectedFile.fileId,
          type: selectedResource.type,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Install failed.');
      setDownloadNotice(`${selectedResource.name} installed to ${data.result?.fileName || selectedResource.target}.`);
      await refreshQueue();
    } catch (err) {
      setDownloadNotice(err.message);
      await refreshQueue();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <PageShell
      title="Download"
      action={
        <div className="rounded-full bg-md-primaryContainer/65 px-4 py-2 text-xs font-bold text-md-onPrimaryContainer flex items-center gap-2">
          <CheckCircle size={15} /> {backendConnected ? 'Backend connected' : 'Connecting...'}
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 min-h-0 flex-1">
        <aside className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Search</p>
            <div className="flex items-center gap-2 rounded-full border border-md-surfaceVariant bg-md-bg px-3 py-2 focus-within:border-md-primary transition">
              <Search size={16} className="text-md-outline shrink-0" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Core, mod, plugin..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-md-outline"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {DOWNLOAD_TYPES.map(option => (
                <DownloadFilterButton key={option} active={type === option} onClick={() => setType(option)}>
                  {option}
                </DownloadFilterButton>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Source</p>
            <select
              value={source}
              onChange={event => setSource(event.target.value)}
              className="w-full rounded-full border border-md-surfaceVariant bg-md-bg px-4 py-2 text-sm outline-none focus:border-md-primary"
            >
              {sourceOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-[20px] bg-md-primaryContainer/45 px-4 py-3">
            <p className="text-sm font-bold text-md-onPrimaryContainer">Resource catalog</p>
            <p className="text-xs text-md-outline mt-1 leading-relaxed">
              {backendConnected
                ? 'Backend connected. Search results come from live download sources.'
                : 'Waiting for backend connection to load the resource catalog.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-md-outline uppercase">Sources</p>
            {(sources.length ? sources : sourceOptions.filter(item => item.value !== 'All').map(item => ({ id: item.value, name: item.label, enabled: item.value !== 'CurseForge' }))).map(item => (
              <div key={item.id || item.name} className="flex items-center justify-between rounded-full bg-md-surfaceVariant/45 px-3 py-2 text-xs">
                <span className="font-bold">{item.name}</span>
                <span className={item.enabled ? 'text-md-success' : 'text-md-outline'}>{item.enabled ? 'ready' : 'off'}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-h-0 flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-md-outline">Results</p>
              <p className="text-sm font-bold">{loading ? 'Searching...' : `${filteredResources.length} resources found`}</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-md-outline">
              <span className="rounded-full bg-md-surfaceContainer px-3 py-1 border border-md-surfaceVariant">1.21.x</span>
              <span className="rounded-full bg-md-surfaceContainer px-3 py-1 border border-md-surfaceVariant">Server-ready</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {!catalogReady || loading ? (
              <div className="h-full rounded-[24px] border border-dashed border-md-surfaceVariant bg-md-surfaceContainer flex flex-col items-center justify-center text-center p-8">
                <Loader2 size={36} className="text-md-primary animate-spin mb-3" />
                <h3 className="text-lg font-bold">Loading resources</h3>
                <p className="text-sm text-md-outline mt-1">Please wait while the catalog is fetched.</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="h-full rounded-[24px] border border-dashed border-md-surfaceVariant bg-md-surfaceContainer flex flex-col items-center justify-center text-center p-8">
                <Download size={34} className="text-md-outline mb-3" />
                <h3 className="text-lg font-bold">No resources found</h3>
                <p className="text-sm text-md-outline mt-1">Try another type, All sources, or a shorter search term.</p>
              </div>
            ) : (
              filteredResources.map(resource => {
                const resourceDownloadItem = queue.find(item => item.projectId === resource.sourceId || item.id === resource.id);
                return (
                  <DownloadResultItem
                    key={resource.id}
                    resource={resource}
                    active={selectedResource?.id === resource.id}
                    installStatus={resourceDownloadItem?.status || ''}
                    onSelect={() => setSelectedId(resource.id)}
                    onQueue={() => setSelectedId(resource.id)}
                  />
                );
              })
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto space-y-3">
          <DownloadDetailsPanel
            resource={selectedResource}
            files={files}
            filesLoading={filesLoading}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
            downloadItem={selectedDownloadItem}
            installing={installing}
            notice={downloadNotice}
            onQueue={installSelected}
          />
        </aside>
      </div>
    </PageShell>
  );
}
