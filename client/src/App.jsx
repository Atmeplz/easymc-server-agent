/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import useSocket from './hooks/useSocket.js';
import useDownloadQueue from './hooks/useDownloadQueue.js';
import useAgentStream from './hooks/useAgentStream.js';
import AgentStreamPage from './components/agent/AgentStreamPage.jsx';
import AgentToolsPage from './components/agent/AgentToolsPage.jsx';
import AgentPromptsPage from './components/agent/AgentPromptsPage.jsx';
import {
  Bot,
  Download,
  MessageCircle,
  Package,
  Plus,
  Puzzle,
  Radio,
  Server,
  Settings,
  SlidersHorizontal,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';

import { parseJvmMemory } from './utils/format.js';
import { resourceCountLabel } from './utils/download.js';
import { WELCOME_MESSAGES } from './constants/app.js';
import { SidebarLabel, SidebarButton, ThemeToggleButton, ConsoleStatusText } from './components/ui/SidebarControls.jsx';
import AgentChatPage from './components/chat/AgentChatPage.jsx';
import ServerConsolePage from './components/console/ServerConsolePage.jsx';
import ResourcePage from './components/resource/ResourcePage.jsx';
import BasicSetupPage from './components/setup/BasicSetupPage.jsx';
import DownloadCenterPage from './components/download/DownloadCenterPage.jsx';


export default function App() {
  const { connected, emit, on } = useSocket();
  const [mode, setMode] = useState('agent');
  const [page, setPage] = useState('agent-chat');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return window.localStorage.getItem('easymc-theme') === 'dark' ? 'dark' : 'light';
  });
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentStopping, setAgentStopping] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [welcomeIndex, setWelcomeIndex] = useState(0);

  const { messages: streamMessages, isTyping: streamTyping } = useAgentStream();
  const handleDownloadComplete = useCallback(() => {
    emit('plugin:list', {});
    emit('mod:list', {});
  }, [emit]);
  const { queue: downloadQueue, refresh: refreshDownloadQueue } = useDownloadQueue({ onComplete: handleDownloadComplete });

  const [serverStatus, setServerStatus] = useState('stopped');
  const [javaStatus, setJavaStatus] = useState(null);
  const [deployed, setDeployed] = useState(null);
  const [terminalLines, setTerminalLines] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');

  const [plugins, setPlugins] = useState([]);
  const [mods, setMods] = useState([]);
  const [pluginsLoading, setPluginsLoading] = useState(true);
  const [modsLoading, setModsLoading] = useState(true);

  const [properties, setProperties] = useState({});
  const [configForm, setConfigForm] = useState({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    serverDir: './mc-server',
    jvmMemory: '2048',
    javaPath: '',
  });
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupNotice, setSetupNotice] = useState('');

  const [agentTools, setAgentTools] = useState([]);
  const [agentPrompts, setAgentPrompts] = useState(null);
  const [terminalEncoding, setTerminalEncoding] = useState('gb2312');

  const currentWelcome = WELCOME_MESSAGES[welcomeIndex];

  const messagesEndRef = useRef(null);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('easymc-theme', theme);
  }, [theme]);

  // Sync terminal encoding to backend whenever it changes.
  useEffect(() => {
    if (connected) {
      emit('terminal:encoding', { encoding: terminalEncoding });
    }
  }, [terminalEncoding, connected, emit]);

  useEffect(() => {
    const unsubs = [
      on('server:status', ({ status }) => setServerStatus(status)),
      on('java:status', (status) => setJavaStatus(status)),
      on('deploy:is_deployed', ({ deployed: value }) => setDeployed(value)),
      on('deploy:complete', (result) => {
        if (result.success) setDeployed(true);
      }),
      on('terminal:history', ({ lines }) => setTerminalLines(lines || [])),
      on('terminal:output', ({ line }) => setTerminalLines(prev => [...prev.slice(-499), line])),
      on('plugin:list', ({ plugins: items }) => {
        setPlugins(items || []);
        setPluginsLoading(false);
      }),
      on('mod:list', ({ mods: items }) => {
        setMods(items || []);
        setModsLoading(false);
      }),
      on('chat:sessions', ({ sessions: items }) => setSessions(items || [])),
      on('chat:session_current', ({ session, sessions: items }) => {
        setActiveSession(session || null);
        if (items) setSessions(items);
      }),
      on('chat:reply', () => {
        setIsTyping(false);
        setAgentStopping(false);
        setActiveToolCall(null);
      }),
      on('chat:interrupted', () => {
        setIsTyping(false);
        setAgentStopping(false);
        setActiveToolCall(null);
        setPendingConfirm(null);
      }),
      on('chat:tool_call', (data) => {
        setIsTyping(true);
        setActiveToolCall({
          sessionId: data?.sessionId,
          tool: data?.tool,
          args: data?.args,
          startedAt: Date.now(),
        });
      }),
      on('agent:confirm_request', (data) => {
        setPendingConfirm(data);
        setIsTyping(false);
      }),
      on('agent:confirm_timeout', () => {
        setPendingConfirm(null);
        setIsTyping(false);
      }),
      on('chat:error', ({ error }) => {
        setSetupNotice(error || '操作失败');
        setIsTyping(false);
        setAgentStopping(false);
        setActiveToolCall(null);
      }),
    ];

    emit('java:check', {});
    emit('deploy:status', {});
    emit('plugin:list', {});
    emit('mod:list', {});
    emit('chat:sessions:list', {});
    loadSetup();
    loadAgentData();

    return () => unsubs.forEach(unsub => unsub());
  }, [emit, on]);

  const scrollChatToBottom = (behavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      }
    });
  };

  const scrollTerminalToBottom = (behavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      const container = terminalEndRef.current?.parentElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior });
      } else {
        terminalEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      }
    });
  };

  useEffect(() => {
    if (page !== 'agent-chat') return undefined;
    scrollChatToBottom('auto');
    const timer = window.setTimeout(() => scrollChatToBottom('auto'), 40);
    return () => window.clearTimeout(timer);
  }, [page, mode, activeSession?.id, activeSession?.messages?.length, isTyping]);

  useEffect(() => {
    if (page !== 'server-console') return undefined;
    scrollTerminalToBottom('auto');
    const timer = window.setTimeout(() => scrollTerminalToBottom('auto'), 40);
    return () => window.clearTimeout(timer);
  }, [page, mode, terminalLines.length]);

  const sessionMessages = activeSession?.messages || [];

  const activeNav = (target) =>
    page === target
      ? 'bg-md-primaryContainer text-md-onPrimaryContainer font-bold'
      : 'text-md-outline hover:bg-md-surfaceVariant/60';

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setPage(nextMode === 'agent' ? 'agent-chat' : 'server-console');
  };

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    setIsTyping(true);
    setAgentStopping(false);
    setActiveToolCall(null);
    emit('chat:message', { text, sessionId: activeSession?.id });
    setPage('agent-chat');
    setMode('agent');
  };

  const interruptAgent = () => {
    if (!isTyping && !pendingConfirm) return;
    setAgentStopping(true);
    emit('agent:interrupt', { sessionId: activeSession?.id });
  };

  const newSession = () => {
    setActiveSession(null);
    setChatInput('');
    setIsTyping(false);
    setAgentStopping(false);
    setActiveToolCall(null);
    setMode('agent');
    setPage('agent-chat');
    setPendingConfirm(null);
    setWelcomeIndex(() => Math.floor(Math.random() * WELCOME_MESSAGES.length));
  };

  const loadSession = (sessionId) => {
    emit('chat:session:load', { sessionId });
    setMode('agent');
    setPage('agent-chat');
    setPendingConfirm(null);
  };

  const deleteSession = (sessionId) => {
    emit('chat:session:delete', { sessionId });
  };

  const renameSession = (sessionId, title) => {
    emit('chat:session:rename', { sessionId, title });
  };

  const respondConfirm = (confirmed) => {
    if (!pendingConfirm) return;
    emit('agent:confirm_response', { confirmId: pendingConfirm.confirmId, confirmed });
    setPendingConfirm(null);
    if (confirmed) setIsTyping(true);
    if (confirmed) setActiveToolCall(null);
  };

  const sendTerminalCommand = () => {
    const command = terminalInput.trim();
    if (!command) return;
    emit('terminal:input', { command });
    setTerminalInput('');
  };

  async function loadSetup() {
    try {
      const [configResponse, propsResponse] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/server/properties'),
      ]);
      const cfg = await configResponse.json();
      const props = await propsResponse.json();

      setProperties(props.properties || {});
      setConfigForm(prev => ({
        ...prev,
        baseUrl: cfg.ai?.baseUrl || prev.baseUrl,
        model: cfg.ai?.model || prev.model,
        serverDir: cfg.mc?.serverDir || prev.serverDir,
        jvmMemory: parseJvmMemory(cfg.mc?.jvmArgs) || prev.jvmMemory,
        javaPath: cfg.java?.customPath || prev.javaPath || '',
      }));
    } catch (err) {
      setSetupNotice(`加载设置失败: ${err.message}`);
    }
  }

  async function loadAgentData() {
    try {
      const [toolsRes, promptsRes] = await Promise.all([
        fetch('/api/agent/tools'),
        fetch('/api/agent/prompts'),
      ]);
      const toolsData = await toolsRes.json();
      const promptsData = await promptsRes.json();
      setAgentTools(toolsData.tools || []);
      setAgentPrompts(promptsData);
    } catch (err) {
      console.error('加载 Agent 数据失败:', err);
    }
  }

  const saveSetup = async () => {
    setSetupSaving(true);
    setSetupNotice('');
    try {
      const configPayload = {
        ai: {
          baseUrl: configForm.baseUrl,
          model: configForm.model,
        },
        mc: {
          serverDir: configForm.serverDir,
          jvmArgs: [
            `-Xmx${configForm.jvmMemory}M`,
            `-Xms${Math.max(256, Math.floor(Number(configForm.jvmMemory || 512) / 2))}M`,
          ],
        },
      };
      if (configForm.apiKey.trim()) configPayload.ai.apiKey = configForm.apiKey.trim();
      if (configForm.javaPath.trim()) configPayload.mc.javaPath = configForm.javaPath.trim();

      const [configResult, propsResult] = await Promise.all([
        fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload),
        }).then(res => res.json()),
        fetch('/api/server/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties }),
        }).then(res => res.json()),
      ]);

      if (!configResult.success) throw new Error(configResult.error || '配置保存失败');
      if (!propsResult.success) throw new Error(propsResult.error || 'server.properties 保存失败');

      setConfigForm(prev => ({ ...prev, apiKey: '' }));
      setSetupNotice('已保存。部分服务器属性需要重启 Minecraft 服务后生效。');
    } catch (err) {
      setSetupNotice(err.message);
    } finally {
      setSetupSaving(false);
    }
  };

  const isRunning = serverStatus === 'running';
  const isBusy = serverStatus === 'starting' || serverStatus === 'stopping';
  const latestConsoleLine = terminalLines.length
    ? String(terminalLines[terminalLines.length - 1]).replace(/\s+/g, ' ').trim()
    : '';

  return (
    <div className="h-screen overflow-hidden bg-md-bg text-md-onPrimaryContainer">
      <div className="flex h-full gap-4 p-4">
        <aside className="w-72 shrink-0 rounded-[28px] bg-md-surface shadow-[0_4px_16px_rgba(62,0,30,0.10)] dark:shadow-[0_4px_18px_rgba(0,0,0,0.30)] flex flex-col p-4 gap-4 overflow-hidden">
          <div className="rounded-full bg-md-surfaceVariant/60 p-1 flex relative">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-md-primaryContainer duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                mode === 'agent' ? 'left-1' : 'right-1'
              }`}
            />
            <button
              onClick={() => switchMode('agent')}
              className={`relative z-10 flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1.5 ${
                mode === 'agent' ? 'font-bold text-md-onPrimaryContainer' : 'font-medium text-md-outline'
              }`}
            >
              <Bot size={16} /> Agent
            </button>
            <button
              onClick={() => switchMode('server')}
              className={`relative z-10 flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1.5 ${
                mode === 'server' ? 'font-bold text-md-onPrimaryContainer' : 'font-medium text-md-outline'
              }`}
            >
              <Server size={16} /> Server
            </button>
          </div>

          {mode === 'agent' ? (
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
              <SidebarLabel>Agent</SidebarLabel>
              <SidebarButton activeClass={activeNav('agent-chat')} onClick={() => setPage('agent-chat')} icon={MessageCircle}>
                Chat
              </SidebarButton>
              <SidebarButton activeClass={activeNav('agent-stream')} onClick={() => setPage('agent-stream')} icon={Radio}>
                Stream
              </SidebarButton>
              <SidebarButton activeClass={activeNav('agent-tools')} onClick={() => setPage('agent-tools')} icon={Wrench}>
                Tools
              </SidebarButton>
              <SidebarButton activeClass={activeNav('agent-prompts')} onClick={() => setPage('agent-prompts')} icon={SlidersHorizontal}>
                Prompt
              </SidebarButton>

              <SidebarLabel className="mt-3">Sessions</SidebarLabel>
              <button
                onClick={newSession}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold text-md-onPrimaryContainer bg-md-primaryContainer hover:shadow-sm transition mb-1"
              >
                <Plus size={16} /> Add a new one
              </button>
              {sessions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-md-outline">No saved sessions yet.</div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`group flex items-center gap-2 px-4 py-2.5 rounded-full text-sm text-left transition ${
                      activeSession?.id === session.id ? 'bg-md-surfaceContainer text-md-onPrimaryContainer shadow-sm font-bold' : 'text-md-outline hover:bg-md-surfaceVariant/60'
                    }`}
                  >
                    <span className="truncate flex-1">{session.title}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); deleteSession(session.id); } }}
                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center
                        [&>.dot]:block [&>.dot]:group-hover:hidden
                        [&>.xicon]:hidden [&>.xicon]:group-hover:flex
                        hover:bg-md-error/15 hover:text-md-error transition"
                      title="删除此会话"
                    >
                      <span className={`dot w-2 h-2 rounded-full ${activeSession?.id === session.id ? 'bg-md-primary' : 'bg-md-surfaceVariant'}`} />
                      <XCircle size={14} className="xicon" />
                    </span>
                  </button>
                ))
              )}
            </nav>
          ) : (
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
              <SidebarLabel>Server</SidebarLabel>
              <SidebarButton activeClass={activeNav('server-console')} onClick={() => setPage('server-console')} icon={Terminal}>
                Console
              </SidebarButton>
              <SidebarButton activeClass={activeNav('server-download')} onClick={() => setPage('server-download')} icon={Download}>
                Download
              </SidebarButton>
              <SidebarButton activeClass={activeNav('server-mods')} onClick={() => setPage('server-mods')} icon={Puzzle} count={resourceCountLabel(mods)}>
                Mods
              </SidebarButton>
              <SidebarButton activeClass={activeNav('server-plugins')} onClick={() => setPage('server-plugins')} icon={Package} count={resourceCountLabel(plugins)}>
                Plugins
              </SidebarButton>
              <SidebarButton activeClass={activeNav('server-setup')} onClick={() => setPage('server-setup')} icon={Settings}>
                Server Basic Setup
              </SidebarButton>
            </nav>
          )}

          <ThemeToggleButton theme={theme} onToggle={() => setTheme(current => (current === 'dark' ? 'light' : 'dark'))} />

          <div className="rounded-[28px] bg-md-surfaceContainer/85 px-5 py-4 text-sm text-md-outline shadow-sm">
            <div className="flex items-center justify-between">
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-md-success' : 'bg-md-error'}`} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-md-onPrimaryContainer min-w-0">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-md-success' : 'bg-md-outline'}`} />
              <ConsoleStatusText text={latestConsoleLine || 'Waiting for console output...'} />
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-hidden">
          {page === 'agent-chat' && (
            <AgentChatPage
              welcomeMessage={currentWelcome}
              messages={sessionMessages}
              activeSession={activeSession}
              isTyping={isTyping}
              activeToolCall={activeToolCall?.sessionId === activeSession?.id ? activeToolCall : null}
              pendingConfirm={pendingConfirm}
              chatInput={chatInput}
              setChatInput={setChatInput}
              sendMessage={sendMessage}
              respondConfirm={respondConfirm}
              interruptAgent={interruptAgent}
              agentStopping={agentStopping}
              renameSession={renameSession}
              messagesEndRef={messagesEndRef}
            />
          )}

          {page === 'agent-stream' && (
            <AgentStreamPage
              messages={streamMessages}
              isTyping={streamTyping}
              isRunning={isRunning}
              connected={connected}
            />
          )}

          {page === 'agent-tools' && (
            <AgentToolsPage tools={agentTools} />
          )}

          {page === 'agent-prompts' && (
            <AgentPromptsPage prompts={agentPrompts} onPromptsSaved={loadAgentData} />
          )}

          {page === 'server-console' && (
            <ServerConsolePage
              serverStatus={serverStatus}
              isBusy={isBusy}
              isRunning={isRunning}
              javaStatus={javaStatus}
              deployed={deployed}
              emit={emit}
              terminalLines={terminalLines}
              terminalInput={terminalInput}
              setTerminalInput={setTerminalInput}
              sendTerminalCommand={sendTerminalCommand}
              terminalEndRef={terminalEndRef}
              terminalEncoding={terminalEncoding}
              setTerminalEncoding={setTerminalEncoding}
            />
          )}

          {page === 'server-download' && (
            <DownloadCenterPage queue={downloadQueue} refreshQueue={refreshDownloadQueue} />
          )}

          {page === 'server-mods' && (
            <ResourcePage
              kind="mod"
              title="Mods"
              icon={Puzzle}
              items={mods}
              loading={modsLoading}
              emit={emit}
            />
          )}

          {page === 'server-plugins' && (
            <ResourcePage
              kind="plugin"
              title="Plugins"
              icon={Package}
              items={plugins}
              loading={pluginsLoading}
              emit={emit}
            />
          )}

          {page === 'server-setup' && (
            <BasicSetupPage
              properties={properties}
              setProperties={setProperties}
              configForm={configForm}
              setConfigForm={setConfigForm}
              javaStatus={javaStatus}
              setupSaving={setupSaving}
              setupNotice={setupNotice}
              saveSetup={saveSetup}
            />
          )}
        </main>
      </div>
    </div>
  );
}







