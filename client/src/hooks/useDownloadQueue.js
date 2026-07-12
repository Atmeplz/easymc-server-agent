import { useCallback, useEffect, useState } from 'react';
import useSocket from './useSocket.js';

export default function useDownloadQueue({ onComplete } = {}) {
  const { on } = useSocket();
  const [queue, setQueue] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/download/queue');
      const data = await response.json();
      setQueue(data.queue || []);
    } catch {
      setQueue([]);
    }
  }, []);

  useEffect(() => {
    const mergeItem = (item) => {
      if (!item?.id) return;
      setQueue(current => {
        const index = current.findIndex(entry => entry.id === item.id);
        if (index === -1) return [item, ...current];
        const next = [...current];
        next[index] = item;
        return next;
      });
    };

    const unsubs = [
      on('download:queue', ({ queue: items }) => setQueue(items || [])),
      on('download:progress', mergeItem),
      on('download:error', mergeItem),
      on('download:complete', () => onComplete?.()),
    ];
    refresh();
    return () => unsubs.forEach(u => u());
  }, [on, onComplete, refresh]);

  return { queue, refresh };
}
