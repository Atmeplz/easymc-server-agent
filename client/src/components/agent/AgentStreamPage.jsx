import { useEffect, useRef } from 'react';
import { Bot, Radio } from 'lucide-react';
import { formatTime } from '../../utils/format.js';
import Avatar from '../ui/Avatar.jsx';

export default function AgentStreamPage({
  messages,
  isTyping,
  isRunning,
  connected,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
  }, [messages.length, isTyping]);

  const isAtLimit = messages.length >= 100;

  return (
    <section className="material-page h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-3xl font-medium text-md-primary">@agent Stream</h1>
          <p className="text-xs text-md-outline mt-1">
            {!connected
              ? 'Disconnected from server'
              : isRunning
                ? 'Listening for in-game @agent messages'
                : 'Start the server to begin listening'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-md-onPrimaryContainer bg-md-primaryContainer/65 px-4 py-2 rounded-full">
          {!connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-md-error" />
              Disconnected
            </>
          ) : isRunning ? (
            <>
              <span className="w-2 h-2 rounded-full bg-md-success animate-pulse" />
              Live
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-md-outline" />
              Offline
            </>
          )}
        </div>
      </div>

      {!connected && (
        <div className="mb-3 rounded-2xl bg-md-errorContainer/40 border border-md-error/20 px-4 py-2.5 text-xs text-md-error flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-md-error" />
          WebSocket disconnected. Stream updates are paused.
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto px-1 pb-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-md-outline gap-3">
            <Radio size={40} className="text-md-outline/50" />
            <p className="text-sm">No @agent activity yet.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            {msg.role === 'player' && (
              <div className="flex justify-end">
                <div className="max-w-[72%]">
                  <div className="bg-md-primary text-md-onPrimary px-5 py-3 rounded-[24px] rounded-tr-md text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
                    <span className="font-bold">{msg.player}: </span>
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-md-outline mt-1 text-right">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex gap-3">
                <Avatar className="bg-md-primaryContainer" icon={Bot} />
                <div className="max-w-[72%]">
                  <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-5 py-3 rounded-[24px] rounded-tl-md text-sm leading-relaxed text-md-onPrimaryContainer shadow-sm whitespace-pre-wrap">
                    <span className="font-bold text-md-primary">→ {msg.player}: </span>
                    {msg.content}
                  </div>
                  <p className="text-[10px] text-md-outline mt-1">{formatTime(msg.timestamp)}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 chat-message">
            <Avatar className="bg-md-primaryContainer" icon={Bot} />
            <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-4 py-3 rounded-[24px] rounded-tl-md shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '240ms' }} />
              </div>
            </div>
          </div>
        )}

        {isAtLimit && (
          <div className="text-center text-[10px] text-md-outline py-2">
            Reached the 100-message history limit.
          </div>
        )}

      </div>
    </section>
  );
}
