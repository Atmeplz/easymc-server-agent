/*
 * AI maintenance note: Keep all code comments in English.
 */
import { Play, Square, RotateCcw, Coffee } from 'lucide-react';

export default function ServerControls({ serverStatus, emit, javaStatus }) {
  const isRunning = serverStatus === 'running';
  const isStarting = serverStatus === 'starting';
  const isStopping = serverStatus === 'stopping';
  const isBusy = isStarting || isStopping;

  return (
    <div className="h-12 bg-mc-dark border-b border-mc-border flex items-center justify-between px-4 shrink-0">
      {/* Control buttons */}
      <div className="flex items-center gap-2">
        {!isRunning ? (
          <button
            onClick={() => emit('server:start')}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600/80 hover:bg-green-600 disabled:opacity-40 text-white rounded-md transition-colors"
          >
            <Play size={14} />
            {isStarting ? '启动中...' : '启动服务器'}
          </button>
        ) : (
          <>
            <button
              onClick={() => emit('server:stop')}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              <Square size={14} />
              {isStopping ? '关闭中...' : '停止'}
            </button>
            <button
              onClick={() => emit('server:restart')}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-40 text-white rounded-md transition-colors"
            >
              <RotateCcw size={14} />
              重启
            </button>
          </>
        )}
      </div>

      {/* Java status */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {javaStatus?.found ? (
          <div className="flex items-center gap-1.5">
            <Coffee size={14} className="text-mc-gold" />
            <span>Java {javaStatus.javas[0]?.majorVersion}</span>
            <span className="text-gray-600">({javaStatus.javas[0]?.source})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-yellow-500">
            <Coffee size={14} />
            <span>未检测到 Java</span>
          </div>
        )}
      </div>
    </div>
  );
}
