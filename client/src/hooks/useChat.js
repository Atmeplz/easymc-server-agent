/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { getSocket } from './useSocket.js';

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onReply = ({ text, done }) => {
      if (done) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        }]);
        setIsTyping(false);
      }
    };

    const onToolCall = ({ tool, args }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'tool',
        tool,
        args,
        timestamp: Date.now(),
      }]);
    };

    const onConfirmRequest = ({ confirmId, command, reason }) => {
      setPendingConfirmation({ confirmId, command, reason });
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'confirm',
        confirmId,
        command,
        reason,
        timestamp: Date.now(),
      }]);
    };

    const onConfirmTimeout = () => {
      setPendingConfirmation(null);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: '⏰ 高危命令确认已超时（60秒），操作已自动取消。',
        timestamp: Date.now(),
      }]);
    };

    s.on('chat:reply', onReply);
    s.on('chat:tool_call', onToolCall);
    s.on('agent:confirm_request', onConfirmRequest);
    s.on('agent:confirm_timeout', onConfirmTimeout);

    return () => {
      s.off('chat:reply', onReply);
      s.off('chat:tool_call', onToolCall);
      s.off('agent:confirm_request', onConfirmRequest);
      s.off('agent:confirm_timeout', onConfirmTimeout);
    };
  }, []);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;

    // Add the user message.
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);
    setIsTyping(true);

    // Send the message to the server.
    const s = socketRef.current || getSocket();
    s.emit('chat:message', { text });
  }, []);

  const respondConfirmation = useCallback((confirmId, confirmed) => {
    const s = socketRef.current || getSocket();
    s.emit('agent:confirm_response', { confirmId, confirmed });
    setPendingConfirmation(null);

    // Add the user confirmation response to the conversation.
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: confirmed ? '✅ 确认执行' : '❌ 取消执行',
      timestamp: Date.now(),
    }]);
    if (confirmed) {
      setIsTyping(true);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingConfirmation(null);
  }, []);

  return { messages, sendMessage, isTyping, clearMessages, pendingConfirmation, respondConfirmation };
}
