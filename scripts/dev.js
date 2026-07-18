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

function spawnTauri(cmd, args, opts) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  child.on('exit', (code) => process.exit(code ?? 1));
  child.on('error', (err) => {
    console.error(`Failed to spawn ${cmd}:`, err.message);
    process.exit(1);
  });
}

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
  case 'win32':
    spawnDirect();
    break;
  default:
    spawnDirect();
    break;
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
