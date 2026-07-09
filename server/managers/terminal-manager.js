/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Terminal Manager - manages terminal stdin/stdout pipes.
 *
 * Uses a ring buffer (circular buffer) for O(1) append and eviction,
 * instead of Array.push + Array.shift which is O(n) per eviction
 * when the buffer is full.
 *
 * Ring buffer layout:
 *   buffer = [e0, e1, ..., e_{max-1}]   (pre-allocated, fixed size)
 *   head   = index where the NEXT entry will be written
 *   count  = number of valid entries (0 .. max)
 *
 * When the buffer is full (count === max), head wraps around and
 * overwrites the oldest entry — no shifting required.
 */
const fs = require('fs');
const path = require('path');

class TerminalManager {
  constructor(config) {
    this.config = config;
    this.maxHistory = config.terminal?.historySize || 5000;

    // Ring buffer — pre-allocate once, never resize.
    this.buffer = new Array(this.maxHistory);
    this.head = 0;   // Next write position.
    this.count = 0;  // Number of valid entries.

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
   * Add output to the ring buffer.
   * O(1) time complexity — no array shifting.
   */
  addOutput(line) {
    const entry = {
      text: line,
      timestamp: Date.now(),
    };

    // Write to the current head position.
    this.buffer[this.head] = entry;
    // Advance head with wrap-around.
    this.head = (this.head + 1) % this.maxHistory;
    // Track count until the buffer is full.
    if (this.count < this.maxHistory) {
      this.count += 1;
    }

    // Write to the log file.
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
   * Returns a cleanup function that removes the listener.
   */
  onOutput(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Convert the ring buffer to a flat array of entry objects.
   * Internal helper — callers should use getHistory / getRecentLines.
   */
  _toArray() {
    const result = new Array(this.count);
    // If the buffer hasn't wrapped yet, entries start at index 0.
    // If it has wrapped, the oldest entry is at `head` (which now
    // points to the slot that was overwritten first).
    const start = this.count < this.maxHistory ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(start + i) % this.maxHistory];
    }
    return result;
  }

  /**
   * Get historical output as an array of strings.
   */
  getHistory() {
    return this._toArray().map(e => e.text);
  }

  /**
   * Clear history.
   */
  clearHistory() {
    this.buffer = new Array(this.maxHistory);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Get the latest N lines.
   */
  getRecentLines(n = 50) {
    const all = this._toArray();
    return all.slice(-n).map(e => e.text);
  }

  /**
   * Search historical output.
   */
  searchHistory(keyword) {
    return this._toArray()
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
