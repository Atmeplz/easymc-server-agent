export function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat('zh-CN', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

export function shortSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function parseJvmMemory(args = []) {
  const maxArg = args.find(arg => arg.startsWith('-Xmx'));
  if (!maxArg) return '';
  const raw = maxArg.replace('-Xmx', '').toUpperCase();
  if (raw.endsWith('G')) return String(Number(raw.replace('G', '')) * 1024);
  return raw.replace('M', '');
}

export function statusText(status) {
  if (status === 'running') return 'Running';
  if (status === 'starting') return 'Starting...';
  if (status === 'stopping') return 'Stopping...';
  return 'Stopped';
}
