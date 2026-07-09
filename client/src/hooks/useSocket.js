/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

// Create the socket eagerly so tree-shaking does not remove it.
const socket = io(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});

export function getSocket() {
  return socket;
}

export default function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const emit = useCallback((event, data) => {
    const s = socketRef.current || getSocket();
    s.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    const s = socketRef.current || getSocket();
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  return { connected, emit, on, socket: socketRef.current || getSocket() };
}
