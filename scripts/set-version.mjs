#!/usr/bin/env node
/**
 * set-version.mjs
 * Updates all package/config version fields to the given version.
 *
 * Usage:
 *   node scripts/set-version.mjs 1.2.3
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');

const raw = process.argv[2];
if (!raw) {
  console.error('Usage: node scripts/set-version.mjs <version>');
  process.exit(1);
}
const version = raw.replace(/^v/, '');
console.log(`Setting version → ${version}`);

function updateJson(relPath) {
  try {
    const abs  = resolve(root, relPath);
    if (!existsSync(abs)) {
        console.warn(`  !  Skipping ${relPath}: File not found`);
        return;
    }
    const json = JSON.parse(readFileSync(abs, 'utf8'));
    json.version = version;
    writeFileSync(abs, JSON.stringify(json, null, 2) + '\n');
    console.log(`  ✓  ${relPath}`);
  } catch (e) {
    console.error(`  ✗  Failed to update ${relPath}: ${e.message}`);
  }
}

function updateToml(relPath) {
  try {
    const abs     = resolve(root, relPath);
    if (!existsSync(abs)) {
        console.warn(`  !  Skipping ${relPath}: File not found`);
        return;
    }
    const content = readFileSync(abs, 'utf8');
    const updated = content.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
    writeFileSync(abs, updated);
    console.log(`  ✓  ${relPath}`);
  } catch (e) {
    console.error(`  ✗  Failed to update ${relPath}: ${e.message}`);
  }
}

// ── JSON files ───────────────────────────────────────────────────────────────
updateJson('package.json');
updateJson('apps/desktop/package.json');
updateJson('apps/desktop/src-tauri/tauri.conf.json');
updateJson('packages/shared-types/package.json');
updateJson('crates/tauri-adapter/tauri.conf.json');

// ── TOML files ───────────────────────────────────────────────────────────────
updateToml('apps/desktop/src-tauri/Cargo.toml');
updateToml('crates/application/Cargo.toml');
updateToml('crates/domain/Cargo.toml');
updateToml('crates/infrastructure/Cargo.toml');
updateToml('crates/ports/Cargo.toml');
updateToml('crates/tauri-adapter/Cargo.toml');

console.log('\nDone.');
