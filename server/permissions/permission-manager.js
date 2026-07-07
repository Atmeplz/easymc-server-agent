/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Permission Manager - manages player permissions.
 * Reads ops.json to get player OP levels.
 */
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class PermissionManager {
  constructor(serverDir) {
    this.serverDir = serverDir;
    this.opsPath = path.join(serverDir, 'ops.json');
    this.opsCache = [];
    this.watcher = null;

    this.loadOps();
    this.watchOpsFile();
  }

  /**
   * Get player permission information.
   */
  getPlayerPermission(playerName) {
    const ops = this.opsCache;
    const opEntry = ops.find(
      op => op.name.toLowerCase() === playerName.toLowerCase()
    );

    if (!opEntry) {
      return { level: 0, isOp: false, description: '普通玩家' };
    }

    return {
      level: opEntry.level,
      isOp: true,
      bypassesPlayerLimit: opEntry.bypassesPlayerLimit || false,
      description: this.getLevelDescription(opEntry.level),
    };
  }

  /**
   * Describe a permission level.
   */
  getLevelDescription(level) {
    const descriptions = {
      0: '普通玩家',
      1: 'Moderator',
      2: 'Gamemaster（可使用大部分游戏命令）',
      3: 'Admin（可使用管理命令）',
      4: 'Owner（管理员，可执行所有命令）',
    };
    return descriptions[level] || '未知等级';
  }

  /**
   * Load ops.json.
   */
  loadOps() {
    try {
      if (fs.existsSync(this.opsPath)) {
        const content = fs.readFileSync(this.opsPath, 'utf-8');
        this.opsCache = JSON.parse(content);
        console.log(`[PermissionManager] 加载了 ${this.opsCache.length} 个 OP`);
      } else {
        this.opsCache = [];
      }
    } catch (e) {
      console.warn('[PermissionManager] ops.json 读取失败:', e.message);
      this.opsCache = [];
    }
  }

  /**
   * Watch ops.json changes.
   */
  watchOpsFile() {
    try {
      this.watcher = chokidar.watch(this.opsPath, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 500 },
      });

      this.watcher.on('change', () => {
        console.log('[PermissionManager] ops.json 已更新，重新加载');
        this.loadOps();
      });
    } catch (e) {
      console.warn('[PermissionManager] 文件监听启动失败:', e.message);
    }
  }

  /**
   * Get all OP entries.
   */
  getAllOps() {
    return this.opsCache.map(op => ({
      name: op.name,
      level: op.level,
      description: this.getLevelDescription(op.level),
    }));
  }

  /**
   * Destroy resources.
   */
  destroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

module.exports = PermissionManager;
