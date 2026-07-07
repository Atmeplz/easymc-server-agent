/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * EasyMC Server Agent Express and Socket.IO entry point.
 */
const express = require('express');
const http = require('http');
const net = require('net');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

function loadConfig() {
  const defaults = require('./config');
  const localPath = path.join(process.cwd(), 'config.local.json');
  if (fs.existsSync(localPath)) {
    const local = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    return deepMerge(defaults, local);
  }
  return defaults;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const config = loadConfig();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 50 * 1024 * 1024,
});

app.use(cors());
app.use(express.json({ limit: '200mb' }));

const clientDist = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

const ServerManager = require('./managers/server-manager');
const TerminalManager = require('./managers/terminal-manager');
const JavaManager = require('./managers/java-manager');
const FileGuard = require('./security/file-guard');
const AgentCore = require('./agent/agent-core');
const ChatMonitor = require('./agent/chat-monitor');
const DeployManager = require('./managers/deploy-manager');
const PluginManager = require('./managers/plugin-manager');
const ModManager = require('./managers/mod-manager');
const ChatSessionManager = require('./managers/chat-session-manager');
const DownloadService = require('./download/download-service');

const javaManager = new JavaManager(config);
const fileGuard = new FileGuard(config);
const terminalManager = new TerminalManager(config);
const serverManager = new ServerManager(config, javaManager, terminalManager);
const deployManager = new DeployManager(config, javaManager);
const pluginManager = new PluginManager(path.resolve(config.mc.serverDir));
const modManager = new ModManager(path.resolve(config.mc.serverDir));
const chatSessionManager = new ChatSessionManager(process.cwd());
const downloadService = new DownloadService({ config, deployManager, modManager, pluginManager });

const agentCore = new AgentCore(config, { serverManager, terminalManager, fileGuard });
const chatMonitor = new ChatMonitor(
  terminalManager,
  agentCore,
  config,
  path.resolve(config.mc.serverDir),
  serverManager
);

chatMonitor.on('agent:player_request', (data) => {
  io.emit('agent:player_activity', data);
});

chatMonitor.on('agent:player_result', (data) => {
  io.emit('agent:player_result', data);
});

downloadService.queue.on('queued', (item) => {
  io.emit('download:queued', item);
});

downloadService.queue.on('progress', (item) => {
  io.emit('download:progress', item);
});

downloadService.queue.on('complete', (item) => {
  io.emit('download:complete', item);
});

downloadService.queue.on('error', (item) => {
  io.emit('download:error', item);
});

downloadService.queue.on('queue', (items) => {
  io.emit('download:queue', { queue: items });
});

const apiRouter = require('./routes/api')({
  config,
  serverManager,
  terminalManager,
  javaManager,
  fileGuard,
  agentCore,
  deployManager,
  modManager,
  pluginManager,
  downloadService,
});
app.use('/api', apiRouter);

app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend has not been built. Run npm run build first.');
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.emit('server:status', { status: serverManager.getStatus() });
  socket.emit('terminal:history', { lines: terminalManager.getHistory() });
  socket.emit('chat:sessions', { sessions: chatSessionManager.listSessions() });
  socket.emit('download:queue', { queue: downloadService.queue.list() });

  let activeChatRun = null;

  const stopActiveChatRun = () => {
    if (!activeChatRun) return;
    activeChatRun.interrupted = true;
    activeChatRun.cancelConfirm?.();
    activeChatRun.controller.abort();
  };

  const emitChatSessions = () => {
    socket.emit('chat:sessions', { sessions: chatSessionManager.listSessions() });
  };

  const emitChatSession = (session) => {
    socket.emit('chat:session_current', {
      session,
      sessions: chatSessionManager.listSessions(),
    });
  };

  socket.on('terminal:input', ({ command }) => {
    serverManager.sendCommand(command);
  });

  socket.on('app:shutdown', async () => {
    console.log('[App] Shutdown requested.');
    io.emit('app:shutting_down', { message: 'EasyMC Server Agent is shutting down...' });

    try {
      if (serverManager.getStatus() === 'running') {
        await serverManager.stop();
      }
    } catch (err) {
      console.warn('[App] Failed to stop Minecraft server:', err.message);
    }

    terminalManager.destroy();
    chatMonitor.destroy();

    server.close(() => {
      console.log('[App] HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => process.exit(0), 5000);
  });

  socket.on('server:start', async () => {
    try {
      await serverManager.start();
      io.emit('server:status', { status: 'running' });
    } catch (err) {
      socket.emit('server:error', { error: err.message });
    }
  });

  socket.on('server:stop', async () => {
    try {
      await serverManager.stop();
      io.emit('server:status', { status: 'stopped' });
    } catch (err) {
      socket.emit('server:error', { error: err.message });
    }
  });

  socket.on('server:restart', async () => {
    try {
      await serverManager.restart();
      io.emit('server:status', { status: 'running' });
    } catch (err) {
      socket.emit('server:error', { error: err.message });
    }
  });

  socket.on('java:check', async () => {
    const status = await javaManager.detectJava();
    socket.emit('java:status', status);
  });

  socket.on('java:download', async ({ javaVersion }) => {
    try {
      const result = await javaManager.downloadJre(javaVersion, (progress) => {
        socket.emit('java:download_progress', progress);
      });
      socket.emit('java:ready', result);
    } catch (err) {
      socket.emit('java:error', { error: err.message });
    }
  });

  socket.on('java:set_path', async ({ javaPath }) => {
    const check = await javaManager.checkJavaAt(javaPath);
    if (check) {
      socket.emit('java:ready', { path: javaPath, ...check });
    } else {
      socket.emit('java:error', { error: 'The selected Java path is invalid.' });
    }
  });

  socket.on('agent:upload_file', async ({ fileName, fileData }) => {
    try {
      const targetPath = path.join(process.cwd(), fileName);
      fs.writeFileSync(targetPath, Buffer.from(fileData, 'base64'));
      socket.emit('agent:file_uploaded', { fileName, success: true });
    } catch (err) {
      socket.emit('agent:file_uploaded', { fileName, success: false, error: err.message });
    }
  });

  socket.on('deploy:get_types', () => {
    socket.emit('deploy:types', deployManager.getCoreTypes());
  });

  socket.on('deploy:get_versions', async ({ coreType }) => {
    try {
      const versions = await deployManager.getVersionList(coreType);
      socket.emit('deploy:versions', { coreType, versions });
    } catch (err) {
      socket.emit('deploy:error', { error: err.message });
    }
  });

  socket.on('deploy:start', async ({ coreType, version }) => {
    const onStep = (data) => socket.emit('deploy:step', data);
    const onProgress = (data) => socket.emit('deploy:progress', data);
    const onJavaProgress = (data) => socket.emit('deploy:java_progress', data);

    deployManager.on('deploy:step', onStep);
    deployManager.on('deploy:progress', onProgress);
    deployManager.on('deploy:java_progress', onJavaProgress);

    try {
      const result = await deployManager.deploy({ coreType, version });
      socket.emit('deploy:complete', result);
    } catch (err) {
      socket.emit('deploy:error', { error: err.message });
    } finally {
      deployManager.off('deploy:step', onStep);
      deployManager.off('deploy:progress', onProgress);
      deployManager.off('deploy:java_progress', onJavaProgress);
    }
  });

  socket.on('deploy:status', () => {
    socket.emit('deploy:is_deployed', { deployed: deployManager.isDeployed() });
  });

  socket.on('plugin:list', async () => {
    const plugins = await pluginManager.listPlugins();
    socket.emit('plugin:list', { plugins });
  });

  socket.on('plugin:install', async ({ url }) => {
    try {
      const result = await pluginManager.installFromUrl(url);
      const plugins = await pluginManager.listPlugins();
      socket.emit('plugin:installed', result);
      socket.emit('plugin:list', { plugins });
    } catch (err) {
      socket.emit('plugin:error', { error: err.message });
    }
  });

  socket.on('plugin:toggle', async ({ name, enabled }) => {
    const result = await pluginManager.togglePlugin(name, enabled);
    const plugins = await pluginManager.listPlugins();
    socket.emit('plugin:toggled', result);
    socket.emit('plugin:list', { plugins });
  });

  socket.on('plugin:remove', async ({ name }) => {
    const result = await pluginManager.removePlugin(name);
    const plugins = await pluginManager.listPlugins();
    socket.emit('plugin:removed', result);
    socket.emit('plugin:list', { plugins });
  });

  socket.on('mod:list', async () => {
    const mods = await modManager.listMods();
    socket.emit('mod:list', { mods });
  });

  socket.on('mod:install', async ({ url }) => {
    try {
      const result = await modManager.installFromUrl(url);
      const mods = await modManager.listMods();
      socket.emit('mod:installed', result);
      socket.emit('mod:list', { mods });
    } catch (err) {
      socket.emit('mod:error', { error: err.message });
    }
  });

  socket.on('mod:toggle', async ({ name, enabled }) => {
    const result = await modManager.toggleMod(name, enabled);
    const mods = await modManager.listMods();
    socket.emit('mod:toggled', result);
    socket.emit('mod:list', { mods });
  });

  socket.on('mod:remove', async ({ name }) => {
    const result = await modManager.removeMod(name);
    const mods = await modManager.listMods();
    socket.emit('mod:removed', result);
    socket.emit('mod:list', { mods });
  });

  socket.on('agent:interrupt', ({ sessionId } = {}) => {
    if (!activeChatRun) {
      socket.emit('chat:interrupted', { sessionId });
      return;
    }
    if (sessionId && activeChatRun.sessionId && sessionId !== activeChatRun.sessionId) {
      return;
    }

    stopActiveChatRun();
    socket.emit('chat:interrupted', { sessionId: activeChatRun.sessionId });
  });

  socket.on('chat:sessions:list', () => {
    emitChatSessions();
  });

  socket.on('chat:session:create', ({ title } = {}) => {
    const session = chatSessionManager.createSession(title || 'New chat');
    emitChatSession(session);
  });

  socket.on('chat:session:load', ({ sessionId }) => {
    const session = chatSessionManager.getSession(sessionId);
    if (session) {
      emitChatSession(session);
    } else {
      socket.emit('chat:error', { error: 'The chat session no longer exists.' });
      emitChatSessions();
    }
  });

  socket.on('chat:session:delete', ({ sessionId }) => {
    chatSessionManager.deleteSession(sessionId);
    emitChatSessions();
    socket.emit('chat:session_current', {
      session: null,
      sessions: chatSessionManager.listSessions(),
    });
  });

  socket.on('chat:session:rename', ({ sessionId, title }) => {
    const session = chatSessionManager.renameSession(sessionId, title);
    if (session) {
      emitChatSession(session);
    } else {
      socket.emit('chat:error', { error: 'The chat session no longer exists.' });
      emitChatSessions();
    }
  });

  socket.on('chat:message', async ({ text, sessionId }) => {
    const prompt = typeof text === 'string' ? text.trim() : '';
    if (!prompt) return;

    const ensured = chatSessionManager.ensureSession(sessionId);
    chatSessionManager.appendMessage(ensured.id, {
      role: 'user',
      content: prompt,
    });

    let activeSession = chatSessionManager.getSession(ensured.id);
    emitChatSession(activeSession);

    if (!agentCore.isAvailable()) {
      const reply = 'AI Agent is not configured. Add an API key in settings or config.local.json.';
      chatSessionManager.appendMessage(activeSession.id, {
        role: 'assistant',
        content: reply,
      });
      activeSession = chatSessionManager.getSession(activeSession.id);
      emitChatSession(activeSession);
      socket.emit('chat:reply', { sessionId: activeSession.id, text: reply, done: true });
      return;
    }

    stopActiveChatRun();

    const runController = new AbortController();
    const chatRun = {
      sessionId: activeSession.id,
      controller: runController,
      interrupted: false,
      cancelConfirm: null,
    };
    activeChatRun = chatRun;

    try {
      const onConfirm = ({ command, reason }) => new Promise((resolve) => {
        if (runController.signal.aborted) {
          resolve(false);
          return;
        }

        const confirmId = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let settled = false;
        let timer = null;

        const finish = (confirmed, options = {}) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          socket.off('agent:confirm_response', onResponse);
          if (activeChatRun === chatRun) {
            activeChatRun.cancelConfirm = null;
          }

          if (options.timeout || options.cancelled) {
            socket.emit('agent:confirm_timeout', { sessionId: activeSession.id, confirmId });
          } else {
            chatSessionManager.appendMessage(activeSession.id, {
              role: 'user',
              content: confirmed ? 'Confirmed execution' : 'Canceled execution',
              confirmationFor: confirmId,
            });
            activeSession = chatSessionManager.getSession(activeSession.id);
            emitChatSession(activeSession);
          }

          resolve(confirmed);
        };

        const onResponse = ({ confirmId: responseId, confirmed }) => {
          if (responseId === confirmId) {
            finish(Boolean(confirmed));
          }
        };

        chatSessionManager.appendMessage(activeSession.id, {
          role: 'confirm',
          confirmId,
          command,
          reason,
        });
        activeSession = chatSessionManager.getSession(activeSession.id);
        emitChatSession(activeSession);
        socket.emit('agent:confirm_request', {
          sessionId: activeSession.id,
          confirmId,
          command,
          reason,
          timeout: 60000,
        });

        timer = setTimeout(() => finish(false, { timeout: true }), 60000);
        activeChatRun.cancelConfirm = () => finish(false, { cancelled: true });
        socket.on('agent:confirm_response', onResponse);
      });

      const result = await agentCore.chat(prompt, (event) => {
        if (event.type === 'tool_call') {
          chatSessionManager.appendMessage(activeSession.id, {
            role: 'tool',
            tool: event.tool,
            args: event.args,
          });
          activeSession = chatSessionManager.getSession(activeSession.id);
          emitChatSession(activeSession);
          socket.emit('chat:tool_call', {
            sessionId: activeSession.id,
            tool: event.tool,
            args: event.args,
          });
        }
      }, onConfirm, {
        history: chatSessionManager.toModelHistory(activeSession),
        signal: runController.signal,
      });

      chatSessionManager.appendMessage(activeSession.id, {
        role: 'assistant',
        content: result.reply,
      });
      if (result.usage?.total_tokens) {
        chatSessionManager.addUsage(activeSession.id, result.usage);
      }
      activeSession = chatSessionManager.getSession(activeSession.id);
      emitChatSession(activeSession);
      socket.emit('chat:reply', {
        sessionId: activeSession.id,
        text: result.reply,
        done: true,
        interrupted: Boolean(result.interrupted || chatRun.interrupted),
      });
    } catch (err) {
      console.error('[Chat] Agent failed:', err.message);
      const errorReply = `Agent failed: ${err.message}`;
      chatSessionManager.appendMessage(activeSession.id, {
        role: 'assistant',
        content: errorReply,
      });
      activeSession = chatSessionManager.getSession(activeSession.id);
      emitChatSession(activeSession);
      socket.emit('chat:reply', { sessionId: activeSession.id, text: errorReply, done: true });
    } finally {
      if (activeChatRun === chatRun) {
        activeChatRun = null;
      }
    }
  });

  socket.on('disconnect', () => {
    stopActiveChatRun();
    activeChatRun = null;
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

terminalManager.onOutput((line) => {
  io.emit('terminal:output', { line, source: 'mc-server' });
});

serverManager.onStatusChange((status) => {
  io.emit('server:status', { status });
});

const PREFERRED_PORT = config.port || 3000;
const MAX_PORT_ATTEMPTS = 10;

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.once('close', () => resolve(true)).close();
    });
    tester.listen(port);
  });
}

async function findAvailablePort(startPort, maxAttempts) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const port = startPort + i;
    if (await checkPortAvailable(port)) return port;
  }
  return null;
}

findAvailablePort(PREFERRED_PORT, MAX_PORT_ATTEMPTS).then((port) => {
  if (!port) {
    console.error(`\n  Error: ports ${PREFERRED_PORT}-${PREFERRED_PORT + MAX_PORT_ATTEMPTS - 1} are all in use.`);
    console.error('  Close the process using the port, or change port in config.local.json.\n');
    process.exit(1);
  }

  if (port !== PREFERRED_PORT) {
    console.warn(`[Server] Port ${PREFERRED_PORT} is busy. Switched to ${port}.`);
  }

  server.listen(port, () => {
    console.log('\n  EasyMC Server Agent started.');
    console.log(`  http://localhost:${port}\n`);
    console.log(`[EasyMC:PORT]${port}`);
  });
});

module.exports = { app, server, io };
