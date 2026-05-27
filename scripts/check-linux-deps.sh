#!/usr/bin/env bash
set -uo pipefail

ok=0
fail=0

check() {
  if "$@"; then
    echo "  OK   $*"
    ok=$((ok + 1))
  else
    echo "  FAIL $*"
    fail=$((fail + 1))
  fi
}

echo "=== Toolchain ==="
check command -v cc
check command -v pkg-config
check command -v rustc
check command -v cargo
check command -v pnpm

echo "=== pkg-config (dev headers) ==="
check pkg-config --exists gtk+-3.0
check pkg-config --exists webkit2gtk-4.1
check pkg-config --exists libsoup-3.0
check pkg-config --exists librsvg-2.0

echo "=== Summary ==="
echo "Passed: $ok  Failed: $fail"
if [[ "$fail" -gt 0 ]]; then
  echo "Run: sudo ./scripts/setup-linux.sh"
  exit 1
fi
