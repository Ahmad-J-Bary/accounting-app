#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const desktopDir = path.join(root, 'apps', 'desktop');

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
    if (code) {
      console.warn(
        '\n[dev.js] tauri dev exited with a non-zero code.\n' +
        '  If the error is "The process cannot access the file because it is being used by\n' +
        '  another process (os error 32)", a previous desktop.exe / cargo process still holds\n' +
        '  the build outputs. Close the running app (or kill stale desktop.exe / cargo) and\n' +
        '  run pnpm tauri:dev again.',
      );
    }
    process.exit(code ?? 1);
  });
  child.on('error', (err) => {
    stopWatcher();
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

// The watcher runs for every platform (win32 straight, linux through the env
// wrapper below). Start it before `tauri dev` so the marker exists up front.
spawnWatcher();

process.on('SIGINT', () => stopWatcher());

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