export default function Avatar({ icon: Icon, className }) {
  return (
    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-md-onPrimaryContainer ${className}`}>
      <Icon size={16} />
    </div>
  );
}
