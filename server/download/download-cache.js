/*
 * AI maintenance note: Keep all code comments in English.
 */

class DownloadCache {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    this.entries.set(key, { value, createdAt: Date.now() });
    return value;
  }

  wrap(key, loader) {
    const cached = this.get(key);
    if (cached) return cached;
    const promise = Promise.resolve().then(loader);
    this.set(key, promise);
    return promise;
  }
}

module.exports = DownloadCache;
