import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle, ChevronDown, Wrench } from 'lucide-react';
import { formatTime } from '../../utils/format.js';
import Avatar from '../ui/Avatar.jsx';

export default function ChatMessage({ message, pendingConfirm, respondConfirm }) {
  const [toolExpanded, setToolExpanded] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end chat-message">
        <div className="max-w-[72%]">
          <div className="bg-md-primary text-md-onPrimary px-5 py-3 rounded-[24px] rounded-tr-md text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
            {message.content}
          </div>
          <p className="text-[10px] text-md-outline mt-1 text-right">{formatTime(message.timestamp)}</p>
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex gap-3 chat-message">
        <Avatar className="bg-md-secondaryContainer" icon={Wrench} />
        <div className="max-w-[80%] bg-md-secondaryContainer/70 px-4 py-2.5 rounded-[20px] rounded-tl-md text-sm shadow-sm">
          <div className="flex items-center gap-2 font-bold text-md-onSecondaryContainer">
            <Wrench size={15} />
            <span className="min-w-0 flex-1 truncate">Agent : {message.tool}</span>
            <CheckCircle size={15} className="text-md-success shrink-0" />
            {message.args && (
              <button
                onClick={() => setToolExpanded(expanded => !expanded)}
                className="ml-1 h-7 w-7 rounded-full text-md-outline hover:bg-md-surfaceVariant/70 hover:text-md-onSecondaryContainer transition flex items-center justify-center shrink-0"
                title={toolExpanded ? 'Collapse tool details' : 'Expand tool details'}
                aria-expanded={toolExpanded}
              >
                <ChevronDown size={16} className={`transition-transform ${toolExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          {message.args && toolExpanded && (
            <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-md-outline whitespace-pre-wrap">
              {JSON.stringify(message.args, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (message.role === 'confirm') {
    const active = pendingConfirm?.confirmId === message.confirmId;
    return (
      <div className="flex gap-3 chat-message">
        <Avatar className="bg-md-errorContainer text-md-error" icon={AlertTriangle} />
        <div className="max-w-[80%] bg-md-surfaceContainer border border-md-error/30 px-5 py-3 rounded-[24px] rounded-tl-md text-sm shadow-sm">
          <p className="font-bold text-md-error">高危命令确认</p>
          <p className="mt-1">Command: <code className="rounded bg-md-errorContainer px-1.5 py-0.5 text-xs text-md-error">{message.command}</code></p>
          <p className="mt-1 text-xs text-md-outline">{message.reason}</p>
          {active ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => respondConfirm(true)} className="rounded-full bg-md-error px-4 py-1.5 text-xs font-bold text-md-onPrimary">
                Continue
              </button>
              <button onClick={() => respondConfirm(false)} className="rounded-full bg-md-surfaceVariant px-4 py-1.5 text-xs font-bold text-md-onPrimaryContainer">
                Cancel
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-md-outline">Waiting state ended.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-primaryContainer" icon={Bot} />
      <div className="max-w-[72%]">
        <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-5 py-3 rounded-[24px] rounded-tl-md text-sm leading-relaxed text-md-onPrimaryContainer shadow-sm whitespace-pre-wrap">
          {message.content}
        </div>
        <p className="text-[10px] text-md-outline mt-1">{formatTime(message.timestamp)}</p>
      </div>
    </div>
  );
}
