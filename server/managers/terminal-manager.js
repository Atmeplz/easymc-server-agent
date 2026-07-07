/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Terminal Manager - manages terminal stdin/stdout pipes.
 * Ring buffer plus output callbacks.
 */
const fs = require('fs');
const path = require('path');

class TerminalManager {
  constructor(config) {
    this.config = config;
    this.history = [];
    this.maxHistory = config.terminal?.historySize || 5000;
    this.listeners = [];
    this.logStream = null;

    if (config.terminal?.logToFile) {
      this.initLogFile();
    }
  }

  initLogFile() {
    const logDir = path.join(process.cwd(), 'mc-server', 'logs');
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const logPath = path.join(logDir, 'agent-terminal.log');
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    } catch (e) {
      console.warn('[TerminalManager] 无法创建日志文件:', e.message);
    }
  }

  /**
   * Add output to the ring-buffer history.
   */
  addOutput(line) {
    const entry = {
      text: line,
      timestamp: Date.now(),
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Write to the log.
    if (this.logStream) {
      this.logStream.write(`[${new Date().toISOString()}] ${line}\n`);
    }

    // Notify listeners.
    for (const listener of this.listeners) {
      try {
        listener(line);
      } catch (e) {
        // Ignore listener errors.
      }
    }
  }

  /**
   * Register an output callback.
   */
  onOutput(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Get historical output.
   */
  getHistory() {
    return this.history.map(e => e.text);
  }

  /**
   * Clear history.
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get the latest N lines.
   */
  getRecentLines(n = 50) {
    return this.history.slice(-n).map(e => e.text);
  }

  /**
   * Search historical output.
   */
  searchHistory(keyword) {
    return this.history
      .filter(e => e.text.includes(keyword))
      .map(e => e.text);
  }

  /**
   * Destroy resources.
   */
  destroy() {
    this.listeners = [];
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

module.exports = TerminalManager;
