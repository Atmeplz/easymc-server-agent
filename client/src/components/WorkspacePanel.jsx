/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useCallback, useEffect } from 'react';
import { FolderOpen, RefreshCw, File, Folder, ChevronRight } from 'lucide-react';

export default function WorkspacePanel() {
  const [files, setFiles] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (e) {
      console.error('获取工作区文件失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return (
    <div className="border-t border-mc-border shrink-0">
      <div className="flex items-center justify-between h-8 px-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-mc-aqua hover:text-mc-aqua/80 transition-colors"
        >
          <FolderOpen size={14} />
          <span>项目文件</span>
          <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <button
          onClick={refreshFiles}
          disabled={loading}
          className="p-1 hover:bg-mc-panel rounded transition-colors text-gray-500 hover:text-gray-300"
          title="刷新"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {expanded && (
        <div className="max-h-32 overflow-y-auto px-3 pb-2">
          {files.length === 0 ? (
            <p className="text-[10px] text-gray-600 text-center py-1">暂无文件</p>
          ) : (
            <div className="space-y-0.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400 py-0.5 hover:bg-mc-panel/30 rounded px-1">
                  {f.type === 'dir' ? (
                    <Folder size={11} className="text-mc-gold shrink-0" />
                  ) : (
                    <File size={11} className="text-gray-600 shrink-0" />
                  )}
                  <span className="truncate font-mono">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[9px] text-gray-600 mt-1.5 pt-1 border-t border-mc-border/30">
            Agent 可访问整个项目目录（排除 node_modules、.git 等敏感目录）
          </p>
        </div>
      )}
    </div>
  );
}
