/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useEffect } from 'react';
import { Puzzle, Power, Trash2, Download, Loader2, Search } from 'lucide-react';

export default function ModManager({ emit, on }) {
  const [mods, setMods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    emit('mod:list', {});
    const unsub = on('mod:list', ({ mods: m }) => {
      setMods(m);
      setLoading(false);
    });
    return unsub;
  }, [emit, on]);

  const handleInstall = () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    emit('mod:install', { url: installUrl.trim() });
    setInstallUrl('');
    setTimeout(() => setInstalling(false), 2000);
  };

  const handleToggle = (name, enabled) => {
    emit('mod:toggle', { name, enabled: !enabled });
  };

  const handleRemove = (name) => {
    if (confirm(`确定删除 Mod ${name}？`)) {
      emit('mod:remove', { name });
    }
  };

  const filtered = mods.filter(m =>
    !filter || m.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-mc-border">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="搜索 Mods..."
              className="w-full bg-mc-darker border border-mc-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={installUrl}
            onChange={e => setInstallUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInstall()}
            placeholder="粘贴 Mod 下载 URL..."
            className="flex-1 bg-mc-darker border border-mc-border rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
          />
          <button
            onClick={handleInstall}
            disabled={installing || !installUrl.trim()}
            className="px-3 py-1.5 bg-mc-aqua/20 hover:bg-mc-aqua/30 disabled:opacity-30 text-mc-aqua rounded-lg text-xs transition-colors"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 text-xs">
            <Puzzle size={24} className="mb-2 text-gray-600" />
            <p>暂无 Mods</p>
            <p className="text-gray-600 mt-1">通过 URL 安装或放入 mc-server/mods/ 目录</p>
          </div>
        ) : (
          <div className="divide-y divide-mc-border/50">
            {filtered.map(m => (
              <div key={m.fileName} className="px-3 py-2.5 hover:bg-mc-panel/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${m.enabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate">{m.meta?.name || m.name}</p>
                      <div className="flex items-center gap-2">
                        {m.meta?.version && <p className="text-[10px] text-gray-500">v{m.meta.version}</p>}
                        {m.meta?.type && <p className="text-[10px] text-gray-600">({m.meta.type})</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(m.name, m.enabled)}
                      className={`p-1 rounded transition-colors ${m.enabled ? 'text-green-400 hover:bg-green-900/30' : 'text-gray-500 hover:bg-gray-700/30'}`}
                      title={m.enabled ? '禁用' : '启用'}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      onClick={() => handleRemove(m.name)}
                      className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-mc-border text-[10px] text-gray-600 text-center">
        启用/禁用需重启服务器生效
      </div>
    </div>
  );
}
