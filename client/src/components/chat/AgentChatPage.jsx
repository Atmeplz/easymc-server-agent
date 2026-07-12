import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../../utils/format.js';
import buildChatItems from './buildChatItems.js';
import ChatComposer from './ChatComposer.jsx';
import ChatMessage from './ChatMessage.jsx';
import ToolActivityMessage from './ToolActivityMessage.jsx';
import TypingBubble from './TypingBubble.jsx';

export default function AgentChatPage({
  welcomeMessage,
  messages,
  activeSession,
  isTyping,
  activeToolCall,
  pendingConfirm,
  chatInput,
  setChatInput,
  sendMessage,
  respondConfirm,
  interruptAgent,
  agentStopping,
  renameSession,
  messagesEndRef,
}) {
  const isEmpty = messages.length === 0;
  const chatItems = useMemo(() => buildChatItems(messages), [messages]);
  const lastChatItem = chatItems[chatItems.length - 1];
  const hasRunningToolGroup = isTyping && lastChatItem?.kind === 'toolGroup';
  const showStopAgent = isTyping || pendingConfirm;
  const [draftTitle, setDraftTitle] = useState(activeSession?.title || 'Chat');
  const [editingTitle, setEditingTitle] = useState(false);
  const tokenCount = Number(activeSession?.usage?.total_tokens || 0);

  useEffect(() => {
    setDraftTitle(activeSession?.title || 'Chat');
    setEditingTitle(false);
  }, [activeSession?.id, activeSession?.title]);

  const saveTitle = () => {
    if (!activeSession?.id) return;
    const nextTitle = draftTitle.trim() || 'New chat';
    setDraftTitle(nextTitle);
    setEditingTitle(false);
    if (nextTitle !== activeSession.title) {
      renameSession(activeSession.id, nextTitle);
    }
  };

  return (
    <section className="material-page h-full flex flex-col overflow-hidden">
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <h1 className="text-4xl md:text-5xl font-medium text-md-primary text-center mb-8">{welcomeMessage}</h1>
          <ChatComposer
            value={chatInput}
            onChange={setChatInput}
            onSubmit={sendMessage}
            autoFocus
            showStop={showStopAgent}
            onStop={interruptAgent}
            stopping={agentStopping}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pb-4">
            <div>
              {editingTitle ? (
                <input
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      setDraftTitle(activeSession?.title || 'Chat');
                      setEditingTitle(false);
                    }
                  }}
                  className="max-w-[24rem] rounded-2xl bg-md-surfaceContainer px-2 py-1 text-3xl font-medium text-md-primary outline-none border border-md-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="max-w-[24rem] truncate rounded-2xl px-1 py-1 text-left text-3xl font-medium text-md-primary hover:bg-md-surfaceVariant/40 focus:outline-none focus-visible:outline-none"
                  title="Rename chat"
                >
                  {activeSession?.title || 'Chat'}
                </button>
              )}
              {tokenCount > 0 && (
                <p className="text-xs text-md-outline mt-1">{tokenCount.toLocaleString()} tokens used</p>
              )}
              <p className="text-xs text-md-outline mt-1">{messages.length} messages · {formatDate(activeSession?.updatedAt)}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-4 space-y-5">
            {chatItems.map(item => (
              item.kind === 'toolGroup' ? (
                <ToolActivityMessage
                  key={item.id}
                  tools={item.tools}
                  isRunning={isTyping && item.id === lastChatItem?.id}
                  activeToolCall={isTyping && item.id === lastChatItem?.id ? activeToolCall : null}
                />
              ) : (
                <ChatMessage key={item.message.id} message={item.message} pendingConfirm={pendingConfirm} respondConfirm={respondConfirm} />
              )
            ))}
            {isTyping && !hasRunningToolGroup && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>
          <div className="pb-2">
            <ChatComposer
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendMessage}
              showStop={showStopAgent}
              onStop={interruptAgent}
              stopping={agentStopping}
            />
          </div>
        </>
      )}
    </section>
  );
}
