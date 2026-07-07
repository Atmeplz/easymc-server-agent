/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * FileGuard - path safety validation.
 * Treats the project root as the Agent workspace and blocks sensitive paths.
 */
const path = require('path');
const fs = require('fs');

class FileGuard {
  constructor(config) {
    // Workspace root equals project root.
    this.projectRoot = path.resolve(process.cwd());

    // Blocked directories relative to the project root.
    this.blockedDirs = [
      'node_modules',
      '.git',
      '.claude',
      'client/node_modules',
      'client/dist',
    ].map(d => path.join(this.projectRoot, d));

    // Blocked files.
    this.blockedFiles = [
      'config.local.json',
      '.env',
      '.gitignore',
      'package-lock.json',
      'client/package-lock.json',
    ].map(f => path.join(this.projectRoot, f));
  }

  /**
   * Validate whether a path is allowed.
   * @param {string} inputPath - Path to validate, relative to project root or absolute.
   * @param {'read'|'write'} mode - Access mode.
   * @returns {{ allowed: boolean, resolvedPath: string, reason?: string }}
   */
  validate(inputPath, mode = 'read') {
    // 1. Convert to an absolute path.
    const resolved = path.resolve(this.projectRoot, inputPath);

    // 2. Require the path to stay inside the project root.
    if (!resolved.startsWith(this.projectRoot + path.sep) && resolved !== this.projectRoot) {
      return { allowed: false, resolvedPath: resolved, reason: '路径超出工作区范围' };
    }

    // 3. Check blocked directories.
    for (const blocked of this.blockedDirs) {
      if (resolved === blocked || resolved.startsWith(blocked + path.sep)) {
        return { allowed: false, resolvedPath: resolved, reason: '该目录不允许访问' };
      }
    }

    // 4. Check blocked files.
    if (this.blockedFiles.some(f => resolved === f)) {
      return { allowed: false, resolvedPath: resolved, reason: '该文件不允许访问（敏感配置）' };
    }

    // 5. For writes, block system-level files.
    if (mode === 'write') {
      const relPath = path.relative(this.projectRoot, resolved);
      const topDir = relPath.split(path.sep)[0];
      // Block direct writes to project-root JS/JSON config files such as package.json.
      if (!relPath.includes(path.sep) && (relPath.endsWith('.json') || relPath.endsWith('.js'))) {
        return { allowed: false, resolvedPath: resolved, reason: '不允许写入项目根目录的配置文件' };
      }
    }

    // 6. Prevent symlink escapes.
    try {
      const real = fs.realpathSync(resolved);
      if (real !== resolved && !real.startsWith(this.projectRoot + path.sep) && real !== this.projectRoot) {
        return { allowed: false, resolvedPath: resolved, reason: '符号链接指向了工作区外' };
      }
    } catch (e) {
      if (mode === 'read') {
        return { allowed: false, resolvedPath: resolved, reason: '路径不存在' };
      }
    }

    return { allowed: true, resolvedPath: resolved };
  }

  /**
   * List first-level project-root files while excluding sensitive directories.
   */
  listWorkspaceFiles(subDir = '') {
    const target = subDir ? path.join(this.projectRoot, subDir) : this.projectRoot;
    if (!fs.existsSync(target)) return [];

    const entries = fs.readdirSync(target, { withFileTypes: true });
    return entries
      .filter(e => !['node_modules', '.git', '.claude', 'client'].includes(e.name))
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        path: path.relative(this.projectRoot, path.join(target, e.name)),
      }));
  }
}

module.exports = FileGuard;
