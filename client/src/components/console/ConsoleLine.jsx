export default function ConsoleLine({ line }) {
  const isAgentLine = line.includes('@agent') || line.includes('[Agent]');
  const color = line.includes('ERROR') || line.includes('WARN')
    ? 'text-red-300'
    : line.includes('Done') || line.includes('INFO')
      ? 'text-green-300'
      : 'text-gray-300';
  return (
    <div
      className={`${color} whitespace-pre-wrap break-words rounded px-1 -mx-1 ${
        isAgentLine ? 'bg-md-primary/15 border border-md-primary/30' : ''
      }`}
    >
      {line}
    </div>
  );
}
