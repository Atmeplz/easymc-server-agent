/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Chat Monitor - watches in-game @agent messages and dispatches them.
 * Parses player chat from terminal output and detects the @agent trigger.
 */
const PermissionManager = require('../permissions/permission-manager');

class ChatMonitor {
  constructor(terminalManager, agentCore, config, serverDir, serverManager) {
    this.terminalManager = terminalManager;
    this.agentCore = agentCore;
    this.config = config;
    this.serverManager = serverManager;
    this.chatRegex = new RegExp(config.agent?.chatRegex || '^<(\\w{1,16})>\\s+(.+)');
    this.trigger = config.agent?.trigger || '@agent';
    this.permissionManager = new PermissionManager(serverDir);
    this.listeners = [];
    this.processing = new Set(); // Prevent duplicate processing.

    // Listen for terminal output.
    terminalManager.onOutput((line) => this.parseLine(line));
  }

  /**
   * Parse a terminal output line.
   */
  parseLine(line) {
    // Skip server messages, which start with `[`.
    // This also filters the Agent's own /say [Agent] output to prevent loops.
    if (line.startsWith('[')) return;

    // Match player chat formats.
    const match = line.match(this.chatRegex);
    if (!match) return;

    const [, playerName, message] = match;

    // Detect the @agent trigger.
    if (message.trim().startsWith(this.trigger)) {
      const request = message.trim().slice(this.trigger.length).trim();
      if (request) {
        this.handleAgentRequest(playerName, request);
      }
    }
  }

  /**
   * Handle an @agent request.
   */
  async handleAgentRequest(playerName, request) {
    const requestKey = `${playerName}:${request}`;
    if (this.processing.has(requestKey)) return;
    this.processing.add(requestKey);

    try {
      // Look up player permissions.
      const permission = this.permissionManager.getPlayerPermission(playerName);

      // Notify the web UI.
      this.emit('agent:player_request', {
        player: playerName,
        request,
        permission: permission.level,
        timestamp: Date.now(),
      });

      console.log(`[ChatMonitor] @agent 请求: ${playerName} (OP${permission.level}): ${request}`);

      // Hand the request to the Agent.
      const result = await this.agentCore.handlePlayerRequest(
        playerName, request, permission
      );

      // Broadcast the Agent response to the server with /say.
      if (result.reply) {
        const prefix = this.config.agent?.replyPrefix || '[Agent]';
        this.serverManager.sendCommand(`say ${prefix}: ${result.reply}`);
        this.terminalManager.addOutput(`[Agent → ${playerName}] ${result.reply}`);
      }

      // Notify the UI about the result.
      this.emit('agent:player_result', {
        player: playerName,
        request,
        reply: result.reply,
        executed: result.executed,
        commands: result.commands,
        denied: result.denied,
        reason: result.reason,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error(`[ChatMonitor] 处理 @agent 请求失败:`, error.message);
      // Broadcast the error to the Minecraft server.
      const prefix = this.config.agent?.replyPrefix || '[Agent]';
      this.serverManager.sendCommand(`say ${prefix}: AI 暂时出了点问题，请稍后再试`);
    } finally {
      this.processing.delete(requestKey);
    }
  }

  /**
   * Register an event listener.
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  /**
   * Emit an event.
   */
  emit(event, data) {
    for (const l of this.listeners) {
      if (l.event === event) {
        try {
          l.callback(data);
        } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Destroy resources.
   */
  destroy() {
    this.listeners = [];
    if (this.permissionManager) {
      this.permissionManager.destroy();
    }
  }
}

module.exports = ChatMonitor;
