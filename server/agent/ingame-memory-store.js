/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Ingame Memory Store - persistent runtime memory for the @agent system.
 *
 * Storage layout:
 *   mc-server/ingame_memory/
 *     meta.json
 *     old_memory/<timestamp>/<uuid>/public.md
 *     old_memory/<timestamp>/<uuid>/private.md
 *     <uuid-playerA>/public.md
 *     <uuid-playerA>/private.md
 *
 * Public memory can be read by any player. Private memory can only be read
 * by the owning player (callerUuid === ownerUuid).
 */
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = '1.0.0';
const OLD_MEMORY_RETENTION = 5;

class IngameMemoryStore {
  constructor(serverDir, options = {}) {
    this.serverDir = serverDir;
    const memDir = options.ingameMemoryDir || 'ingame_memory';
    // Support both relative (to serverDir) and absolute paths.
    this.baseDir = path.isAbsolute(memDir) ? memDir : path.join(serverDir, memDir);
    this.metaPath = path.join(this.baseDir, 'meta.json');
    this.oldMemoryDir = path.join(this.baseDir, 'old_memory');
  }

  /**
   * Ensure the directory structure exists.
   */
  ensureStructure() {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.oldMemoryDir, { recursive: true });
    if (!fs.existsSync(this.metaPath)) {
      this._writeMeta({
        schemaVersion: SCHEMA_VERSION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Resolve a player name to UUID using usercache.json.
   * Falls back to null if not found.
   */
  _resolveUuid(name) {
    const cachePath = path.join(this.serverDir, 'usercache.json');
    if (!fs.existsSync(cachePath)) return null;
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const entry = cache.find(
        (e) => e.name && e.name.toLowerCase() === name.toLowerCase()
      );
      return entry?.uuid || null;
    } catch (error) {
      console.error('[IngameMemoryStore] Failed to parse usercache.json:', error.message);
      return null;
    }
  }

  /**
   * Resolve a UUID to the last known name using usercache.json.
   */
  _resolveName(uuid) {
    const cachePath = path.join(this.serverDir, 'usercache.json');
    if (!fs.existsSync(cachePath)) return null;
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const entry = cache.find(
        (e) => e.uuid && e.uuid.toLowerCase() === uuid.toLowerCase()
      );
      return entry?.name || null;
    } catch (error) {
      console.error('[IngameMemoryStore] Failed to parse usercache.json:', error.message);
      return null;
    }
  }

  /**
   * Get the directory for a given player UUID.
   */
  _playerDir(uuid) {
    return path.join(this.baseDir, uuid);
  }

  /**
   * Read the meta file.
   */
  _readMeta() {
    if (!fs.existsSync(this.metaPath)) {
      return { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString() };
    }
    return JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
  }

  /**
   * Write the meta file.
   */
  _writeMeta(meta) {
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Touch updatedAt in meta.json.
   */
  _touchMeta() {
    const meta = this._readMeta();
    meta.updatedAt = new Date().toISOString();
    this._writeMeta(meta);
  }

  /**
   * Read a memory file and return parsed frontmatter + body.
   */
  _readMemoryFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return { frontmatter: {}, body: raw };
    }
    const frontmatter = {};
    for (const line of frontmatterMatch[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return { frontmatter, body: frontmatterMatch[2].trim() };
  }

  /**
   * Write a memory file with frontmatter + body.
   */
  _writeMemoryFile(filePath, frontmatter, body) {
    const fmLines = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    const content = `---\n${fmLines}\n---\n\n${body.trim()}\n`;
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Ensure a player directory and base memory files exist.
   */
  _ensurePlayerFiles(uuid, name) {
    const dir = this._playerDir(uuid);
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    for (const type of ['public', 'private']) {
      const filePath = path.join(dir, `${type}.md`);
      if (!fs.existsSync(filePath)) {
        this._writeMemoryFile(
          filePath,
          {
            playerUuid: uuid,
            playerName: name,
            type,
            createdAt: now,
            updatedAt: now,
          },
          ''
        );
      }
    }
  }

  /**
   * Read public memory of any player.
   */
  readPublic(targetName, callerName) {
    const uuid = this._resolveUuid(targetName);
    if (!uuid) {
      return {
        success: false,
        error: `找不到玩家 "${targetName}" 的 UUID。`,
      };
    }
    this._ensurePlayerFiles(uuid, targetName);
    const filePath = path.join(this._playerDir(uuid), 'public.md');
    const data = this._readMemoryFile(filePath);
    return {
      success: true,
      targetPlayer: targetName,
      targetUuid: uuid,
      caller: callerName,
      content: data.body || '',
      frontmatter: data.frontmatter || {},
    };
  }

  /**
   * Read private memory of the calling player only.
   */
  readPrivate(callerName) {
    const uuid = this._resolveUuid(callerName);
    if (!uuid) {
      return {
        success: false,
        error: `找不到玩家 "${callerName}" 的 UUID。`,
      };
    }
    this._ensurePlayerFiles(uuid, callerName);
    const filePath = path.join(this._playerDir(uuid), 'private.md');
    const data = this._readMemoryFile(filePath);
    return {
      success: true,
      caller: callerName,
      callerUuid: uuid,
      content: data.body || '',
      frontmatter: data.frontmatter || {},
    };
  }

  /**
   * Write to public memory of the calling player.
   */
  writePublic(callerName, content, append = true) {
    return this._writeMemory(callerName, 'public', content, append);
  }

  /**
   * Write to private memory of the calling player.
   */
  writePrivate(callerName, content, append = true) {
    return this._writeMemory(callerName, 'private', content, append);
  }

  /**
   * Internal write helper.
   */
  _writeMemory(callerName, type, content, append) {
    const uuid = this._resolveUuid(callerName);
    if (!uuid) {
      return {
        success: false,
        error: `找不到玩家 "${callerName}" 的 UUID，无法写入记忆。`,
      };
    }
    this._ensurePlayerFiles(uuid, callerName);
    const filePath = path.join(this._playerDir(uuid), `${type}.md`);
    const data = this._readMemoryFile(filePath);
    const now = new Date().toISOString();
    const frontmatter = data.frontmatter || {
      playerUuid: uuid,
      playerName: callerName,
      type,
      createdAt: now,
    };
    frontmatter.playerName = callerName;
    frontmatter.updatedAt = now;

    const existingBody = data.body || '';
    const newBody = append && existingBody
      ? `${existingBody}\n- ${content}`
      : `- ${content}`;

    this._writeMemoryFile(filePath, frontmatter, newBody);
    this._touchMeta();

    return {
      success: true,
      caller: callerName,
      callerUuid: uuid,
      type,
      wrote: content,
      append,
    };
  }

  /**
   * List all players that have memory entries.
   */
  listPlayers() {
    const entries = [];
    for (const name of fs.readdirSync(this.baseDir)) {
      const dirPath = path.join(this.baseDir, name);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      if (name === 'old_memory') continue;
      const publicPath = path.join(dirPath, 'public.md');
      if (!fs.existsSync(publicPath)) continue;
      const data = this._readMemoryFile(publicPath);
      entries.push({
        uuid: name,
        playerName: data.frontmatter?.playerName || this._resolveName(name) || name,
        updatedAt: data.frontmatter?.updatedAt || null,
      });
    }
    return { success: true, players: entries };
  }

  /**
   * Archive the current memory into old_memory/<timestamp>/.
   * Called when the world is detected to have been replaced.
   */
  archiveOldMemory() {
    // Skip archive if there is no actual player data to preserve.
    const hasPlayerData = fs.existsSync(this.baseDir) &&
      fs.readdirSync(this.baseDir).some((name) => {
        if (name === 'old_memory' || name === 'meta.json') return false;
        return fs.statSync(path.join(this.baseDir, name)).isDirectory();
      });
    if (!hasPlayerData) {
      return { success: true, skipped: true, reason: 'No player memory to archive.' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(this.oldMemoryDir, timestamp);
    fs.mkdirSync(archiveDir, { recursive: true });

    for (const name of fs.readdirSync(this.baseDir)) {
      const sourcePath = path.join(this.baseDir, name);
      const destPath = path.join(archiveDir, name);
      if (name === 'old_memory') continue;
      if (!fs.statSync(sourcePath).isDirectory() && name !== 'meta.json') continue;
      fs.cpSync(sourcePath, destPath, { recursive: true });
      fs.rmSync(sourcePath, { recursive: true, force: true });
    }

    this._cleanupOldArchives();
    this.ensureStructure();

    return {
      success: true,
      archivedTo: `ingame_memory/old_memory/${timestamp}`,
    };
  }

  /**
   * Keep only the most recent OLD_MEMORY_RETENTION archives.
   */
  _cleanupOldArchives() {
    const entries = fs.readdirSync(this.oldMemoryDir)
      .map((name) => {
        const fullPath = path.join(this.oldMemoryDir, name);
        return { name, fullPath, time: fs.statSync(fullPath).ctimeMs };
      })
      .sort((a, b) => b.time - a.time);

    for (let i = OLD_MEMORY_RETENTION; i < entries.length; i += 1) {
      fs.rmSync(entries[i].fullPath, { recursive: true, force: true });
    }
  }

  /**
   * Detect whether the world appears to have been replaced.
   * Returns true if world/level.dat is older than the memory store.
   */
  isWorldReplaced(worldName = 'world') {
    const worldLevelPath = path.join(this.serverDir, worldName, 'level.dat');
    if (!fs.existsSync(worldLevelPath)) return false;
    const meta = this._readMeta();
    if (!meta.createdAt) return false;
    const worldMtime = fs.statSync(worldLevelPath).mtimeMs;
    const memoryCreated = new Date(meta.createdAt).getTime();
    return worldMtime < memoryCreated;
  }
}

module.exports = IngameMemoryStore;
