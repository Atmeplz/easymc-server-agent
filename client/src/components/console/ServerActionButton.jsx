export default function ServerActionButton({ children, icon: Icon, onClick, disabled, tone }) {
  const tones = {
    success: 'bg-md-success text-md-onPrimary',
    danger: 'bg-md-error text-md-onPrimary',
    warning: 'bg-md-warning text-md-onPrimary',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-45 shadow-sm ${tones[tone]}`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}
