#!/usr/bin/env node
/*
 * AI maintenance note: Keep all code comments in English.
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DEFAULT_PORT = 3000;
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

function log(message = '') {
  console.log(message);
}

function fail(message, error) {
  console.error(`ERROR: ${message}`);
  if (error?.message) console.error(error.message);
  process.exit(1);
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: isWindows,
    ...options,
  });
}

function newestMtimeMs(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;

  let newest = stat.mtimeMs;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    newest = Math.max(newest, newestMtimeMs(path.join(target, entry.name)));
  }
  return newest;
}

function ensureDependencies() {
  const rootModules = path.join(ROOT, 'node_modules');
  const clientModules = path.join(ROOT, 'client', 'node_modules');

  if (fs.existsSync(rootModules) && fs.existsSync(clientModules)) {
    log('OK: Dependencies are ready.');
    return;
  }

  log('Installing dependencies. This may take a few minutes on first run...');
  try {
    run(npmCommand, ['install']);
  } catch (error) {
    fail('Dependency installation failed.', error);
  }
}

function ensureClientBuild() {
  const clientDir = path.join(ROOT, 'client');
  const distIndex = path.join(clientDir, 'dist', 'index.html');
  const sourceNewest = Math.max(
    newestMtimeMs(path.join(clientDir, 'src')),
    newestMtimeMs(path.join(clientDir, 'public')),
    newestMtimeMs(path.join(clientDir, 'index.html')),
    newestMtimeMs(path.join(clientDir, 'vite.config.js')),
    newestMtimeMs(path.join(clientDir, 'tailwind.config.js')),
  );
  const distTime = newestMtimeMs(distIndex);

  if (distTime >= sourceNewest && fs.existsSync(distIndex)) {
    log('OK: Frontend build is ready.');
    return;
  }

  log('Building frontend...');
  try {
    run(npmCommand, ['run', 'build']);
  } catch (error) {
    fail('Frontend build failed.', error);
  }
}

function ensureLocalConfig() {
  const localConfigPath = path.join(ROOT, 'config.local.json');
  if (fs.existsSync(localConfigPath)) {
    log('OK: config.local.json is ready.');
    return;
  }

  const defaultConfig = require('./server/config');
  fs.writeFileSync(localConfigPath, JSON.stringify(defaultConfig, null, 2));
  log('Created config.local.json from default settings.');
}

async function checkJava() {
  try {
    const JavaManager = require('./server/managers/java-manager');
    const config = require('./server/config');
    const javaManager = new JavaManager(config);
    const javaStatus = await javaManager.detectJava();

    if (!javaStatus.found) {
      log('WARN: Java was not detected. You can configure Java from the web UI.');
      return;
    }

    const first = javaStatus.javas?.[0];
    log(`OK: Java ${first?.majorVersion || ''} ${first?.source ? `(${first.source})` : ''}`.trim());
  } catch (error) {
    log(`WARN: Java check skipped: ${error.message}`);
  }
}

function openDefaultBrowser(port) {
  const url = `http://localhost:${port}`;
  log(`Opening default browser: ${url}`);

  try {
    if (isWindows) {
      spawn('cmd', ['/c', 'start', '""', url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    log(`WARN: Could not open the browser automatically. Visit ${url} manually.`);
  }
}

function startServer() {
  log('');
  log('Starting server...');
  log(`Close this window to stop localhost:${DEFAULT_PORT}.`);
  log('');

  const server = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
    windowsHide: false,
  });

  let browserOpened = false;
  let stdoutBuffer = '';
  let shuttingDown = false;

  const openOnce = (port) => {
    if (browserOpened) return;
    browserOpened = true;
    openDefaultBrowser(port);
    if (Number(port) !== DEFAULT_PORT) {
      log(`WARN: Port ${DEFAULT_PORT} was not available. EasyMC opened localhost:${port} instead.`);
    }
  };

  server.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    stdoutBuffer += text;
    const portMatch = stdoutBuffer.match(/\[EasyMC:PORT\](\d+)/);
    if (portMatch) openOnce(Number(portMatch[1]));
  });

  server.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  const fallbackTimer = setTimeout(() => {
    openOnce(DEFAULT_PORT);
  }, 5000);

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(fallbackTimer);
    log('');
    log('Stopping EasyMC Server Agent...');
    server.kill('SIGTERM');
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    if (!shuttingDown && !server.killed) server.kill('SIGTERM');
  });

  server.on('exit', (code, signal) => {
    clearTimeout(fallbackTimer);
    if (shuttingDown) process.exit(0);

    log('');
    log(`EasyMC Server Agent stopped unexpectedly. Code: ${code ?? 'none'} Signal: ${signal ?? 'none'}`);
    process.exit(code || 1);
  });
}

async function main() {
  log('');
  log('============================================================');
  log('  EasyMC Server Agent');
  log('============================================================');
  log('');
  log(`Working directory: ${ROOT}`);

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    fail(`Node.js 18 or newer is required. Current version: ${process.version}`);
  }
  log(`OK: Node.js ${process.version}`);

  ensureDependencies();
  ensureClientBuild();
  ensureLocalConfig();
  await checkJava();
  startServer();
}

main().catch((error) => {
  fail('Startup failed.', error);
});
