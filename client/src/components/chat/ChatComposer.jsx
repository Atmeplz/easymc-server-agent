import { Loader2, XCircle } from 'lucide-react';
import ChatInput from './ChatInput.jsx';

export default function ChatComposer({ value, onChange, onSubmit, autoFocus = false, showStop, onStop, stopping }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {showStop && (
        <button
          onClick={onStop}
          disabled={stopping}
          className="absolute -top-14 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-md-errorContainer text-md-error shadow-sm transition hover:scale-[1.03] hover:bg-md-errorContainer/80 disabled:opacity-60 active:scale-95"
          title={stopping ? 'Stopping Agent...' : 'Stop Agent'}
          aria-label={stopping ? 'Stopping Agent' : 'Stop Agent'}
        >
          {stopping ? <Loader2 size={22} className="animate-spin" /> : <XCircle size={24} />}
        </button>
      )}
      <ChatInput value={value} onChange={onChange} onSubmit={onSubmit} autoFocus={autoFocus} />
    </div>
  );
}
