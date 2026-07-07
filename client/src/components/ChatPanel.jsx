/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useRef, useEffect } from 'react';
import useChat from '../hooks/useChat.js';
import { Send, Trash2, Bot, User, Wrench, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function ChatPanel() {
  const { messages, sendMessage, isTyping, clearMessages, pendingConfirmation, respondConfirmation } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the chat scrolled to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-mc-darker">
      {/* Header bar */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-mc-border shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-mc-aqua" />
          <span className="text-xs font-medium text-gray-300">AI Agent 对话</span>
        </div>
        <button
          onClick={clearMessages}
          className="p-1 hover:bg-mc-panel rounded transition-colors text-gray-500 hover:text-gray-300"
          title="清空对话"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
            <Bot size={32} className="text-gray-600" />
            <p>在下方输入消息与 AI Agent 对话</p>
            <p className="text-xs text-gray-600">游戏内玩家可通过 @agent 触发</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            {msg.role === 'user' && (
              <div className="flex gap-2 justify-end">
                <div className="max-w-[85%] bg-blue-600/80 text-white text-sm rounded-2xl rounded-br-md px-3 py-2">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <User size={14} />
                </div>
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-mc-aqua/20 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-mc-aqua" />
                </div>
                <div className="max-w-[85%] bg-mc-panel text-gray-200 text-sm rounded-2xl rounded-bl-md px-3 py-2">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            )}

            {msg.role === 'tool' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-mc-gold/20 flex items-center justify-center shrink-0">
                  <Wrench size={14} className="text-mc-gold" />
                </div>
                <div className="max-w-[85%] bg-yellow-900/20 border border-yellow-800/30 text-yellow-300 text-xs rounded-lg px-3 py-2">
                  <span className="font-mono">🔧 {msg.tool}</span>
                  {msg.args && (
                    <pre className="mt-1 text-yellow-400/70 overflow-x-auto">
                      {JSON.stringify(msg.args, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {msg.role === 'confirm' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                <div className="max-w-[85%] bg-red-900/30 border border-red-700/40 text-red-200 text-sm rounded-2xl rounded-bl-md px-3 py-2">
                  <p className="font-semibold text-red-300">⚠️ 高危命令确认</p>
                  <p className="mt-1">命令：<code className="bg-red-900/50 px-1 rounded font-mono text-xs">{msg.command}</code></p>
                  <p className="mt-1 text-red-300/80 text-xs">{msg.reason}</p>
                  {pendingConfirmation?.confirmId === msg.confirmId && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => respondConfirmation(msg.confirmId, true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded-lg transition-colors"
                      >
                        <CheckCircle size={14} /> 继续执行
                      </button>
                      <button
                        onClick={() => respondConfirmation(msg.confirmId, false)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-600/80 hover:bg-gray-600 text-gray-200 text-xs rounded-lg transition-colors"
                      >
                        <XCircle size={14} /> 取消
                      </button>
                    </div>
                  )}
                  {pendingConfirmation?.confirmId !== msg.confirmId && (
                    <p className="mt-1 text-gray-400 text-xs">已响应</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2 chat-message">
            <div className="w-7 h-7 rounded-full bg-mc-aqua/20 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-mc-aqua" />
            </div>
            <div className="bg-mc-panel rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-mc-border p-3 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            rows={1}
            className="flex-1 bg-mc-dark border border-mc-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-mc-aqua/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="p-2 bg-mc-aqua/20 hover:bg-mc-aqua/30 disabled:opacity-30 disabled:hover:bg-mc-aqua/20 text-mc-aqua rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
