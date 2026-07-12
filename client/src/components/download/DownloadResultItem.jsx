import { CheckCircle, ChevronRight, Loader2 } from 'lucide-react';
import ResourceIcon from './ResourceIcon.jsx';
import SourceBadge from './SourceBadge.jsx';

export default function DownloadResultItem({ resource, active, installStatus, onSelect, onQueue }) {
  const installed = installStatus === 'complete';
  const installingResource = installStatus === 'queued' || installStatus === 'running';
  return (
    <article
      className={`rounded-[24px] border p-4 shadow-sm transition ${
        active
          ? 'bg-md-primaryContainer/55 border-md-primary'
          : 'bg-md-surfaceContainer border-md-surfaceVariant hover:border-md-primary/50'
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={onSelect}
          className="h-14 w-14 rounded-2xl bg-md-primaryContainer text-md-onPrimaryContainer flex items-center justify-center shrink-0 overflow-hidden"
          title={`Inspect ${resource.name}`}
        >
          <ResourceIcon resource={resource} className="h-full w-full" />
        </button>
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base">{resource.name}</h3>
            <SourceBadge source={resource.sourceName || resource.source} />
            <span className="rounded-full bg-md-surfaceVariant/70 px-2 py-0.5 text-[11px] font-bold text-md-outline">{resource.type}</span>
          </div>
          <p className="text-sm text-md-outline mt-1 line-clamp-2">{resource.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resource.tags.map(tag => (
              <span key={tag} className="rounded-full bg-md-surfaceVariant/45 px-2.5 py-1 text-xs text-md-outline">{tag}</span>
            ))}
          </div>
        </button>
        <button
          onClick={onQueue}
          disabled={installed || installingResource}
          className="rounded-full bg-md-primary px-3 py-2 text-xs font-bold text-md-onPrimary flex items-center gap-1.5 disabled:bg-md-surfaceVariant disabled:text-md-outline shrink-0"
        >
          {installed ? <CheckCircle size={14} /> : installingResource ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
          {installed ? 'Installed' : installingResource ? 'Installing' : 'Details'}
        </button>
      </div>
    </article>
  );
}
