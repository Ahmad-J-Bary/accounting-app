#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

rm -rf node_modules apps/desktop/node_modules packages/shared-types/node_modules
rm -rf dist apps/desktop/dist dist-ssr apps/desktop/dist-ssr
rm -rf target apps/desktop/src-tauri/target apps/desktop/src-tauri/gen
rm -rf .turbo .next out
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "Project build artifacts removed."
