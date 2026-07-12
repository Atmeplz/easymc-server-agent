import { ChevronRight } from 'lucide-react';

export default function ChatInput({ value, onChange, onSubmit, autoFocus = false }) {
  return (
    <div className="w-full max-w-2xl mx-auto flex items-center gap-2 bg-md-primaryContainer/45 px-4 py-3 rounded-full border border-md-primaryContainer hover:border-md-primary focus-within:border-md-primary transition">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') onSubmit();
        }}
        placeholder="Ask me something ..."
        className="chat-input-field flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none text-sm text-md-onPrimaryContainer placeholder:text-md-outline/70"
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="w-9 h-9 rounded-full bg-md-primary disabled:bg-md-outline/40 text-md-onPrimary flex items-center justify-center shadow-sm transition"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
