import { formatDate, shortSize } from '../../utils/format.js';

export default function ResourceCard({ item, icon: Icon, onToggle, onRemove }) {
  const displayName = item.meta?.name || item.meta?.id || item.name;
  const version = item.meta?.version || item.meta?.modLoader || 'unknown';

  return (
    <div className="rounded-[24px] bg-md-surface shadow-sm border border-md-surfaceVariant p-4 flex items-start gap-4">
      <div className="w-16 h-16 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
        <Icon size={30} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm truncate">{displayName}</h3>
          <button
            onClick={onToggle}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${item.enabled ? 'bg-md-primary' : 'bg-md-surfaceVariant'}`}
            title={item.enabled ? 'Disable' : 'Enable'}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-md-onPrimary rounded-full transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-xs text-md-outline mt-1">version: {version}</p>
        <p className="text-xs text-md-outline mt-0.5">updated time: {formatDate(item.lastModified)}</p>
        <p className="text-xs text-md-outline mt-0.5">size: {shortSize(item.size)}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.enabled ? 'bg-md-successContainer text-md-success' : 'bg-md-surfaceVariant text-md-outline'}`}>
            {item.enabled ? 'enabled' : 'disabled'}
          </span>
          <button onClick={onRemove} className="rounded-full px-3 py-1 text-xs font-bold bg-md-errorContainer text-md-error hover:bg-md-errorContainer/80 transition">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
