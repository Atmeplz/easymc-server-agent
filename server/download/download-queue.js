/*
 * AI maintenance note: Keep all code comments in English.
 */
const { EventEmitter } = require('events');

class DownloadQueue extends EventEmitter {
  constructor() {
    super();
    this.items = [];
  }

  create(meta = {}) {
    const item = {
      id: `download_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...meta,
    };
    this.items.unshift(item);
    this.emit('queue', this.list());
    this.emit('queued', item);
    return item;
  }

  update(id, patch) {
    const item = this.items.find(entry => entry.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: Date.now() });
    this.emit('queue', this.list());
    this.emit('progress', item);
    return item;
  }

  complete(id, patch = {}) {
    const item = this.update(id, { status: 'complete', progress: 100, ...patch });
    if (item) this.emit('complete', item);
    return item;
  }

  fail(id, error) {
    const item = this.update(id, { status: 'error', error: error?.message || String(error) });
    if (item) this.emit('error', item);
    return item;
  }

  list() {
    return this.items.slice(0, 50);
  }

  clearCompleted() {
    this.items = this.items.filter(item => item.status !== 'complete');
    this.emit('queue', this.list());
    return this.list();
  }

  clearAll() {
    this.items = [];
    this.emit('queue', this.list());
    return this.list();
  }
}

module.exports = DownloadQueue;
