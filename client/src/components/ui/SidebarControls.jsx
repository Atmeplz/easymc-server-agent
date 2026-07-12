import { Moon, Sun } from 'lucide-react';

export function SidebarLabel({ children, className = '' }) {
  return <div className={`px-3 py-2 text-xs font-bold text-md-outline uppercase tracking-wider ${className}`}>{children}</div>;
}

export function SidebarButton({ activeClass, onClick, icon: Icon, children, count }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition ${activeClass}`}>
      <Icon size={18} />
      <span>{children}</span>
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-md-surfaceVariant px-2.5 py-0.5 text-xs text-md-onPrimaryContainer">{count}</span>
      )}
    </button>
  );
}

export function ThemeToggleButton({ theme, onToggle }) {
  const isDark = theme === 'dark';
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      onClick={onToggle}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-md-primaryContainer text-md-onPrimaryContainer shadow-sm transition hover:scale-[1.03] hover:shadow-md focus:outline-none focus-visible:outline-none active:scale-95"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <Icon size={30} strokeWidth={1.8} />
    </button>
  );
}

export function ConsoleStatusText({ text }) {
  const shouldScroll = text.length > 28;
  if (!shouldScroll) {
    return <span className="min-w-0 truncate text-sm font-medium">{text}</span>;
  }

  return (
    <span className="console-status-mask text-sm font-medium" title={text}>
      <span className="console-status-track">
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </span>
    </span>
  );
}
