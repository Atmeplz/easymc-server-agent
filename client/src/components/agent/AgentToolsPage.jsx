import { useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import PageShell from '../ui/PageShell.jsx';

export default function AgentToolsPage({ tools }) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (name) => setExpanded(expanded === name ? null : name);

  return (
    <PageShell title="Agent Tools">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {tools.length === 0 ? (
          <div className="rounded-[24px] bg-md-surfaceContainer border border-dashed border-md-surfaceVariant p-8 flex flex-col items-center text-center shadow-sm">
            <Wrench size={32} className="text-md-outline mb-3" />
            <h3 className="font-bold text-lg mb-1">暂无工具数据</h3>
            <p className="text-sm text-md-outline">Agent 工具定义尚未加载，请检查后端服务。</p>
          </div>
        ) : (
          tools.map(tool => (
            <div
              key={tool.name}
              className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 shadow-sm cursor-pointer hover:border-md-primary/40 transition"
              onClick={() => toggle(tool.name)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
                    <Wrench size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{tool.name}</h3>
                    <p className="text-xs text-md-outline mt-0.5 line-clamp-2">{tool.description}</p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-md-outline shrink-0 transition-transform ${expanded === tool.name ? 'rotate-90' : ''}`}
                />
              </div>
              {expanded === tool.name && tool.parameters?.properties && (
                <div className="mt-4 pt-3 border-t border-md-surfaceVariant/60">
                  <p className="text-xs font-bold text-md-outline mb-2">参数</p>
                  <div className="space-y-2">
                    {Object.entries(tool.parameters.properties).map(([key, def]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <code className="bg-md-primaryContainer/60 text-md-onPrimaryContainer px-1.5 py-0.5 rounded font-mono shrink-0">
                          {key}
                        </code>
                        <span className="text-md-outline">{def.description}</span>
                        {def.enum && (
                          <span className="text-[10px] text-md-primary bg-md-primaryContainer/40 px-1.5 py-0.5 rounded shrink-0">
                            {def.enum.join(', ')}
                          </span>
                        )}
                        {tool.parameters.required?.includes(key) && (
                          <span className="text-md-error font-bold shrink-0">*</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </PageShell>
  );
}
