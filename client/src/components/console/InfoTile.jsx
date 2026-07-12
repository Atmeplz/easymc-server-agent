export default function InfoTile({ icon: Icon, label, value, tone }) {
  const toneClass = tone === 'success' ? 'text-md-success bg-md-successContainer' : tone === 'warning' ? 'text-md-warning bg-md-warningContainer' : 'text-md-outline bg-md-surface';
  return (
    <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 shadow-sm">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="mt-3 text-xs text-md-outline">{label}</p>
      <p className="text-sm font-bold text-md-onPrimaryContainer">{value}</p>
    </div>
  );
}
