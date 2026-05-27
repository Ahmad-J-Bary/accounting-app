#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Almowakeb – Linux development environment setup
# ─────────────────────────────────────────────────────────────────
# Runs on Debian / Ubuntu.  For other distros adapt the apt list.
#
# Two modes:
#   1) Global install (recommended when sudo is available)
#      → this script installs everything via apt.
#   2) User‑local toolchain (when sudo is unavailable)
#      → run ./scripts/extract-local-deps.sh first, then
#        source scripts/env-local-deps.sh before building.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── System packages ────────────────────────────────────────────
echo "==> Installing Linux build dependencies (apt)..."
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  git \
  pkg-config \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libsoup-3.0-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev

# ── Rust ───────────────────────────────────────────────────────
if ! command -v rustc >/dev/null 2>&1; then
  echo "==> Installing Rust (rustup)..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
else
  echo "==> Rust already installed: $(rustc --version)"
fi

# ── pnpm ───────────────────────────────────────────────────────
echo "==> Installing pnpm (11.3.0)..."
chmod +x scripts/install-pnpm.sh
./scripts/install-pnpm.sh

# ── JS dependencies ────────────────────────────────────────────
echo "==> Installing JavaScript workspace dependencies..."
export CI=true
export PATH="${HOME}/.local/bin:${PATH}"
pnpm install --frozen-lockfile

# ── Done ───────────────────────────────────────────────────────
echo ""
echo "============================================"
echo " Linux setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  source \"\$HOME/.cargo/env\""
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo "  pnpm tauri:dev"
echo ""
echo "On systems without sudo (or without the apt packages above):"
echo "  1. ./scripts/extract-local-deps.sh     # unpack a portable build prefix"
echo "  2. source scripts/env-local-deps.sh    # activate it (sets CC/CXX/PKG_CONFIG_PATH)"
echo "  3. pnpm tauri:dev"
echo ""
echo "The dev.js script (used by pnpm tauri:dev) automatically sources"
echo "env-local-deps.sh when the local prefix is detected."
