import { AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react';
import DetailStat from './DetailStat.jsx';
import ResourceIcon from './ResourceIcon.jsx';
import SourceBadge from './SourceBadge.jsx';

export default function DownloadDetailsPanel({
  resource,
  files,
  filesLoading,
  selectedFileId,
  setSelectedFileId,
  downloadItem,
  installing,
  notice,
  onQueue,
}) {
  if (!resource) {
    return (
      <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 text-sm text-md-outline">
        Select a resource to inspect details.
      </section>
    );
  }

  const downloadActive = installing || downloadItem?.status === 'queued' || downloadItem?.status === 'running';
  const installed = downloadItem?.status === 'complete';
  const progress = Math.max(0, Math.min(100, Number(downloadItem?.progress || (installing ? 5 : 0))));
  const buttonDisabled = installed || downloadActive || filesLoading;
  const buttonLabel = downloadActive
    ? `${progress}%`
    : installed
      ? 'Installed'
      : resource.type === 'Server Core'
        ? 'Core install requires confirmation'
        : 'Install selected file';

  return (
    <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-md-secondaryContainer text-md-onSecondaryContainer flex items-center justify-center shrink-0">
          <ResourceIcon resource={resource} className="h-full w-full rounded-2xl" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-md-outline">{resource.type}</p>
          <h2 className="text-xl font-bold leading-tight">{resource.name}</h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <SourceBadge source={resource.sourceName || resource.source} />
            <span className="rounded-full bg-md-successContainer px-2.5 py-1 text-xs font-bold text-md-success">{resource.status}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-md-outline leading-relaxed">{resource.details}</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <DetailStat label="Version" value={resource.version} />
        <DetailStat label="Loader" value={resource.loader} />
        <DetailStat label="Target" value={resource.target} />
        <DetailStat label="Size" value={resource.size} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-bold text-md-outline uppercase">Files</p>
          {filesLoading && <Loader2 size={14} className="animate-spin text-md-outline" />}
        </div>
        {files.length === 0 ? (
          <div className="rounded-[18px] bg-md-bg border border-dashed border-md-surfaceVariant px-4 py-3 text-xs text-md-outline">
            {filesLoading ? 'Loading compatible files...' : 'No compatible files loaded yet.'}
          </div>
        ) : (
          <div className={`space-y-2 max-h-44 overflow-y-auto pr-1 transition-opacity ${downloadActive ? 'opacity-55' : ''}`}>
            {files.slice(0, 8).map(file => (
              <label
                key={file.fileId}
                className={`flex items-start gap-3 rounded-[18px] border px-3 py-2 ${
                  downloadActive ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                  selectedFileId === file.fileId
                    ? 'border-md-primary bg-md-primaryContainer/45'
                    : 'border-md-surfaceVariant bg-md-bg'
                }`}
              >
                <input
                  type="radio"
                  name="download-file"
                  checked={selectedFileId === file.fileId}
                  onChange={() => setSelectedFileId(file.fileId)}
                  disabled={downloadActive}
                  className="mt-1 accent-md-primary"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold truncate">{file.versionName || file.name}</span>
                  <span className="block text-[11px] text-md-outline truncate">{file.name}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onQueue}
        disabled={buttonDisabled}
        className={`relative mt-4 w-full overflow-hidden rounded-full px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${
          buttonDisabled && !downloadActive
            ? 'bg-md-surfaceVariant text-md-outline'
            : 'bg-md-primary text-md-onPrimary'
        }`}
      >
        {downloadActive && (
          <span
            className="absolute inset-y-0 left-0 bg-md-success/45 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {downloadActive ? <Loader2 size={16} className="animate-spin" /> : installed ? <CheckCircle size={16} /> : <Download size={16} />}
          {buttonLabel}
        </span>
      </button>

      <div className="mt-4 rounded-[18px] bg-md-warningContainer/40 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-md-warning shrink-0 mt-0.5" />
        <p className="text-xs text-md-outline leading-relaxed">
          {notice || 'Mods and plugins install to their server folders. Server cores require a confirmed deployment flow.'}
        </p>
      </div>
    </section>
  );
}
