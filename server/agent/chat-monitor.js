/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Chat Monitor - watches in-game @agent messages and dispatches them.
 * Parses player chat from terminal output and detects the @agent trigger.
 */
const PermissionManager = require('../permissions/permission-manager');

// Standard ANSI escape sequence used for colors and cursor control.
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

class ChatMonitor {
  constructor(terminalManager, agentCore, config, serverDir, serverManager) {
    this.terminalManager = terminalManager;
    this.agentCore = agentCore;
    this.config = config;
    this.serverManager = serverManager;
    this.chatRegex = new RegExp(config.agent?.chatRegex || '^<(\\w{1,16})>\\s+(.+)');
    this.trigger = config.agent?.trigger || '@agent';
    this.replyPrefix = config.agent?.replyPrefix || '[Agent]';
    this.permissionManager = new PermissionManager(serverDir);
    this.listeners = [];
    this.processing = new Set(); // Prevent duplicate processing.

    // Listen for terminal output.
    terminalManager.onOutput((line) => this.parseLine(line));
  }

  /**
   * Strip ANSI escape sequences from a console line.
   */
  stripAnsi(line) {
    return line.replace(ANSI_REGEX, '');
  }

  /**
   * Remove the standard Minecraft log prefix:
   *   [HH:MM:SS] [thread/LEVEL]: <body>
   *   [HH:MM:SS LEVEL]: <body>
   * Also removes the Paper "[Not Secure]" unsigned-chat marker.
   */
  stripLogPrefix(line) {
    // Remove timestamp + thread/level prefix.
    // Matches common Minecraft log formats:
    //   [12:34:56] [Server thread/INFO]: body
    //   [12:34:56] [Server thread/INFO] [Not Secure]: body
    //   [12:34:56 INFO]: body
    let body = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*\[[^\]]+\/[^\]]+\]:\s*/, '');
    // Alternative compact format without brackets around level.
    body = body.replace(/^\[\d{2}:\d{2}:\d{2}\s+\w+\]:\s*/, '');
    // Remove [Not Secure] marker that appears before the actual chat.
    body = body.replace(/^\[Not Secure\]\s+/, '');
    return body;
  }

  /**
   * Determine whether a stripped line is the agent's own reply broadcast.
   * This prevents the AI from replying to itself.
   */
  isAgentReply(line) {
    const stripped = this.stripLogPrefix(line);
    // The agent's say output is shown as "[Server] [Agent]: ..." or "[Agent]: ...".
    return stripped.startsWith(`${this.replyPrefix}:`) || stripped.startsWith(`[Server] ${this.replyPrefix}:`);
  }

  /**
   * Parse a terminal output line.
   */
  parseLine(rawLine) {
    const line = this.stripAnsi(rawLine).replace(/\r$/, '');
    if (!line.trim()) return;

    // Drop the agent's own broadcasts to avoid infinite loops.
    if (this.isAgentReply(line)) return;

    // Match player chat formats after the log prefix is removed.
    const body = this.stripLogPrefix(line);
    const match = body.match(this.chatRegex);
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

      console.log(`[ChatMonitor] @agent request: ${playerName} (OP${permission.level}): ${request}`);

      // Hand the request to the Agent.
      const result = await this.agentCore.handlePlayerRequest(
        playerName, request, permission
      );

      // Broadcast the Agent response to the server with /say.
      if (result.reply) {
        const prefix = this.replyPrefix;
        this.serverManager.sendCommand(`say ${prefix}: ${result.reply}`);
        this.terminalManager.addOutput(`[Agent → ${playerName}] ${result.reply}`);
      }

      // Emit a concise stream event for the live @agent feed.
      this.emit('agent:player_reply', {
        player: playerName,
        request,
        reply: result.reply,
        timestamp: Date.now(),
      });

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
      console.error(`[ChatMonitor] Failed to handle @agent request:`, error.message);
      // Broadcast the error to the Minecraft server.
      const prefix = this.replyPrefix;
      this.serverManager.sendCommand(`say ${prefix}: AI is temporarily unavailable, please try again later.`);
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
