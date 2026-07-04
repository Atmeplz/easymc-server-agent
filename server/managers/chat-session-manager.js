/*
 * AI maintenance note: Keep all code comments in English.
 */
const fs = require('fs');
const path = require('path');

class ChatSessionManager {
  constructor(rootDir = process.cwd()) {
    this.dataDir = path.join(rootDir, '.easymc');
    this.filePath = path.join(this.dataDir, 'chat-sessions.json');
    this.sessions = [];
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.sessions = [];
        return;
      }
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    } catch (err) {
      console.warn('[ChatSessionManager] Failed to load sessions:', err.message);
      this.sessions = [];
    }
  }

  save() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify({ sessions: this.sessions }, null, 2), 'utf-8');
  }

  listSessions() {
    return this.sessions
      .map(session => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createSession(title = 'New chat') {
    const now = Date.now();
    const session = {
      id: `session_${now}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.sessions.unshift(session);
    this.save();
    return session;
  }

  getSession(id) {
    return this.sessions.find(session => session.id === id) || null;
  }

  ensureSession(id) {
    if (id) {
      const existing = this.getSession(id);
      if (existing) return existing;
    }
    return this.createSession();
  }

  deleteSession(id) {
    const before = this.sessions.length;
    this.sessions = this.sessions.filter(session => session.id !== id);
    const removed = this.sessions.length !== before;
    if (removed) this.save();
    return removed;
  }

  appendMessage(id, message) {
    const session = this.ensureSession(id);
    const entry = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: message.timestamp || Date.now(),
      ...message,
    };
    session.messages.push(entry);
    session.updatedAt = entry.timestamp;

    if ((!session.title || session.title === 'New chat') && message.role === 'user' && message.content) {
      session.title = this.titleFromMessage(message.content);
    }

    this.save();
    return { session, message: entry };
  }

  titleFromMessage(text) {
    const compact = String(text).replace(/\s+/g, ' ').trim();
    return compact.length > 34 ? `${compact.slice(0, 34)}...` : compact || 'New chat';
  }

  toModelHistory(session) {
    return session.messages
      .filter(message => ['user', 'assistant'].includes(message.role) && message.content)
      .map(message => ({ role: message.role, content: message.content }));
  }
}

module.exports = ChatSessionManager;
