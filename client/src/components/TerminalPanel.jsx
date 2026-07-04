/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as TerminalIcon, X } from 'lucide-react';

export default function TerminalPanel({ emit, on }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
      theme: {
        background: '#0f0f23',
        foreground: '#e0e0e0',
        cursor: '#55FFFF',
        cursorAccent: '#0f0f23',
        selectionBackground: '#1e3a5f',
        black: '#000000',
        red: '#FF5555',
        green: '#55FF55',
        yellow: '#FFAA00',
        blue: '#5555FF',
        magenta: '#FF55FF',
        cyan: '#55FFFF',
        white: '#BBBBBB',
        brightBlack: '#555555',
        brightRed: '#FF5555',
        brightGreen: '#55FF55',
        brightYellow: '#FFAA00',
        brightBlue: '#5555FF',
        brightMagenta: '#FF55FF',
        brightCyan: '#55FFFF',
        brightWhite: '#FFFFFF',
      },
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    term.loadAddon(fit);
    term.loadAddon(webLinks);

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fit.fit();
    }

    termInstance.current = term;
    fitAddon.current = fit;

    // Welcome message.
    term.writeln('\x1b[36m╔══════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m   \x1b[1;33m⛏️  EasyMC Server Agent Terminal\x1b[0m    \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m╚══════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90m  等待服务器启动...\x1b[0m');
    term.writeln('');

    // Listen for terminal output.
    const unsub = on('terminal:output', ({ line }) => {
      term.writeln(line);
    });

    // Listen for history payloads.
    const unsub2 = on('terminal:history', ({ lines }) => {
      term.clear();
      for (const line of lines) {
        term.writeln(line);
      }
    });

    // Refit the terminal when the window size changes.
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      unsub();
      unsub2();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [on]);

  const handleCommand = useCallback(() => {
    if (!inputValue.trim()) return;
    emit('terminal:input', { command: inputValue.trim() });
    setInputValue('');
  }, [inputValue, emit]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-mc-darker">
      {/* Terminal header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-mc-border shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-mc-green" />
          <span className="text-xs font-medium text-gray-300">服务器终端</span>
        </div>
        <button
          onClick={() => {
            if (termInstance.current) termInstance.current.clear();
          }}
          className="p-1 hover:bg-mc-panel rounded transition-colors text-gray-500 hover:text-gray-300"
          title="清屏"
        >
          <X size={14} />
        </button>
      </div>

      {/* Terminal area */}
      <div ref={terminalRef} className="flex-1 min-h-0" />

      {/* Command input bar */}
      <div className="border-t border-mc-border p-2 shrink-0">
        <div className="flex gap-2 items-center">
          <span className="text-mc-green text-sm font-mono">&gt;</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCommand();
              }
            }}
            placeholder="输入 MC 服务器命令..."
            className="flex-1 bg-transparent text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none"
          />
          <button
            onClick={handleCommand}
            disabled={!inputValue.trim()}
            className="px-3 py-1 text-xs bg-mc-green/20 hover:bg-mc-green/30 disabled:opacity-30 text-mc-green rounded-md transition-colors font-mono"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
