import { useState } from 'react';
import { CheckCircle, ChevronDown, Loader2, Wrench } from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';

export default function ToolActivityMessage({ tools, isRunning, activeToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const latestTool = tools[tools.length - 1];
  const currentToolName = activeToolCall?.tool || latestTool?.tool || 'working';
  const statusLabel = isRunning ? `Agent: ${currentToolName}` : 'Agent: Done!';

  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-secondaryContainer" icon={Wrench} />
      <div className="max-w-[80%]">
        <div className="bg-md-secondaryContainer/70 px-4 py-2.5 rounded-[20px] rounded-tl-md text-sm shadow-sm">
          <div className="flex items-center gap-2 font-bold text-md-onSecondaryContainer">
            <Wrench size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{statusLabel}</span>
            {isRunning ? (
              <Loader2 size={16} className="text-md-primary shrink-0 animate-spin" />
            ) : (
              <CheckCircle size={16} className="text-md-success shrink-0" />
            )}
            <button
              onClick={() => setExpanded(value => !value)}
              className="ml-1 h-7 w-7 rounded-full text-md-outline hover:bg-md-surfaceVariant/70 hover:text-md-onSecondaryContainer transition flex items-center justify-center shrink-0"
              title={expanded ? 'Collapse tool details' : 'Expand tool details'}
              aria-expanded={expanded}
            >
              <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {expanded && (
          <div className="mt-2 rounded-[18px] border border-md-surfaceVariant bg-md-surfaceContainer/70 px-3 py-2 text-xs text-md-outline shadow-sm">
            <div className="space-y-2">
              {tools.map((tool, index) => (
                <div key={tool.id || `${tool.tool}-${index}`} className="rounded-[14px] bg-md-surface/70 px-3 py-2">
                  <div className="flex items-center gap-2 font-bold text-md-onPrimaryContainer">
                    <CheckCircle size={13} className="text-md-success shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tool.tool}</span>
                  </div>
                  {tool.args && (
                    <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-md-outline whitespace-pre-wrap">
                      {JSON.stringify(tool.args, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
