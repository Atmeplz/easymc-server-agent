/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useEffect, useRef } from 'react';
import { Users, MessageSquare, Shield, ChevronDown, ChevronUp } from 'lucide-react';

export default function AgentActivityPanel({ on }) {
  const [activities, setActivities] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    const unsub1 = on('agent:player_activity', (data) => {
      setActivities(prev => [...prev.slice(-49), {
        ...data,
        id: Date.now() + Math.random(),
        type: 'request',
      }]);
    });

    const unsub2 = on('agent:player_result', (data) => {
      setActivities(prev => [...prev.slice(-49), {
        ...data,
        id: Date.now() + Math.random(),
        type: 'result',
      }]);
    });

    return () => { unsub1(); unsub2(); };
  }, [on]);

  useEffect(() => {
    if (expanded) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [activities, expanded]);

  if (activities.length === 0) return null;

  return (
    <div className="border-t border-mc-border shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-8 flex items-center justify-between px-3 hover:bg-mc-panel/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs text-mc-gold">
          <Users size={14} />
          <span>游戏内 @agent 活动</span>
          <span className="bg-mc-gold/20 text-mc-gold px-1.5 rounded text-[10px]">{activities.length}</span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
      </button>

      {expanded && (
        <div ref={listRef} className="max-h-40 overflow-y-auto px-3 pb-2 space-y-1.5">
          {activities.slice(-10).map((act) => (
            <div key={act.id} className="text-xs rounded-lg bg-mc-dark/50 px-2.5 py-1.5 border border-mc-border/50">
              {act.type === 'request' && (
                <div className="flex items-start gap-2">
                  <MessageSquare size={12} className="text-mc-gold mt-0.5 shrink-0" />
                  <div>
                    <span className="text-mc-gold font-medium">{act.player}</span>
                    <span className="text-gray-500"> (OP{act.permission}) </span>
                    <span className="text-gray-300">{act.request}</span>
                  </div>
                </div>
              )}
              {act.type === 'result' && (
                <div className="flex items-start gap-2">
                  <Shield size={12} className={act.denied ? 'text-red-400 mt-0.5 shrink-0' : 'text-green-400 mt-0.5 shrink-0'} />
                  <div>
                    <span className="text-gray-400">→ </span>
                    <span className={act.denied ? 'text-red-300' : 'text-green-300'}>
                      {act.reply || act.reason || '已处理'}
                    </span>
                    {act.executed && act.commands?.length > 0 && (
                      <span className="text-gray-600 ml-1">
                        [{act.commands.join(', ')}]
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
