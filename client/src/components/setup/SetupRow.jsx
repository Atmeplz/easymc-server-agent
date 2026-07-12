export default function SetupRow({ label, hint, value, onChange, type = 'text' }) {
  return (
    <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant px-6 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-md-outline">{hint}</p>
      </div>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-40 md:w-72 px-3 py-2 text-sm bg-md-bg rounded-xl border border-md-surfaceVariant outline-none focus:border-md-primary transition"
      />
    </div>
  );
}
