import { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import PageShell from '../ui/PageShell.jsx';
import ResourceCard from './ResourceCard.jsx';

export default function ResourcePage({ kind, title, icon: Icon, items, loading, emit }) {
  const [filter, setFilter] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const enabledCount = items.filter(item => item.enabled).length;
  const filtered = useMemo(
    () => items.filter(item => !filter || (item.meta?.name || item.name).toLowerCase().includes(filter.toLowerCase())),
    [filter, items],
  );

  const install = () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    emit(`${kind}:install`, { url: installUrl.trim() });
    setInstallUrl('');
    window.setTimeout(() => setInstalling(false), 1800);
  };

  const toggle = (item) => emit(`${kind}:toggle`, { name: item.name, enabled: !item.enabled });
  const remove = (item) => {
    if (confirm(`确定移除 ${item.meta?.name || item.name} 吗？`)) {
      emit(`${kind}:remove`, { name: item.name });
    }
  };

  return (
    <PageShell
      title={
        <>
          {title} <span className="text-md-success">{enabledCount}</span><span className="text-md-outline">/{items.length}</span>
        </>
      }
      action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-md-outline" />
            <input
              value={filter}
              onChange={event => setFilter(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-52 rounded-full border border-md-surfaceVariant bg-md-surfaceContainer py-2 pl-9 pr-3 text-sm outline-none focus:border-md-primary"
            />
          </div>
          <div className="hidden md:flex items-center rounded-full border border-md-primaryContainer bg-md-primaryContainer/45 px-3 py-2">
            <input
              value={installUrl}
              onChange={event => setInstallUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') install();
              }}
              placeholder="Download URL"
              className="w-56 bg-transparent text-sm outline-none placeholder:text-md-outline"
            />
            <button onClick={install} disabled={!installUrl.trim() || installing} className="text-md-primary disabled:text-md-outline">
              {installing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-md-outline">
            <Loader2 size={22} className="animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant border-dashed p-8 flex flex-col items-center justify-center text-center w-full max-w-sm">
            <Icon size={32} className="text-md-outline mb-3" />
            <h3 className="font-bold text-lg mb-2">There is no files.</h3>
            <p className="text-sm text-md-outline">Use a direct download URL, or place files in mc-server/{kind === 'mod' ? 'mods' : 'plugins'}.</p>
            {kind === 'plugin' && <p className="text-xs text-md-outline mt-2">If the current core does not support plugins, this area will stay empty.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-2">
            {filtered.map(item => (
              <ResourceCard
                key={item.fileName}
                item={item}
                icon={Icon}
                onToggle={() => toggle(item)}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
