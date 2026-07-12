import {
  Coffee,
  HardDrive,
  Play,
  Power,
  RotateCcw,
  Server,
  Square,
  Terminal,
  XCircle,
} from 'lucide-react';
import { statusText } from '../../utils/format.js';
import PageShell from '../ui/PageShell.jsx';
import ConsoleLine from './ConsoleLine.jsx';
import InfoTile from './InfoTile.jsx';
import ServerActionButton from './ServerActionButton.jsx';

export default function ServerConsolePage({
  serverStatus,
  isBusy,
  isRunning,
  javaStatus,
  deployed,
  emit,
  terminalLines,
  terminalInput,
  setTerminalInput,
  sendTerminalCommand,
  terminalEndRef,
  terminalEncoding,
  setTerminalEncoding,
}) {
  return (
    <PageShell
      title="Console"
      action={
        <div className="flex items-center gap-2">
          <ServerActionButton
            disabled={isBusy}
            onClick={() => emit(isRunning ? 'server:stop' : 'server:start')}
            icon={isRunning ? Square : Play}
            tone={isRunning ? 'danger' : 'success'}
          >
            {isRunning ? 'Stop' : serverStatus === 'starting' ? 'Starting...' : 'Start'}
          </ServerActionButton>
          {isRunning && (
            <ServerActionButton disabled={isBusy} onClick={() => emit('server:restart')} icon={RotateCcw} tone="warning">
              Restart
            </ServerActionButton>
          )}
          <button
            onClick={() => {
              if (confirm('确定要关闭 EasyMC Server Agent 吗？Minecraft 服务也会一并停止。')) {
                emit('app:shutdown', {});
              }
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-md-outline hover:bg-md-surfaceVariant hover:text-md-error transition"
            title="Shutdown app"
          >
            <Power size={18} />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 min-h-0 flex-1">
        <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-sm flex flex-col overflow-hidden min-h-0">
          <div className="h-12 px-4 flex items-center justify-between border-b border-md-surfaceVariant/70">
            <div className="font-bold text-sm flex items-center gap-2">
              <Terminal size={18} className="text-md-outline" /> Server Terminal
            </div>
            <div className="flex items-center gap-2">
              <select
                value={terminalEncoding}
                onChange={e => setTerminalEncoding(e.target.value)}
                className="text-xs bg-md-surfaceVariant/60 text-md-onPrimaryContainer rounded-full px-3 py-1 border-none outline-none cursor-pointer hover:bg-md-surfaceVariant transition"
                title="终端编码"
              >
                <option value="utf-8">UTF-8</option>
                <option value="gbk">GBK</option>
                <option value="gb2312">GB2312</option>
                <option value="big5">Big5</option>
                <option value="shift_jis">Shift-JIS</option>
                <option value="euc-kr">EUC-KR</option>
                <option value="latin-1">Latin-1</option>
              </select>
              <button onClick={() => setTerminalInput('')} className="w-8 h-8 rounded-full hover:bg-md-surfaceVariant/60 flex items-center justify-center text-md-outline">
                <XCircle size={16} />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-md-terminal p-4 font-mono text-sm overflow-y-auto space-y-1 text-gray-300 min-h-0">
            {terminalLines.length === 0 ? (
              <div className="text-gray-500">Waiting for server output...</div>
            ) : (
              terminalLines.map((line, index) => <ConsoleLine key={`${index}-${line}`} line={line} />)
            )}
            <div ref={terminalEndRef} />
          </div>
          <div className="p-3 border-t border-md-surfaceVariant/70 bg-md-surfaceContainer">
            <div className="flex items-center gap-2 bg-md-bg rounded-full px-3 py-2 border border-md-surfaceVariant focus-within:border-md-primary transition">
              <span className="text-md-outline text-sm font-mono">&gt;</span>
              <input
                value={terminalInput}
                onChange={event => setTerminalInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') sendTerminalCommand();
                }}
                placeholder="[your_command]"
                className="bg-transparent text-sm outline-none flex-1"
              />
              <button onClick={sendTerminalCommand} className="text-md-primary font-bold text-sm">Send</button>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {['tp', 'time set', 'gamemode', 'list'].map(command => (
                <button
                  key={command}
                  onClick={() => setTerminalInput(`${command} `)}
                  className="rounded-full px-3 py-1 text-xs font-bold bg-md-surfaceVariant/70 text-md-onPrimaryContainer hover:bg-md-surfaceVariant transition"
                >
                  /{command}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto">
          <InfoTile icon={Server} label="Server" value={statusText(serverStatus)} tone={isRunning ? 'success' : 'outline'} />
          <InfoTile icon={Coffee} label="Java" value={javaStatus?.found ? `Java ${javaStatus.javas?.[0]?.majorVersion}` : 'Not detected'} tone={javaStatus?.found ? 'success' : 'warning'} />
          <InfoTile icon={HardDrive} label="Deployment" value={deployed === false ? 'Not deployed' : deployed === true ? 'Ready' : 'Checking'} tone={deployed === false ? 'warning' : 'success'} />
        </div>
      </div>
    </PageShell>
  );
}
