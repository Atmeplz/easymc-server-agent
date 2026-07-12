export default function DetailStat({ label, value }) {
  return (
    <div className="rounded-[18px] bg-md-bg border border-md-surfaceVariant px-3 py-2 min-w-0">
      <p className="text-[11px] text-md-outline">{label}</p>
      <p className="text-xs font-bold truncate">{value}</p>
    </div>
  );
}
