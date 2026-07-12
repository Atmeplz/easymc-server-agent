export default function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full relative transition-colors ${checked ? 'bg-md-primary' : 'bg-md-surfaceVariant'}`}
    >
      <span
        className={`absolute top-1 left-1 w-5 h-5 bg-md-onPrimary rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}
