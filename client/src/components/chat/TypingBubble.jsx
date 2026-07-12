import { Bot } from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';

export default function TypingBubble() {
  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-primaryContainer" icon={Bot} />
      <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-5 py-3 rounded-[24px] rounded-tl-md shadow-sm">
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '240ms' }} />
        </div>
      </div>
    </div>
  );
}
