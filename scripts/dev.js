#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const net = require('net');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'apps', 'desktop');

/** Port the desktop webview will load, taken from tauri.conf.json (devUrl).
 *  Vite must serve on this exact port or the window opens blank. */
function readDevUrlPort() {
  try {
    const conf = JSON.parse(
      fs.readFileSync(path.join(desktopDir, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    );
    const m = /:(\d+)/.exec(conf?.build?.devUrl || '');
    return m ? Number(m[1]) : 3000;
  } catch {
    return 3000;
  }
}
const DEV_URL_PORT = readDevUrlPort();

if (!process.env.VITE_PORT) {
  process.env.VITE_PORT = String(DEV_URL_PORT);
} else if (Number(process.env.VITE_PORT) !== DEV_URL_PORT) {
  console.warn(
    `\n[dev.js] VITE_PORT=${process.env.VITE_PORT} does not match tauri.conf.json devUrl ` +
      `port ${DEV_URL_PORT}. The desktop window loads the devUrl, so a mismatch results ` +
      `in a blank window. Removing VITE_PORT is recommended.\n`,
  );
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port, timeout: 800 });
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function isViteServedOn(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/@vite/client', timeout: 800 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200 || String(res.headers['server'] || '').includes('vite'));
      },
    );
    req.once('timeout', () => req.destroy());
    req.once('error', () => resolve(false));
  });
}

const LOCK_FILE = path.join(os.tmpdir(), 'erp-tauri-dev.lock');

/** Refuse a second concurrent session: PID lock plus a port probe as a
 *  fallback when the lock is stale/unparseable. */
async function ensureSingleInstance(port) {
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (lock && lock.pid && pidAlive(lock.pid)) {
      console.error(
        `\n[dev.js] Another pnpm tauri:dev session is already running (PID ${lock.pid}, ` +
          `started ${lock.startedAt}, port ${lock.port}).`,
      );
      console.error('Stop it first, then run pnpm tauri:dev again.');
      console.error(`If that session is gone, delete the stale lock: "${LOCK_FILE}"\n`);
      process.exit(1);
    }
  } catch {
    /* no lock yet — continue to the port probe */
  }

  if (await portInUse(port)) {
    if (await isViteServedOn(port)) {
      console.error(
        `\n[dev.js] Port ${port} is already serving Vite — another dev session appears ` +
          'to be running. Stop it first, then run pnpm tauri:dev again.\n',
      );
      process.exit(1);
    }
    console.error(
      `\n[dev.js] Port ${port} is in use by a NON-Vite process. Pick a free port (it must ` +
        `also match tauri.conf.json devUrl) and retry.\n`,
    );
    process.exit(1);
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }),
  );
}

function releaseLock() {
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    if (lock && lock.pid === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch {
    /* already gone */
  }
}

const env = { ...process.env };
if (process.platform === 'linux') {
  // Snap's core20 sets LD_LIBRARY_PATH to its own libpthread which is
  // incompatible with the system glibc.  Ensure it's cleared so the
  // dynamic linker picks up the system libraries.
  delete env.LD_LIBRARY_PATH;
  delete env.LD_PRELOAD;
}

// Workspace Rust bridge: Tauri's dev watcher only watches the app dir
// (apps/desktop/src-tauri), but the real Rust code lives in crates/*. This
// child rewrites an inert marker inside src-tauri on any crates change so
// `tauri dev` rebuilds + restarts automatically (see scripts/watch-crates.js).
let watcherChild = null;

function spawnWatcher() {
  const node = process.execPath;
  watcherChild = spawn(node, [path.join(root, 'scripts', 'watch-crates.js')], {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  watcherChild.on('error', (err) => {
    console.warn(`[dev.js] crates watcher failed to start: ${err.message} (dev continues)`);
  });
}

function stopWatcher() {
  if (watcherChild && !watcherChild.killed) {
    watcherChild.kill();
    watcherChild = null;
  }
}

function spawnTauri(cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  child.on('exit', (code) => {
    stopWatcher();
    releaseLock();
    if (code) {
      console.warn(
        '\n[dev.js] tauri dev exited with a non-zero code.\n' +
          '  • 0xC000013A (Ctrl+C) means a normal shutdown — nothing to fix.\n' +
          '  • If the error is "The process cannot access the file because it is being used by\n' +
          '    another process (os error 32)", a previous desktop.exe / cargo process still holds\n' +
          '    the build outputs. Close the running app (or kill stale desktop.exe / cargo) and\n' +
          '    run pnpm tauri:dev again.\n' +
          '  • A cargo compile error does NOT normally exit this session: tauri dev keeps\n' +
          '    watching, so fixing the code rebuilds automatically. If the session did exit\n' +
          '    during a build, the compile error is printed above.\n',
      );
    }
    process.exit(code ?? 1);
  });
  child.on('error', (err) => {
    stopWatcher();
    releaseLock();
    console.error(`Failed to spawn ${cmd}:`, err.message);
    process.exit(1);
  });
}

function ensureDist() {
  const distDir = path.join(desktopDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
}

function spawnDirect() {
  ensureDist();
  const isWin = process.platform === 'win32';
  // Resolve pnpm path via where/which to avoid spawn EINVAL
  let pnpmPath;
  try {
    pnpmPath = execSync(isWin ? 'where pnpm' : 'which pnpm', { encoding: 'utf8' })
      .split(/\r?\n/)[0].trim();
  } catch {
    pnpmPath = isWin ? 'pnpm.cmd' : 'pnpm';
  }
  if (isWin) {
    // Use cmd /c to invoke pnpm.cmd properly (avoids DEP0190 shell warning)
    spawnTauri('cmd.exe', ['/c', pnpmPath, 'exec', 'tauri', 'dev'], { cwd: desktopDir, env, windowsHide: true });
  } else {
    spawnTauri(pnpmPath, ['exec', 'tauri', 'dev'], { cwd: desktopDir, env });
  }
}

async function main() {
  await ensureSingleInstance(Number(process.env.VITE_PORT));

  // The watcher runs for every platform (win32 straight, linux through the env
  // wrapper below). Start it before `tauri dev` so the marker exists up front.
  spawnWatcher();

  process.on('SIGINT', () => {
    stopWatcher();
    releaseLock();
  });
  process.on('SIGTERM', () => {
    stopWatcher();
    releaseLock();
  });

  switch (process.platform) {
    case 'linux': {
      const envScript = path.join(root, 'scripts', 'env-local-deps.sh');
      const homeDir = require('os').homedir();
      const localPrefix = path.join(homeDir, '.local', 'linux-build-prefix');
      if (fs.existsSync(envScript) && fs.existsSync(path.join(localPrefix, 'usr', 'bin'))) {
        const bashCmd = `source "${envScript}" >/dev/null 2>&1 && exec pnpm exec tauri dev`;
        spawnTauri('bash', ['-c', bashCmd], { cwd: desktopDir, env });
      } else {
        spawnDirect();
      }
      break;
    }
    default:
      spawnDirect();
      break;
  }
}

main().catch((err) => {
  console.error('[dev.js] startup failed:', err);
  process.exit(1);
});