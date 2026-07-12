export default function DownloadFilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold transition ${
        active
          ? 'bg-md-primary text-md-onPrimary shadow-sm'
          : 'bg-md-surfaceVariant/55 text-md-outline hover:bg-md-surfaceVariant'
      }`}
    >
      {children}
    </button>
  );
}
