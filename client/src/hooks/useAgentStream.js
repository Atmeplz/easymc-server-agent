import { useEffect, useRef, useState } from 'react';
import useSocket from './useSocket.js';

const MAX_MESSAGES = 100;

export default function useAgentStream() {
  const { on } = useSocket();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    const unsubs = [
      on('agent:player_request', ({ player, request, timestamp }) => {
        idRef.current += 1;
        setMessages(prev => {
          if (prev.length >= MAX_MESSAGES) return prev;
          return [...prev.slice(-(MAX_MESSAGES - 1)), {
            id: `stream-${idRef.current}`,
            role: 'player',
            player,
            content: request,
            timestamp: timestamp || Date.now(),
          }];
        });
        setIsTyping(true);
      }),
      on('agent:player_reply', ({ player, reply, timestamp }) => {
        idRef.current += 1;
        setMessages(prev => {
          if (prev.length >= MAX_MESSAGES) return prev;
          return [...prev.slice(-(MAX_MESSAGES - 1)), {
            id: `stream-${idRef.current}`,
            role: 'assistant',
            player,
            content: reply,
            timestamp: timestamp || Date.now(),
          }];
        });
        setIsTyping(false);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [on]);

  return { messages, isTyping };
}
