#!/usr/bin/env node
// Cross-platform clean script.
// Usage: node scripts/clean.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const dirs = [
  'node_modules',
  'apps/desktop/node_modules',
  'packages/shared-types/node_modules',
  'dist',
  'apps/desktop/dist',
  'apps/desktop/dist-ssr',
  'target',
  'apps/desktop/src-tauri/target',
  'apps/desktop/src-tauri/gen',
  '.turbo',
  '.next',
  'out',
];

for (const dir of dirs) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  removed ${dir}/`);
  }
}

// Delete *.tsbuildinfo files
function deleteTsBuildInfo(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      deleteTsBuildInfo(full);
    } else if (entry.name.endsWith('.tsbuildinfo')) {
      fs.rmSync(full, { force: true });
      console.log(`  removed ${path.relative(root, full)}`);
    }
  }
}
deleteTsBuildInfo(root);

console.log('Project build artifacts removed.');
