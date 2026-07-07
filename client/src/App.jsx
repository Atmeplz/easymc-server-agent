/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import useSocket from './hooks/useSocket.js';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Coffee,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Loader2,
  MessageCircle,
  Moon,
  Package,
  Play,
  Plus,
  Power,
  Puzzle,
  RotateCcw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  SlidersHorizontal,
  Square,
  Sun,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';

const SETUP_FIELDS = [
  { key: 'server-port', label: 'Server Port', hint: '服务器监听端口' },
  { key: 'max-players', label: 'Max Players', hint: '最大在线玩家数' },
  { key: 'gamemode', label: 'Game Mode', hint: '默认游戏模式' },
  { key: 'difficulty', label: 'Difficulty', hint: '世界难度' },
  { key: 'motd', label: 'MOTD', hint: '服务器列表简介' },
  { key: 'online-mode', label: 'Online Mode', hint: '正版验证开关' },
  { key: 'enable-command-block', label: 'Command Blocks', hint: '命令方块开关' },
  { key: 'view-distance', label: 'View Distance', hint: '视距区块数' },
];

const PARKED_FEATURES = [
  { title: 'Downloading', desc: '下载队列与历史页。部署、插件、Mod 下载事件之后可统一汇总到这里。', icon: Download },
  { title: 'Workspace Browser', desc: '工作区文件浏览器仍有旧实现，后续可迁入 Material You 列表。', icon: Database },
  { title: 'Player @agent Activity', desc: '游戏内玩家请求活动流，后续可做为 Agent 子页面展示。', icon: Activity },
];

const WELCOME_MESSAGES = [
  'Hello! What can I do for you?',
  'Ready to build something amazing?',
  'Need help with your server today?',
  'What are we working on?',
  'How can I assist your Minecraft world?',
  'Got a server task in mind?',
  "Let's make your server better.",
  'What would you like to explore?',
  'Your server assistant is here.',
  'Ask me anything about EasyMC.',
  'What should we set up first?',
  'Ready when you are.',
];

const DOWNLOAD_TYPES = ['Mods', 'Plugins', 'Server Core'];
const DOWNLOAD_SOURCE_OPTIONS = [
  { value: 'modrinth', label: 'Modrinth' },
  { value: 'core', label: 'Server Core' },
  { value: 'curseforge', label: 'CurseForge' },
  { value: 'hangar', label: 'Hangar' },
  { value: 'spiget', label: 'Spiget' },
];

const DOWNLOAD_RESOURCES = [
  {
    id: 'paper-121',
    type: 'Server Core',
    source: 'PaperMC',
    name: 'Paper 1.21.1',
    summary: 'High-performance Bukkit-compatible Minecraft server core.',
    version: '1.21.1 build 132',
    loader: 'Paper',
    target: 'server.jar',
    size: '48.6 MB',
    downloads: 'Core',
    updated: '2026-07-02',
    status: 'Verified',
    icon: Server,
    tags: ['Bukkit API', 'Plugins', 'Performance'],
    details: 'Recommended default server core for plugin-based servers. This sample does not replace your current server files.',
  },
  {
    id: 'fabric-api',
    type: 'Mods',
    source: 'Modrinth',
    name: 'Fabric API',
    summary: 'Core hooks and shared APIs required by many Fabric mods.',
    version: '0.101.2+1.21',
    loader: 'Fabric',
    target: 'mods/',
    size: '2.4 MB',
    downloads: '92M',
    updated: '2026-06-28',
    status: 'Hash available',
    icon: Puzzle,
    tags: ['Dependency', 'Fabric', 'Client+Server'],
    details: 'Common dependency for Fabric servers. The real version resolver will later filter files by Minecraft version and loader.',
  },
  {
    id: 'lithium',
    type: 'Mods',
    source: 'Modrinth',
    name: 'Lithium',
    summary: 'General-purpose server optimization mod without gameplay changes.',
    version: '0.14.8',
    loader: 'Fabric',
    target: 'mods/',
    size: '790 KB',
    downloads: '39M',
    updated: '2026-06-19',
    status: 'Verified',
    icon: Puzzle,
    tags: ['Optimization', 'Server-side', 'Fabric'],
    details: 'Safe performance sample. The final implementation should show dependency and compatibility warnings here.',
  },
  {
    id: 'spark',
    type: 'Plugins',
    source: 'Hangar',
    name: 'spark',
    summary: 'Performance profiler for Minecraft clients, servers, and proxies.',
    version: '1.10.142',
    loader: 'Paper',
    target: 'plugins/',
    size: '3.1 MB',
    downloads: '8M',
    updated: '2026-06-14',
    status: 'Verified',
    icon: Package,
    tags: ['Profiler', 'Diagnostics', 'Paper'],
    details: 'Useful for diagnosing lag. This page only queues a sample item and does not download the plugin yet.',
  },
  {
    id: 'luckperms',
    type: 'Plugins',
    source: 'Modrinth',
    name: 'LuckPerms',
    summary: 'Permissions management plugin for Bukkit, Sponge, Nukkit, and proxies.',
    version: '5.4.158',
    loader: 'Bukkit',
    target: 'plugins/',
    size: '1.7 MB',
    downloads: '24M',
    updated: '2026-05-31',
    status: 'Verified',
    icon: Package,
    tags: ['Permissions', 'Administration', 'Bukkit'],
    details: 'A common server administration plugin. The backend version will ask before replacing existing jars.',
  },
  {
    id: 'purpur-121',
    type: 'Server Core',
    source: 'Purpur',
    name: 'Purpur 1.21.1',
    summary: 'Paper fork with extra gameplay and configuration options.',
    version: '1.21.1 build 2329',
    loader: 'Purpur',
    target: 'server.jar',
    size: '49.2 MB',
    downloads: 'Core',
    updated: '2026-06-25',
    status: 'Mirror ready',
    icon: HardDrive,
    tags: ['Paper fork', 'Configurable', 'Plugins'],
    details: 'Good when you need more server-side toggles than Paper. Core replacement will be a confirmed operation later.',
  },
];

function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat('zh-CN', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

function shortSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isSubsequence(needle, haystack) {
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function levenshteinDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + (left[i] === right[j] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function matchesFuzzyQuery(query, fields) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const normalizedFields = fields.map(normalizeSearchText).filter(Boolean);
  const haystack = normalizedFields.join(' ');
  const compactHaystack = haystack.replace(/\s+/g, '');
  const words = haystack.split(/\s+/).filter(Boolean);

  return tokens.every(token => {
    if (haystack.includes(token) || isSubsequence(token, compactHaystack)) return true;
    const maxDistance = token.length > 5 ? 2 : 1;
    return words.some(word => Math.abs(word.length - token.length) <= maxDistance && levenshteinDistance(token, word) <= maxDistance);
  });
}

function resourceCountLabel(items = []) {
  const enabled = items.filter(item => item.enabled === true || String(item.status || '').toLowerCase() === 'enabled').length;
  return `${enabled}/${items.length}`;
}

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
      on('chat:error', ({ error }) => setSetupNotice(error || '操作失败')),
      on('chat:error', () => {
        setIsTyping(false);
        setAgentStopping(false);
        setActiveToolCall(null);
      }),
      on('download:queue', ({ queue: items }) => {
        window.dispatchEvent(new CustomEvent('easymc:download-queue', { detail: items || [] }));
      }),
      on('download:progress', (item) => {
        window.dispatchEvent(new CustomEvent('easymc:download-item', { detail: item }));
      }),
      on('download:complete', () => {
        emit('plugin:list', {});
        emit('mod:list', {});
      }),
      on('download:error', (item) => {
        window.dispatchEvent(new CustomEvent('easymc:download-item', { detail: item }));
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
            <DownloadCenterPage />
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

function SidebarLabel({ children, className = '' }) {
  return <div className={`px-3 py-2 text-xs font-bold text-md-outline uppercase tracking-wider ${className}`}>{children}</div>;
}

function SidebarButton({ activeClass, onClick, icon: Icon, children, count }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition ${activeClass}`}>
      <Icon size={18} />
      <span>{children}</span>
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-md-surfaceVariant px-2.5 py-0.5 text-xs text-md-onPrimaryContainer">{count}</span>
      )}
    </button>
  );
}

function ThemeToggleButton({ theme, onToggle }) {
  const isDark = theme === 'dark';
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      onClick={onToggle}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-md-primaryContainer text-md-onPrimaryContainer shadow-sm transition hover:scale-[1.03] hover:shadow-md focus:outline-none focus-visible:outline-none active:scale-95"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <Icon size={30} strokeWidth={1.8} />
    </button>
  );
}

function ConsoleStatusText({ text }) {
  const shouldScroll = text.length > 28;
  if (!shouldScroll) {
    return <span className="min-w-0 truncate text-sm font-medium">{text}</span>;
  }

  return (
    <span className="console-status-mask text-sm font-medium" title={text}>
      <span className="console-status-track">
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </span>
    </span>
  );
}

function PageShell({ title, children, action }) {
  return (
    <section className="material-page h-full flex flex-col overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 pb-4">
          {title && <h1 className="text-3xl font-medium text-md-primary">{title}</h1>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function AgentChatPage({
  welcomeMessage,
  messages,
  activeSession,
  isTyping,
  activeToolCall,
  pendingConfirm,
  chatInput,
  setChatInput,
  sendMessage,
  respondConfirm,
  interruptAgent,
  agentStopping,
  renameSession,
  messagesEndRef,
}) {
  const isEmpty = messages.length === 0;
  const chatItems = useMemo(() => buildChatItems(messages), [messages]);
  const lastChatItem = chatItems[chatItems.length - 1];
  const hasRunningToolGroup = isTyping && lastChatItem?.kind === 'toolGroup';
  const showStopAgent = isTyping || pendingConfirm;
  const [draftTitle, setDraftTitle] = useState(activeSession?.title || 'Chat');
  const [editingTitle, setEditingTitle] = useState(false);
  const tokenCount = Number(activeSession?.usage?.total_tokens || 0);

  useEffect(() => {
    setDraftTitle(activeSession?.title || 'Chat');
    setEditingTitle(false);
  }, [activeSession?.id, activeSession?.title]);

  const saveTitle = () => {
    if (!activeSession?.id) return;
    const nextTitle = draftTitle.trim() || 'New chat';
    setDraftTitle(nextTitle);
    setEditingTitle(false);
    if (nextTitle !== activeSession.title) {
      renameSession(activeSession.id, nextTitle);
    }
  };

  return (
    <section className="material-page h-full flex flex-col overflow-hidden">
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <h1 className="text-4xl md:text-5xl font-medium text-md-primary text-center mb-8">{welcomeMessage}</h1>
          <ChatComposer
            value={chatInput}
            onChange={setChatInput}
            onSubmit={sendMessage}
            autoFocus
            showStop={showStopAgent}
            onStop={interruptAgent}
            stopping={agentStopping}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pb-4">
            <div>
              {editingTitle ? (
                <input
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      setDraftTitle(activeSession?.title || 'Chat');
                      setEditingTitle(false);
                    }
                  }}
                  className="max-w-[24rem] rounded-2xl bg-md-surfaceContainer px-2 py-1 text-3xl font-medium text-md-primary outline-none border border-md-primary"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="max-w-[24rem] truncate rounded-2xl px-1 py-1 text-left text-3xl font-medium text-md-primary hover:bg-md-surfaceVariant/40 focus:outline-none focus-visible:outline-none"
                  title="Rename chat"
                >
                  {activeSession?.title || 'Chat'}
                </button>
              )}
              {tokenCount > 0 && (
                <p className="text-xs text-md-outline mt-1">{tokenCount.toLocaleString()} tokens used</p>
              )}
              <p className="text-xs text-md-outline mt-1">{messages.length} messages · {formatDate(activeSession?.updatedAt)}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-4 space-y-5">
            {chatItems.map(item => (
              item.kind === 'toolGroup' ? (
                <ToolActivityMessage
                  key={item.id}
                  tools={item.tools}
                  isRunning={isTyping && item.id === lastChatItem?.id}
                  activeToolCall={isTyping && item.id === lastChatItem?.id ? activeToolCall : null}
                />
              ) : (
                <ChatMessage key={item.message.id} message={item.message} pendingConfirm={pendingConfirm} respondConfirm={respondConfirm} />
              )
            ))}
            {isTyping && !hasRunningToolGroup && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>
          <div className="pb-2">
            <ChatComposer
              value={chatInput}
              onChange={setChatInput}
              onSubmit={sendMessage}
              showStop={showStopAgent}
              onStop={interruptAgent}
              stopping={agentStopping}
            />
          </div>
        </>
      )}
    </section>
  );
}

function buildChatItems(messages) {
  const items = [];
  let toolGroup = null;

  messages.forEach((message) => {
    if (message.role === 'tool') {
      if (!toolGroup) {
        toolGroup = {
          kind: 'toolGroup',
          id: `tool-group-${message.id || message.timestamp || items.length}`,
          tools: [],
        };
        items.push(toolGroup);
      }
      toolGroup.tools.push(message);
      return;
    }

    toolGroup = null;
    items.push({
      kind: 'message',
      id: message.id,
      message,
    });
  });

  return items;
}

function ChatComposer({ value, onChange, onSubmit, autoFocus = false, showStop, onStop, stopping }) {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {showStop && (
        <button
          onClick={onStop}
          disabled={stopping}
          className="absolute -top-14 left-1/2 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-md-errorContainer text-md-error shadow-sm transition hover:scale-[1.03] hover:bg-md-errorContainer/80 disabled:opacity-60 active:scale-95"
          title={stopping ? 'Stopping Agent...' : 'Stop Agent'}
          aria-label={stopping ? 'Stopping Agent' : 'Stop Agent'}
        >
          {stopping ? <Loader2 size={22} className="animate-spin" /> : <XCircle size={24} />}
        </button>
      )}
      <ChatInput value={value} onChange={onChange} onSubmit={onSubmit} autoFocus={autoFocus} />
    </div>
  );
}

function ChatInput({ value, onChange, onSubmit, autoFocus = false }) {
  return (
    <div className="w-full max-w-2xl mx-auto flex items-center gap-2 bg-md-primaryContainer/45 px-4 py-3 rounded-full border border-md-primaryContainer hover:border-md-primary focus-within:border-md-primary transition">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') onSubmit();
        }}
        placeholder="Ask me something ..."
        className="chat-input-field flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none text-sm text-md-onPrimaryContainer placeholder:text-md-outline/70"
      />
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="w-9 h-9 rounded-full bg-md-primary disabled:bg-md-outline/40 text-md-onPrimary flex items-center justify-center shadow-sm transition"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function ToolActivityMessage({ tools, isRunning, activeToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const latestTool = tools[tools.length - 1];
  const currentToolName = activeToolCall?.tool || latestTool?.tool || 'working';
  const statusLabel = isRunning ? `Agent: ${currentToolName}` : 'Agent: Done!';

  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-secondaryContainer" icon={Wrench} />
      <div className="max-w-[80%]">
        <div className="bg-md-secondaryContainer/70 px-4 py-2.5 rounded-[20px] rounded-tl-md text-sm shadow-sm">
          <div className="flex items-center gap-2 font-bold text-md-onSecondaryContainer">
            <Wrench size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{statusLabel}</span>
            {isRunning ? (
              <Loader2 size={16} className="text-md-primary shrink-0 animate-spin" />
            ) : (
              <CheckCircle size={16} className="text-md-success shrink-0" />
            )}
            <button
              onClick={() => setExpanded(value => !value)}
              className="ml-1 h-7 w-7 rounded-full text-md-outline hover:bg-md-surfaceVariant/70 hover:text-md-onSecondaryContainer transition flex items-center justify-center shrink-0"
              title={expanded ? 'Collapse tool details' : 'Expand tool details'}
              aria-expanded={expanded}
            >
              <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {expanded && (
          <div className="mt-2 rounded-[18px] border border-md-surfaceVariant bg-md-surfaceContainer/70 px-3 py-2 text-xs text-md-outline shadow-sm">
            <div className="space-y-2">
              {tools.map((tool, index) => (
                <div key={tool.id || `${tool.tool}-${index}`} className="rounded-[14px] bg-md-surface/70 px-3 py-2">
                  <div className="flex items-center gap-2 font-bold text-md-onPrimaryContainer">
                    <CheckCircle size={13} className="text-md-success shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tool.tool}</span>
                  </div>
                  {tool.args && (
                    <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-md-outline whitespace-pre-wrap">
                      {JSON.stringify(tool.args, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ message, pendingConfirm, respondConfirm }) {
  const [toolExpanded, setToolExpanded] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end chat-message">
        <div className="max-w-[72%]">
          <div className="bg-md-primary text-md-onPrimary px-5 py-3 rounded-[24px] rounded-tr-md text-sm leading-relaxed shadow-sm whitespace-pre-wrap">
            {message.content}
          </div>
          <p className="text-[10px] text-md-outline mt-1 text-right">{formatTime(message.timestamp)}</p>
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex gap-3 chat-message">
        <Avatar className="bg-md-secondaryContainer" icon={Wrench} />
        <div className="max-w-[80%] bg-md-secondaryContainer/70 px-4 py-2.5 rounded-[20px] rounded-tl-md text-sm shadow-sm">
          <div className="flex items-center gap-2 font-bold text-md-onSecondaryContainer">
            <Wrench size={15} />
            <span className="min-w-0 flex-1 truncate">Agent : {message.tool}</span>
            <CheckCircle size={15} className="text-md-success shrink-0" />
            {message.args && (
              <button
                onClick={() => setToolExpanded(expanded => !expanded)}
                className="ml-1 h-7 w-7 rounded-full text-md-outline hover:bg-md-surfaceVariant/70 hover:text-md-onSecondaryContainer transition flex items-center justify-center shrink-0"
                title={toolExpanded ? 'Collapse tool details' : 'Expand tool details'}
                aria-expanded={toolExpanded}
              >
                <ChevronDown size={16} className={`transition-transform ${toolExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          {message.args && toolExpanded && (
            <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-md-outline whitespace-pre-wrap">
              {JSON.stringify(message.args, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (message.role === 'confirm') {
    const active = pendingConfirm?.confirmId === message.confirmId;
    return (
      <div className="flex gap-3 chat-message">
        <Avatar className="bg-md-errorContainer text-md-error" icon={AlertTriangle} />
        <div className="max-w-[80%] bg-md-surfaceContainer border border-md-error/30 px-5 py-3 rounded-[24px] rounded-tl-md text-sm shadow-sm">
          <p className="font-bold text-md-error">高危命令确认</p>
          <p className="mt-1">Command: <code className="rounded bg-md-errorContainer px-1.5 py-0.5 text-xs text-md-error">{message.command}</code></p>
          <p className="mt-1 text-xs text-md-outline">{message.reason}</p>
          {active ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => respondConfirm(true)} className="rounded-full bg-md-error px-4 py-1.5 text-xs font-bold text-md-onPrimary">
                Continue
              </button>
              <button onClick={() => respondConfirm(false)} className="rounded-full bg-md-surfaceVariant px-4 py-1.5 text-xs font-bold text-md-onPrimaryContainer">
                Cancel
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-md-outline">Waiting state ended.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-primaryContainer" icon={Bot} />
      <div className="max-w-[72%]">
        <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-5 py-3 rounded-[24px] rounded-tl-md text-sm leading-relaxed text-md-onPrimaryContainer shadow-sm whitespace-pre-wrap">
          {message.content}
        </div>
        <p className="text-[10px] text-md-outline mt-1">{formatTime(message.timestamp)}</p>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-3 chat-message">
      <Avatar className="bg-md-primaryContainer" icon={Bot} />
      <div className="bg-md-surfaceContainer border border-md-surfaceVariant px-5 py-3 rounded-[24px] rounded-tl-md shadow-sm">
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-md-outline animate-bounce" style={{ animationDelay: '240ms' }} />
        </div>
      </div>
    </div>
  );
}

function Avatar({ icon: Icon, className }) {
  return (
    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-md-onPrimaryContainer ${className}`}>
      <Icon size={16} />
    </div>
  );
}

function decorateDownloadResource(resource) {
  const type = resource.type || 'Mods';
  const source = resource.source || resource.sourceName || 'local';
  const categories = resource.categories || resource.loaders || [];
  const icon = type === 'Server Core' ? Server : type === 'Plugins' ? Package : Puzzle;
  return {
    id: `${source}:${resource.sourceId || resource.slug || resource.name}`,
    source,
    sourceName: resource.sourceName || resource.source || 'Local',
    sourceId: resource.sourceId || resource.slug || resource.id,
    slug: resource.slug,
    type,
    name: resource.name,
    summary: resource.summary || 'No summary is available.',
    version: resource.gameVersions?.[0] || resource.version || 'latest',
    loader: resource.loaders?.[0] || resource.loader || 'Any',
    target: type === 'Plugins' ? 'plugins/' : type === 'Mods' ? 'mods/' : 'server.jar',
    size: resource.downloads ? `${resource.downloads.toLocaleString?.() || resource.downloads} downloads` : 'unknown',
    downloads: resource.downloads || '',
    updated: resource.updatedAt || resource.updated || '',
    status: resource.status || 'API',
    icon,
    iconUrl: resource.iconUrl || resource.icon_url || '',
    tags: categories.slice(0, 4),
    details: resource.descriptionHtml || resource.summary || 'No details are available.',
  };
}

function DownloadCenterPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Mods');
  const [source, setSource] = useState('All');
  const [sources, setSources] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState('');

  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
  const backendConnected = sources.some(item => item.enabled);
  const catalogReady = sourcesLoaded && searchLoaded;

  useEffect(() => {
    let cancelled = false;
    setSourcesLoaded(false);
    fetch('/api/download/sources')
      .then(response => response.json())
      .then(data => {
        if (!cancelled) {
          setSources(data.sources || []);
          setSourcesLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSources([]);
          setSourcesLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setDownloadNotice('');
      try {
        const params = new URLSearchParams({
          query,
          type,
          source,
        });
        const response = await fetch(`/api/download/search?${params.toString()}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.errors?.[0] || 'Download search failed.');
        const nextResources = (data.results || []).map(decorateDownloadResource);
        setResources(nextResources.length ? nextResources : DOWNLOAD_RESOURCES);
        if (data.errors?.length) setDownloadNotice(data.errors.join(' | '));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setDownloadNotice(`Download search unavailable: ${err.message}`);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setSearchLoaded(true);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, type, source]);

  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      const matchesQuery = matchesFuzzyQuery(query, [
        resource.name,
        resource.summary,
        resource.sourceName,
        resource.source,
        resource.type,
        ...(resource.tags || []),
      ]);
      const matchesType = resource.type === type;
      const sourceKey = source.toLowerCase();
      const matchesSource = source === 'All'
        || resource.source?.toLowerCase() === sourceKey
        || resource.sourceName?.toLowerCase() === sourceKey;
      return matchesQuery && matchesType && matchesSource;
    });
  }, [query, type, source, resources]);

  const selectedResource = filteredResources.find(resource => resource.id === selectedId) || filteredResources[0] || null;
  const selectedDownloadItem = selectedResource
    ? queue.find(item => item.projectId === selectedResource.sourceId || item.id === selectedResource.id) || null
    : null;
  const sourceOptions = useMemo(() => {
    const enabledSources = sources
      .filter(item => item.enabled)
      .map(item => ({ value: item.id, label: item.name }));
    const fallbackSources = DOWNLOAD_SOURCE_OPTIONS;
    const merged = new Map([['All', { value: 'All', label: 'All' }]]);
    for (const option of [...enabledSources, ...fallbackSources]) merged.set(option.value, option);
    return Array.from(merged.values());
  }, [sources]);

  useEffect(() => {
    if (!selectedResource?.sourceId) {
      setFiles([]);
      return;
    }

    const controller = new AbortController();
    setFilesLoading(true);
    setSelectedFileId('');
    fetch(`/api/download/project/${selectedResource.source}/${encodeURIComponent(selectedResource.sourceId)}/files`, { signal: controller.signal })
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Failed to load files.');
        setFiles(data.files || []);
        setSelectedFileId(data.files?.[0]?.fileId || '');
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setFiles([]);
          setDownloadNotice(err.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilesLoading(false);
      });

    return () => controller.abort();
  }, [selectedResource?.source, selectedResource?.sourceId]);

  const refreshQueue = async () => {
    try {
      const response = await fetch('/api/download/queue');
      const data = await response.json();
      setQueue(data.queue || []);
    } catch {
      setQueue([]);
    }
  };

  useEffect(() => {
    refreshQueue();

    const handleQueue = (event) => {
      setQueue(event.detail || []);
    };
    const handleItem = (event) => {
      const item = event.detail;
      if (!item?.id) return;
      setQueue(current => {
        const index = current.findIndex(entry => entry.id === item.id);
        if (index === -1) return [item, ...current];
        const next = [...current];
        next[index] = item;
        return next;
      });
    };

    window.addEventListener('easymc:download-queue', handleQueue);
    window.addEventListener('easymc:download-item', handleItem);
    return () => {
      window.removeEventListener('easymc:download-queue', handleQueue);
      window.removeEventListener('easymc:download-item', handleItem);
    };
  }, []);

  const installSelected = async () => {
    if (!selectedResource || selectedResource.type === 'Server Core') {
      setDownloadNotice('Server core installation is available in the backend but requires an explicit confirmed flow.');
      return;
    }

    const selectedFile = files.find(file => file.fileId === selectedFileId) || files[0];
    if (!selectedFile) {
      setDownloadNotice('No compatible file is selected.');
      return;
    }

    setInstalling(true);
    setDownloadNotice('');
    try {
      const response = await fetch('/api/download/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: selectedResource.source,
          projectId: selectedResource.sourceId,
          fileId: selectedFile.fileId,
          type: selectedResource.type,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Install failed.');
      setDownloadNotice(`${selectedResource.name} installed to ${data.result?.fileName || selectedResource.target}.`);
      await refreshQueue();
    } catch (err) {
      setDownloadNotice(err.message);
      await refreshQueue();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <PageShell
      title="Download"
      action={
        <div className="rounded-full bg-md-primaryContainer/65 px-4 py-2 text-xs font-bold text-md-onPrimaryContainer flex items-center gap-2">
          <CheckCircle size={15} /> {backendConnected ? 'Backend connected' : 'Connecting...'}
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 min-h-0 flex-1">
        <aside className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-sm p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Search</p>
            <div className="flex items-center gap-2 rounded-full border border-md-surfaceVariant bg-md-bg px-3 py-2 focus-within:border-md-primary transition">
              <Search size={16} className="text-md-outline shrink-0" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Core, mod, plugin..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-md-outline"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {DOWNLOAD_TYPES.map(option => (
                <DownloadFilterButton key={option} active={type === option} onClick={() => setType(option)}>
                  {option}
                </DownloadFilterButton>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-md-outline uppercase mb-2">Source</p>
            <select
              value={source}
              onChange={event => setSource(event.target.value)}
              className="w-full rounded-full border border-md-surfaceVariant bg-md-bg px-4 py-2 text-sm outline-none focus:border-md-primary"
            >
              {sourceOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-[20px] bg-md-primaryContainer/45 px-4 py-3">
            <p className="text-sm font-bold text-md-onPrimaryContainer">Resource catalog</p>
            <p className="text-xs text-md-outline mt-1 leading-relaxed">
              {backendConnected
                ? 'Backend connected. Search results come from live download sources.'
                : 'Waiting for backend connection to load the resource catalog.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-md-outline uppercase">Sources</p>
            {(sources.length ? sources : sourceOptions.filter(item => item.value !== 'All').map(item => ({ id: item.value, name: item.label, enabled: item.value !== 'CurseForge' }))).map(item => (
              <div key={item.id || item.name} className="flex items-center justify-between rounded-full bg-md-surfaceVariant/45 px-3 py-2 text-xs">
                <span className="font-bold">{item.name}</span>
                <span className={item.enabled ? 'text-md-success' : 'text-md-outline'}>{item.enabled ? 'ready' : 'off'}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-h-0 flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-md-outline">Results</p>
              <p className="text-sm font-bold">{loading ? 'Searching...' : `${filteredResources.length} resources found`}</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-md-outline">
              <span className="rounded-full bg-md-surfaceContainer px-3 py-1 border border-md-surfaceVariant">1.21.x</span>
              <span className="rounded-full bg-md-surfaceContainer px-3 py-1 border border-md-surfaceVariant">Server-ready</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {!catalogReady || loading ? (
              <div className="h-full rounded-[24px] border border-dashed border-md-surfaceVariant bg-md-surfaceContainer flex flex-col items-center justify-center text-center p-8">
                <Loader2 size={36} className="text-md-primary animate-spin mb-3" />
                <h3 className="text-lg font-bold">Loading resources</h3>
                <p className="text-sm text-md-outline mt-1">Please wait while the catalog is fetched.</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="h-full rounded-[24px] border border-dashed border-md-surfaceVariant bg-md-surfaceContainer flex flex-col items-center justify-center text-center p-8">
                <Download size={34} className="text-md-outline mb-3" />
                <h3 className="text-lg font-bold">No resources found</h3>
                <p className="text-sm text-md-outline mt-1">Try another type, All sources, or a shorter search term.</p>
              </div>
            ) : (
              filteredResources.map(resource => {
                const resourceDownloadItem = queue.find(item => item.projectId === resource.sourceId || item.id === resource.id);
                return (
                  <DownloadResultItem
                    key={resource.id}
                    resource={resource}
                    active={selectedResource?.id === resource.id}
                    installStatus={resourceDownloadItem?.status || ''}
                    onSelect={() => setSelectedId(resource.id)}
                    onQueue={() => setSelectedId(resource.id)}
                  />
                );
              })
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto space-y-3">
          <DownloadDetailsPanel
            resource={selectedResource}
            files={files}
            filesLoading={filesLoading}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
            downloadItem={selectedDownloadItem}
            installing={installing}
            notice={downloadNotice}
            onQueue={installSelected}
          />
        </aside>
      </div>
    </PageShell>
  );
}

function DownloadFilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold transition ${
        active
          ? 'bg-md-primary text-md-onPrimary shadow-sm'
          : 'bg-md-surfaceVariant/55 text-md-outline hover:bg-md-surfaceVariant'
      }`}
    >
      {children}
    </button>
  );
}

function ResourceIcon({ resource, className = '', iconClassName = '', imageClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const Icon = resource.icon;
  const showImage = resource.iconUrl && !failed;

  useEffect(() => {
    setFailed(false);
  }, [resource.iconUrl]);

  return (
    <div className={`overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {showImage ? (
        <img
          src={resource.iconUrl}
          alt=""
          className={`h-full w-full object-cover ${imageClassName}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon size={26} className={iconClassName} />
      )}
    </div>
  );
}

function DownloadResultItem({ resource, active, installStatus, onSelect, onQueue }) {
  const installed = installStatus === 'complete';
  const installingResource = installStatus === 'queued' || installStatus === 'running';
  return (
    <article
      className={`rounded-[24px] border p-4 shadow-sm transition ${
        active
          ? 'bg-md-primaryContainer/55 border-md-primary'
          : 'bg-md-surfaceContainer border-md-surfaceVariant hover:border-md-primary/50'
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          onClick={onSelect}
          className="h-14 w-14 rounded-2xl bg-md-primaryContainer text-md-onPrimaryContainer flex items-center justify-center shrink-0 overflow-hidden"
          title={`Inspect ${resource.name}`}
        >
          <ResourceIcon resource={resource} className="h-full w-full" />
        </button>
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base">{resource.name}</h3>
            <SourceBadge source={resource.sourceName || resource.source} />
            <span className="rounded-full bg-md-surfaceVariant/70 px-2 py-0.5 text-[11px] font-bold text-md-outline">{resource.type}</span>
          </div>
          <p className="text-sm text-md-outline mt-1 line-clamp-2">{resource.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resource.tags.map(tag => (
              <span key={tag} className="rounded-full bg-md-surfaceVariant/45 px-2.5 py-1 text-xs text-md-outline">{tag}</span>
            ))}
          </div>
        </button>
        <button
          onClick={onQueue}
          disabled={installed || installingResource}
          className="rounded-full bg-md-primary px-3 py-2 text-xs font-bold text-md-onPrimary flex items-center gap-1.5 disabled:bg-md-surfaceVariant disabled:text-md-outline shrink-0"
        >
          {installed ? <CheckCircle size={14} /> : installingResource ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
          {installed ? 'Installed' : installingResource ? 'Installing' : 'Details'}
        </button>
      </div>
    </article>
  );
}

function DownloadDetailsPanel({
  resource,
  files,
  filesLoading,
  selectedFileId,
  setSelectedFileId,
  downloadItem,
  installing,
  notice,
  onQueue,
}) {
  if (!resource) {
    return (
      <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 text-sm text-md-outline">
        Select a resource to inspect details.
      </section>
    );
  }

  const downloadActive = installing || downloadItem?.status === 'queued' || downloadItem?.status === 'running';
  const installed = downloadItem?.status === 'complete';
  const progress = Math.max(0, Math.min(100, Number(downloadItem?.progress || (installing ? 5 : 0))));
  const buttonDisabled = installed || downloadActive || filesLoading;
  const buttonLabel = downloadActive
    ? `${progress}%`
    : installed
      ? 'Installed'
      : resource.type === 'Server Core'
        ? 'Core install requires confirmation'
        : 'Install selected file';

  return (
    <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-2xl bg-md-secondaryContainer text-md-onSecondaryContainer flex items-center justify-center shrink-0">
          <ResourceIcon resource={resource} className="h-full w-full rounded-2xl" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-md-outline">{resource.type}</p>
          <h2 className="text-xl font-bold leading-tight">{resource.name}</h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <SourceBadge source={resource.sourceName || resource.source} />
            <span className="rounded-full bg-md-successContainer px-2.5 py-1 text-xs font-bold text-md-success">{resource.status}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-md-outline leading-relaxed">{resource.details}</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <DetailStat label="Version" value={resource.version} />
        <DetailStat label="Loader" value={resource.loader} />
        <DetailStat label="Target" value={resource.target} />
        <DetailStat label="Size" value={resource.size} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-bold text-md-outline uppercase">Files</p>
          {filesLoading && <Loader2 size={14} className="animate-spin text-md-outline" />}
        </div>
        {files.length === 0 ? (
          <div className="rounded-[18px] bg-md-bg border border-dashed border-md-surfaceVariant px-4 py-3 text-xs text-md-outline">
            {filesLoading ? 'Loading compatible files...' : 'No compatible files loaded yet.'}
          </div>
        ) : (
          <div className={`space-y-2 max-h-44 overflow-y-auto pr-1 transition-opacity ${downloadActive ? 'opacity-55' : ''}`}>
            {files.slice(0, 8).map(file => (
              <label
                key={file.fileId}
                className={`flex items-start gap-3 rounded-[18px] border px-3 py-2 ${
                  downloadActive ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                  selectedFileId === file.fileId
                    ? 'border-md-primary bg-md-primaryContainer/45'
                    : 'border-md-surfaceVariant bg-md-bg'
                }`}
              >
                <input
                  type="radio"
                  name="download-file"
                  checked={selectedFileId === file.fileId}
                  onChange={() => setSelectedFileId(file.fileId)}
                  disabled={downloadActive}
                  className="mt-1 accent-md-primary"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold truncate">{file.versionName || file.name}</span>
                  <span className="block text-[11px] text-md-outline truncate">{file.name}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onQueue}
        disabled={buttonDisabled}
        className={`relative mt-4 w-full overflow-hidden rounded-full px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 ${
          buttonDisabled && !downloadActive
            ? 'bg-md-surfaceVariant text-md-outline'
            : 'bg-md-primary text-md-onPrimary'
        }`}
      >
        {downloadActive && (
          <span
            className="absolute inset-y-0 left-0 bg-md-success/45 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {downloadActive ? <Loader2 size={16} className="animate-spin" /> : installed ? <CheckCircle size={16} /> : <Download size={16} />}
          {buttonLabel}
        </span>
      </button>

      <div className="mt-4 rounded-[18px] bg-md-warningContainer/40 px-4 py-3 flex items-start gap-3">
        <AlertTriangle size={16} className="text-md-warning shrink-0 mt-0.5" />
        <p className="text-xs text-md-outline leading-relaxed">
          {notice || 'Mods and plugins install to their server folders. Server cores require a confirmed deployment flow.'}
        </p>
      </div>
    </section>
  );
}

function DetailStat({ label, value }) {
  return (
    <div className="rounded-[18px] bg-md-bg border border-md-surfaceVariant px-3 py-2 min-w-0">
      <p className="text-[11px] text-md-outline">{label}</p>
      <p className="text-xs font-bold truncate">{value}</p>
    </div>
  );
}

function SourceBadge({ source }) {
  return (
    <span className="rounded-full bg-md-secondaryContainer px-2.5 py-1 text-[11px] font-bold text-md-onSecondaryContainer">
      {source}
    </span>
  );
}

function ServerConsolePage({
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

function ServerActionButton({ children, icon: Icon, onClick, disabled, tone }) {
  const tones = {
    success: 'bg-md-success text-md-onPrimary',
    danger: 'bg-md-error text-md-onPrimary',
    warning: 'bg-md-warning text-md-onPrimary',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-45 shadow-sm ${tones[tone]}`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

function ConsoleLine({ line }) {
  const color = line.includes('ERROR') || line.includes('WARN')
    ? 'text-red-300'
    : line.includes('Done') || line.includes('INFO')
      ? 'text-green-300'
      : 'text-gray-300';
  return <div className={`${color} whitespace-pre-wrap break-words`}>{line}</div>;
}

function InfoTile({ icon: Icon, label, value, tone }) {
  const toneClass = tone === 'success' ? 'text-md-success bg-md-successContainer' : tone === 'warning' ? 'text-md-warning bg-md-warningContainer' : 'text-md-outline bg-md-surface';
  return (
    <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 shadow-sm">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="mt-3 text-xs text-md-outline">{label}</p>
      <p className="text-sm font-bold text-md-onPrimaryContainer">{value}</p>
    </div>
  );
}

function ResourcePage({ kind, title, icon: Icon, items, loading, emit }) {
  const [filter, setFilter] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);
  const enabledCount = items.filter(item => item.enabled).length;
  const filtered = useMemo(
    () => items.filter(item => !filter || (item.meta?.name || item.name).toLowerCase().includes(filter.toLowerCase())),
    [filter, items],
  );

  const install = () => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    emit(`${kind}:install`, { url: installUrl.trim() });
    setInstallUrl('');
    window.setTimeout(() => setInstalling(false), 1800);
  };

  const toggle = (item) => emit(`${kind}:toggle`, { name: item.name, enabled: !item.enabled });
  const remove = (item) => {
    if (confirm(`确定移除 ${item.meta?.name || item.name} 吗？`)) {
      emit(`${kind}:remove`, { name: item.name });
    }
  };

  return (
    <PageShell
      title={
        <>
          {title} <span className="text-md-success">{enabledCount}</span><span className="text-md-outline">/{items.length}</span>
        </>
      }
      action={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-md-outline" />
            <input
              value={filter}
              onChange={event => setFilter(event.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-52 rounded-full border border-md-surfaceVariant bg-md-surfaceContainer py-2 pl-9 pr-3 text-sm outline-none focus:border-md-primary"
            />
          </div>
          <div className="hidden md:flex items-center rounded-full border border-md-primaryContainer bg-md-primaryContainer/45 px-3 py-2">
            <input
              value={installUrl}
              onChange={event => setInstallUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') install();
              }}
              placeholder="Download URL"
              className="w-56 bg-transparent text-sm outline-none placeholder:text-md-outline"
            />
            <button onClick={install} disabled={!installUrl.trim() || installing} className="text-md-primary disabled:text-md-outline">
              {installing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center text-md-outline">
            <Loader2 size={22} className="animate-spin mr-2" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant border-dashed p-8 flex flex-col items-center justify-center text-center w-full max-w-sm">
            <Icon size={32} className="text-md-outline mb-3" />
            <h3 className="font-bold text-lg mb-2">There is no files.</h3>
            <p className="text-sm text-md-outline">Use a direct download URL, or place files in mc-server/{kind === 'mod' ? 'mods' : 'plugins'}.</p>
            {kind === 'plugin' && <p className="text-xs text-md-outline mt-2">If the current core does not support plugins, this area will stay empty.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-2">
            {filtered.map(item => (
              <ResourceCard
                key={item.fileName}
                item={item}
                icon={Icon}
                onToggle={() => toggle(item)}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ResourceCard({ item, icon: Icon, onToggle, onRemove }) {
  const displayName = item.meta?.name || item.meta?.id || item.name;
  const version = item.meta?.version || item.meta?.modLoader || 'unknown';

  return (
    <div className="rounded-[24px] bg-md-surface shadow-sm border border-md-surfaceVariant p-4 flex items-start gap-4">
      <div className="w-16 h-16 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
        <Icon size={30} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm truncate">{displayName}</h3>
          <button
            onClick={onToggle}
            className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${item.enabled ? 'bg-md-primary' : 'bg-md-surfaceVariant'}`}
            title={item.enabled ? 'Disable' : 'Enable'}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-md-onPrimary rounded-full transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-xs text-md-outline mt-1">version: {version}</p>
        <p className="text-xs text-md-outline mt-0.5">updated time: {formatDate(item.lastModified)}</p>
        <p className="text-xs text-md-outline mt-0.5">size: {shortSize(item.size)}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.enabled ? 'bg-md-successContainer text-md-success' : 'bg-md-surfaceVariant text-md-outline'}`}>
            {item.enabled ? 'enabled' : 'disabled'}
          </span>
          <button onClick={onRemove} className="rounded-full px-3 py-1 text-xs font-bold bg-md-errorContainer text-md-error hover:bg-md-errorContainer/80 transition">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function BasicSetupPage({ properties, setProperties, configForm, setConfigForm, javaStatus, setupSaving, setupNotice, saveSetup }) {
  return (
    <PageShell
      title="Server Basic Setup"
      action={
        <button
          onClick={saveSetup}
          disabled={setupSaving}
          className="rounded-full bg-md-primary px-5 py-2 text-sm font-bold text-md-onPrimary shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {setupSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
      }
    >
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        <section className="grid grid-cols-1 gap-3">
          {SETUP_FIELDS.map(field => (
            <SetupRow
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={properties[field.key] ?? ''}
              onChange={value => setProperties(prev => ({ ...prev, [field.key]: value }))}
            />
          ))}
        </section>

        <section>
          <h2 className="text-xl font-medium text-md-primary mb-3">Runtime & Agent</h2>
          <div className="grid grid-cols-1 gap-3">
            <SetupRow
              label="Server Directory"
              hint="Minecraft 服务端目录"
              value={configForm.serverDir}
              onChange={value => setConfigForm(prev => ({ ...prev, serverDir: value }))}
            />
            <SetupRow
              label="JVM Memory"
              hint="最大内存，单位 MB"
              value={configForm.jvmMemory}
              onChange={value => setConfigForm(prev => ({ ...prev, jvmMemory: value }))}
            />
            <SetupRow
              label="AI Base URL"
              hint="OpenAI-compatible API 地址"
              value={configForm.baseUrl}
              onChange={value => setConfigForm(prev => ({ ...prev, baseUrl: value }))}
            />
            <SetupRow
              label="AI Model"
              hint="Agent 使用的模型名称"
              value={configForm.model}
              onChange={value => setConfigForm(prev => ({ ...prev, model: value }))}
            />
            <SetupRow
              label="API Key"
              hint="留空则不修改已保存的 Key"
              value={configForm.apiKey}
              type="password"
              onChange={value => setConfigForm(prev => ({ ...prev, apiKey: value }))}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium text-md-primary mb-3">Parked Draft Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PARKED_FEATURES.map(feature => (
              <div key={feature.title} className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 flex gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
                  <feature.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{feature.title}</h3>
                  <p className="text-xs text-md-outline mt-1 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-md-secondaryContainer flex items-center justify-center text-md-onSecondaryContainer">
            <KeyRound size={22} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Java Status</p>
            <p className="text-xs text-md-outline mt-1">
              {javaStatus?.found ? `Detected Java ${javaStatus.javas?.[0]?.majorVersion} (${javaStatus.javas?.[0]?.source})` : 'Java has not been detected yet.'}
            </p>
          </div>
        </section>

        {setupNotice && (
          <div className="rounded-[20px] bg-md-primaryContainer/55 px-4 py-3 text-sm text-md-onPrimaryContainer">
            {setupNotice}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function SetupRow({ label, hint, value, onChange, type = 'text' }) {
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

function AgentToolsPage({ tools }) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (name) => setExpanded(expanded === name ? null : name);

  return (
    <PageShell title="Agent Tools">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {tools.length === 0 ? (
          <div className="rounded-[24px] bg-md-surfaceContainer border border-dashed border-md-surfaceVariant p-8 flex flex-col items-center text-center shadow-sm">
            <Wrench size={32} className="text-md-outline mb-3" />
            <h3 className="font-bold text-lg mb-1">暂无工具数据</h3>
            <p className="text-sm text-md-outline">Agent 工具定义尚未加载，请检查后端服务。</p>
          </div>
        ) : (
          tools.map(tool => (
            <div
              key={tool.name}
              className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-5 shadow-sm cursor-pointer hover:border-md-primary/40 transition"
              onClick={() => toggle(tool.name)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
                    <Wrench size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{tool.name}</h3>
                    <p className="text-xs text-md-outline mt-0.5 line-clamp-2">{tool.description}</p>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-md-outline shrink-0 transition-transform ${expanded === tool.name ? 'rotate-90' : ''}`}
                />
              </div>
              {expanded === tool.name && tool.parameters?.properties && (
                <div className="mt-4 pt-3 border-t border-md-surfaceVariant/60">
                  <p className="text-xs font-bold text-md-outline mb-2">参数</p>
                  <div className="space-y-2">
                    {Object.entries(tool.parameters.properties).map(([key, def]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <code className="bg-md-primaryContainer/60 text-md-onPrimaryContainer px-1.5 py-0.5 rounded font-mono shrink-0">
                          {key}
                        </code>
                        <span className="text-md-outline">{def.description}</span>
                        {def.enum && (
                          <span className="text-[10px] text-md-primary bg-md-primaryContainer/40 px-1.5 py-0.5 rounded shrink-0">
                            {def.enum.join(', ')}
                          </span>
                        )}
                        {tool.parameters.required?.includes(key) && (
                          <span className="text-md-error font-bold shrink-0">*</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </PageShell>
  );
}

function AgentPromptsPage({ prompts, onPromptsSaved }) {
  const [activeTab, setActiveTab] = useState('admin');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!prompts) {
    return (
      <PageShell title="Prompt Settings">
        <div className="flex-1 flex items-center justify-center text-md-outline">
          <Loader2 size={22} className="animate-spin mr-2" /> 加载中...
        </div>
      </PageShell>
    );
  }

  const currentPrompt = activeTab === 'admin' ? prompts.prompts?.admin : prompts.prompts?.player;

  const handleEditClick = () => {
    setDraft(currentPrompt || '');
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = activeTab === 'admin'
        ? { admin: draft }
        : { player: draft };
      const response = await fetch('/api/agent/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '保存失败');
      setIsEditing(false);
      onPromptsSaved?.();
    } catch (err) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setIsEditing(false);
    setDraft('');
  };

  return (
    <PageShell title="Prompt Settings">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        <div className="rounded-[20px] bg-md-warning/10 border border-md-warning/30 px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-md-warning shrink-0" />
          <div>
            <p className="text-sm font-bold text-md-warning">{prompts.notice || '不建议修改'}</p>
            <p className="text-xs text-md-outline mt-0.5">以下提示词由系统生成并直接用于 Agent 运行，不当修改可能导致 Agent 行为异常。</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('admin');
              setIsEditing(false);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === 'admin'
                ? 'bg-md-primary text-md-onPrimary shadow-sm'
                : 'bg-md-surfaceVariant/60 text-md-outline hover:bg-md-surfaceVariant'
            }`}
          >
            管理员 Prompt
          </button>
          <button
            onClick={() => {
              setActiveTab('player');
              setIsEditing(false);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === 'player'
                ? 'bg-md-primary text-md-onPrimary shadow-sm'
                : 'bg-md-surfaceVariant/60 text-md-outline hover:bg-md-surfaceVariant'
            }`}
          >
            玩家 Prompt
          </button>
        </div>

        <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-md-surfaceVariant/60 flex items-center justify-between">
            <span className="text-xs font-bold text-md-outline">
              {activeTab === 'admin' ? '管理员系统提示词（Web 端完全权限）' : '玩家系统提示词（游戏内 @agent，受限权限）'}
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscard}
                  disabled={saving}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-success text-white hover:opacity-90 transition flex items-center gap-1"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  保存
                </button>
              </div>
            ) : (
              <button
                onClick={handleEditClick}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-primaryContainer text-md-onPrimaryContainer hover:bg-md-primaryContainer/80 transition"
              >
                修改
              </button>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="w-full p-5 text-sm leading-relaxed text-md-onPrimaryContainer whitespace-pre-wrap bg-md-bg/50 max-h-[60vh] min-h-[300px] outline-none resize-y font-sans"
              spellCheck={false}
            />
          ) : (
            <pre className="p-5 text-sm leading-relaxed text-md-onPrimaryContainer whitespace-pre-wrap font-sans overflow-x-auto bg-md-bg/50 max-h-[60vh]">
              {currentPrompt || '暂无内容'}
            </pre>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/50 p-4">
          <div className="rounded-[28px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-lg max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-md-warning shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold">不建议修改</h3>
                <p className="text-sm text-md-outline mt-1">提示词直接影响 Agent 行为，修改后可能导致意外结果。真的要修改吗？</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-full px-4 py-2 text-sm font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-full px-4 py-2 text-sm font-bold bg-md-primary text-md-onPrimary hover:opacity-90 transition"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function parseJvmMemory(args = []) {
  const maxArg = args.find(arg => arg.startsWith('-Xmx'));
  if (!maxArg) return '';
  const raw = maxArg.replace('-Xmx', '').toUpperCase();
  if (raw.endsWith('G')) return String(Number(raw.replace('G', '')) * 1024);
  return raw.replace('M', '');
}

function statusText(status) {
  if (status === 'running') return 'Running';
  if (status === 'starting') return 'Starting...';
  if (status === 'stopping') return 'Stopping...';
  return 'Stopped';
}
