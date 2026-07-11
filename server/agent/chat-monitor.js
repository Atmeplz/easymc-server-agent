/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Chat Monitor - watches in-game @agent messages and dispatches them.
 * Parses player chat from terminal output and detects the @agent trigger.
 *
 * Robustness features:
 * - Strips ANSI codes and Minecraft log prefixes (Vanilla / Paper / Spigot / Forge / Fabric).
 * - Prevents self-loop by ignoring the agent's own /say broadcasts.
 * - Per-player cooldown to prevent API cost abuse.
 * - Processing timeout to auto-clear stuck entries.
 * - Duplicate-request guard via a processing Map.
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
    this.pmRegex = new RegExp(config.agent?.pmRegex || '^\\[AgentPM\\]\\s+(\\w{1,16})\\s+(.+)$');
    this.trigger = config.agent?.trigger || '@agent';
    this.replyPrefix = config.agent?.replyPrefix || '[Agent]';
    this.privateMessageCommand = config.agent?.privateMessageCommand || '/agentpm';
    this.permissionManager = new PermissionManager(serverDir);
    this.listeners = [];

    // --- Rate limiting & dedup state ---
    // Map<requestKey, true> — prevents the exact same request being processed twice.
    this.processing = new Map();
    // Map<playerName, expiryTimestamp> — per-player cooldown after each request.
    this.playerCooldowns = new Map();
    // Cooldown duration (ms) — a player must wait this long between @agent requests.
    this.cooldownMs = (config.agent?.cooldownMs ?? 10_000);
    // Auto-clear a stuck processing entry after this duration (ms).
    this.processingTimeoutMs = (config.agent?.processingTimeoutMs ?? 60_000);

    // Register terminal listener — keep the cleanup function for destroy().
    this.terminalCleanup = terminalManager.onOutput((line) => this.parseLine(line));
  }

  /**
   * Strip ANSI escape sequences from a console line.
   */
  stripAnsi(line) {
    return line.replace(ANSI_REGEX, '');
  }

  /**
   * Remove the standard Minecraft log prefix:
   *   [HH:MM:SS] [thread/LEVEL]: <body>            (Vanilla / Paper / Spigot)
   *   [HH:MM:SS.mmm] [thread/LEVEL]: <body>         (Forge / Fabric with millis)
   *   [HH:MM:SS INFO]: <body>                       (compact Spigot)
   *   [HH:MM:SS] [thread/LEVEL] [Not Secure]: <body> (Paper unsigned chat)
   *   [HH:MM:SS.mmm] [thread/LEVEL] [mod/class]: <body>  (Forge mod prefix)
   * Also removes the Paper "[Not Secure]" unsigned-chat marker.
   */
  stripLogPrefix(line) {
    // Remove timestamp + [thread/LEVEL]: prefix (supports optional milliseconds).
    let body = line.replace(
      /^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*\[[^\]]+\/[^\]]+\]:\s*/,
      ''
    );
    // Alternative compact format: [HH:MM:SS LEVEL]:
    body = body.replace(
      /^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+\w+\]:\s*/,
      ''
    );
    // Strip Forge/Fabric [mod/class]: prefix if it appears before the chat body.
    body = body.replace(/^\[[^\]]+\/[^\]]+\]:\s*/, '');
    // Remove [Not Secure] marker that appears before the actual chat.
    body = body.replace(/^\[Not Secure\]\s+/, '');
    return body;
  }

  /**
   * Determine whether a stripped line is the agent's own reply broadcast.
   * This prevents the AI from replying to itself (infinite loop).
   *
   * The /say command outputs "[Server] <message>", so when we send
   *   say [Agent]: hello
   * the console shows:
   *   [12:34:56] [Server thread/INFO]: [Server] [Agent]: hello
   * After stripping the log prefix the body starts with "[Server] [Agent]:".
   */
  isAgentReply(line) {
    const stripped = this.stripLogPrefix(line);
    return (
      stripped.startsWith(`${this.replyPrefix}:`) ||
      stripped.startsWith(`[Server] ${this.replyPrefix}:`)
    );
  }

  /**
   * Parse a terminal output line.
   */
  parseLine(rawLine) {
    const line = this.stripAnsi(rawLine).replace(/\r$/, '');
    if (!line.trim()) return;

    // Drop the agent's own broadcasts to avoid infinite loops.
    if (this.isAgentReply(line)) return;

    // Match private agent messages first: [AgentPM] playerName message
    const pmBody = this.stripLogPrefix(line);
    const pmMatch = pmBody.match(this.pmRegex);
    if (pmMatch) {
      const [, playerName, message] = pmMatch;
      if (message) {
        this.handleAgentRequest(playerName, message, true);
      }
      return;
    }

    // Match player chat formats after the log prefix is removed.
    const body = this.stripLogPrefix(line);
    const match = body.match(this.chatRegex);
    if (!match) return;

    const [, playerName, message] = match;

    // Detect the @agent trigger.
    if (message.trim().startsWith(this.trigger)) {
      const request = message.trim().slice(this.trigger.length).trim();
      if (request) {
        this.handleAgentRequest(playerName, request, false);
      }
    }
  }

  /**
   * Handle an @agent request with cooldown and dedup guards.
   * @param {string} playerName
   * @param {string} request
   * @param {boolean} isWhisper - whether the request came from /agentpm
   */
  async handleAgentRequest(playerName, request, isWhisper = false) {
    const now = Date.now();

    // --- Per-player cooldown ---
    const cdExpiry = this.playerCooldowns.get(playerName);
    if (cdExpiry && cdExpiry > now) {
      const waitSec = Math.ceil((cdExpiry - now) / 1000);
      this.serverManager.sendCommand(
        `say ${this.replyPrefix}: 请稍候再试 (${waitSec}s)`
      );
      return;
    }

    // --- Duplicate-request guard ---
    const requestKey = `${playerName}:${request}`;
    if (this.processing.has(requestKey)) {
      this.serverManager.sendCommand(
        `say ${this.replyPrefix}: 正在处理中，请稍候`
      );
      return;
    }

    this.processing.set(requestKey, true);
    this.playerCooldowns.set(playerName, now + this.cooldownMs);

    // Safety timeout — auto-clear stuck entries so a frozen API call
    // doesn't permanently block the player.
    const safetyTimer = setTimeout(() => {
      this.processing.delete(requestKey);
    }, this.processingTimeoutMs);

    try {
      // Look up player permissions.
      const permission = this.permissionManager.getPlayerPermission(playerName);

      // Notify the web UI.
      this.emit('agent:player_request', {
        player: playerName,
        request,
        isWhisper,
        permission: permission.level,
        timestamp: Date.now(),
      });

      console.log(`[ChatMonitor] ${isWhisper ? 'whisper' : '@agent'} request: ${playerName} (OP${permission.level}): ${request}`);

      // Hand the request to the Agent.
      const result = await this.agentCore.handlePlayerRequest(
        playerName, request, permission, isWhisper
      );

      // Deliver the Agent response.
      if (result.reply) {
        if (isWhisper) {
          // Whispered requests get a private /tell reply.
          this.serverManager.sendCommand(`tell ${playerName} ${this.replyPrefix}: ${result.reply}`);
        } else {
          const prefix = this.replyPrefix;
          this.serverManager.sendCommand(`say ${prefix}: ${result.reply}`);
        }
        this.terminalManager.addOutput(`[Agent → ${playerName}${isWhisper ? ' (whisper)' : ''}] ${result.reply}`);
      }

      // Emit a concise stream event for the live @agent feed.
      this.emit('agent:player_reply', {
        player: playerName,
        request,
        isWhisper,
        reply: result.reply,
        timestamp: Date.now(),
      });

      // Notify the UI about the result.
      this.emit('agent:player_result', {
        player: playerName,
        request,
        isWhisper,
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
      this.serverManager.sendCommand(`say ${prefix}: AI暂时不可用，请稍后再试。`);
    } finally {
      clearTimeout(safetyTimer);
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
   * Destroy resources — clean up terminal listener and file watchers.
   */
  destroy() {
    if (this.terminalCleanup) {
      this.terminalCleanup();
      this.terminalCleanup = null;
    }
    this.listeners = [];
    this.playerCooldowns.clear();
    this.processing.clear();
    if (this.permissionManager) {
      this.permissionManager.destroy();
    }
  }
}

module.exports = ChatMonitor;
