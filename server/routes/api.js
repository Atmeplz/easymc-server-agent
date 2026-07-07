/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * API Routes - REST API.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { getAdminPrompt, getPlayerPrompt } = require('../agent/prompts');
const { getToolDefinitions } = require('../agent/tools');
const DownloadService = require('../download/download-service');

module.exports = function ({
  config,
  serverManager,
  terminalManager,
  javaManager,
  fileGuard,
  agentCore,
  deployManager,
  modManager,
  pluginManager,
  downloadService: providedDownloadService,
}) {
  const router = express.Router();
  const downloadService = providedDownloadService || new DownloadService({ config, deployManager, modManager, pluginManager });

  // Return configuration with sensitive values masked.
  router.get('/config', (req, res) => {
    const safeConfig = JSON.parse(JSON.stringify(config));
    if (safeConfig.ai) {
      safeConfig.ai.apiKey = safeConfig.ai.apiKey ? '***' : '';
    }
    res.json(safeConfig);
  });

  // Save configuration.
  router.post('/config', (req, res) => {
    try {
      const updates = req.body;

      // Merge into the in-memory config.
      if (updates.ai) {
        if (updates.ai.apiKey !== undefined && updates.ai.apiKey !== '' && updates.ai.apiKey !== '***') {
          config.ai.apiKey = updates.ai.apiKey;
        }
        if (updates.ai.baseUrl !== undefined) config.ai.baseUrl = updates.ai.baseUrl;
        if (updates.ai.model !== undefined) config.ai.model = updates.ai.model;
      }
      if (updates.mc) {
        if (updates.mc.serverDir !== undefined) config.mc.serverDir = updates.mc.serverDir;
        if (updates.mc.jvmArgs !== undefined) config.mc.jvmArgs = updates.mc.jvmArgs;
      }

      // Persist to config.local.json.
      const localPath = path.join(process.cwd(), 'config.local.json');
      fs.writeFileSync(localPath, JSON.stringify(config, null, 2), 'utf-8');

      // Reinitialize the Agent so the new API key takes effect.
      if (agentCore) {
        agentCore.reinit();
      }

      console.log('[API] 配置已保存');
      res.json({ success: true });
    } catch (err) {
      console.error('[API] 配置保存失败:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server status.
  router.get('/server/status', (req, res) => {
    res.json({
      status: serverManager.getStatus(),
      mcVersion: serverManager.getMcVersion(),
    });
  });

  // Java environment detection.
  router.get('/java/status', async (req, res) => {
    try {
      const status = await javaManager.detectJava();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Workspace file listing.
  router.get('/workspace/files', (req, res) => {
    const files = fileGuard.listWorkspaceFiles();
    res.json({ files });
  });

  router.get('/agent/tools', (req, res) => {
    const tools = getToolDefinitions().map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters || {},
    }));
    res.json({ tools });
  });

  router.get('/agent/prompts', (req, res) => {
    res.json({
      prompts: {
        admin: getAdminPrompt(config),
        player: getPlayerPrompt('{playerName}', '{permissionLevel}', '{permissionDescription}', config),
      },
      notice: '不建议修改',
    });
  });

  router.post('/agent/prompts', (req, res) => {
    try {
      const { admin, player } = req.body || {};
      if (!config.prompts) config.prompts = { admin: '', player: '' };
      if (typeof admin === 'string') config.prompts.admin = admin;
      if (typeof player === 'string') config.prompts.player = player;

      const localPath = path.join(process.cwd(), 'config.local.json');
      fs.writeFileSync(localPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log('[API] Prompts 已保存');
      res.json({ success: true });
    } catch (err) {
      console.error('[API] Prompts 保存失败:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Whether the server has been deployed.
  router.get('/server/deployed', (req, res) => {
    const jarPath = path.join(path.resolve(config.mc.serverDir), config.mc.jarFile);
    res.json({ deployed: fs.existsSync(jarPath) });
  });

  router.get('/server/properties', (req, res) => {
    try {
      const propsPath = path.join(path.resolve(config.mc.serverDir), 'server.properties');
      if (!fs.existsSync(propsPath)) {
        res.json({ properties: {} });
        return;
      }

      const check = fileGuard.validate(propsPath, 'read');
      if (!check.allowed) {
        res.status(403).json({ error: check.reason });
        return;
      }

      const properties = {};
      for (const line of fs.readFileSync(check.resolvedPath, 'utf-8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          properties[trimmed.slice(0, index)] = trimmed.slice(index + 1);
        }
      }
      res.json({ properties });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/server/properties', (req, res) => {
    try {
      const updates = req.body?.properties || {};
      const propsPath = path.join(path.resolve(config.mc.serverDir), 'server.properties');
      const check = fileGuard.validate(propsPath, 'write');
      if (!check.allowed) {
        res.status(403).json({ success: false, error: check.reason });
        return;
      }

      let lines = fs.existsSync(check.resolvedPath)
        ? fs.readFileSync(check.resolvedPath, 'utf-8').split(/\r?\n/)
        : [];

      for (const [key, value] of Object.entries(updates)) {
        const nextLine = `${key}=${value}`;
        const index = lines.findIndex(line => line.trim().startsWith(`${key}=`));
        if (index >= 0) {
          lines[index] = nextLine;
        } else {
          lines.push(nextLine);
        }
      }

      fs.mkdirSync(path.dirname(check.resolvedPath), { recursive: true });
      fs.writeFileSync(check.resolvedPath, lines.join('\n'), 'utf-8');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/download/sources', (req, res) => {
    res.json({ sources: downloadService.sourceList() });
  });

  router.get('/download/search', async (req, res) => {
    try {
      const result = await downloadService.search({
        query: req.query.query || '',
        type: req.query.type || 'All',
        source: req.query.source || 'All',
        gameVersion: req.query.gameVersion || '',
        loader: req.query.loader || '',
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ results: [], errors: [err.message] });
    }
  });

  router.get('/download/project/:source/:projectId', async (req, res) => {
    try {
      const project = await downloadService.getProject(req.params.source, req.params.projectId);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/download/project/:source/:projectId/files', async (req, res) => {
    try {
      const files = await downloadService.listFiles(req.params.source, req.params.projectId, {
        gameVersion: req.query.gameVersion || '',
        loader: req.query.loader || '',
      });
      res.json({ files });
    } catch (err) {
      res.status(500).json({ files: [], error: err.message });
    }
  });

  router.post('/download/install', async (req, res) => {
    try {
      const result = await downloadService.install(req.body || {});
      res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/download/queue', (req, res) => {
    res.json({ queue: downloadService.queue.list() });
  });

  router.post('/download/queue/clear-completed', (req, res) => {
    res.json({ queue: downloadService.queue.clearCompleted() });
  });

  router.post('/download/queue/clear', (req, res) => {
    res.json({ queue: downloadService.queue.clearAll() });
  });

  return router;
};
