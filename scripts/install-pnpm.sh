#!/usr/bin/env bash
# Install pnpm for the current user (no sudo). Works on Linux and macOS.
# Version matches package.json packageManager.
set -euo pipefail

VERSION="11.3.0"
BIN_DIR="${HOME}/.local/bin"
mkdir -p "${BIN_DIR}"

if command -v pnpm >/dev/null 2>&1 && pnpm --version 2>/dev/null | grep -q "^${VERSION}$"; then
  echo "pnpm ${VERSION} already available: $(command -v pnpm)"
  exit 0
fi

if command -v corepack >/dev/null 2>&1; then
  echo "==> Activating pnpm via corepack..."
  corepack prepare "pnpm@${VERSION}" --activate
  if command -v pnpm >/dev/null 2>&1; then
    echo "pnpm $(pnpm --version) ready"
    exit 0
  fi
fi

# ── Detect OS and architecture for the standalone binary ──────────
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "${OS}" in
  linux)  OS="linux"  ;;
  darwin) OS="macos"  ;;
  *)
    echo "Unsupported OS: ${OS}. Try corepack instead."
    exit 1
    ;;
esac

case "${ARCH}" in
  x86_64|amd64) ARCH="x64"  ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: ${ARCH}"
    exit 1
    ;;
esac

DOWNLOAD_URL="https://github.com/pnpm/pnpm/releases/download/v${VERSION}/pnpm-${OS}-${ARCH}"
echo "==> Downloading pnpm standalone binary from ${DOWNLOAD_URL}..."
curl -fsSL -o "${BIN_DIR}/pnpm" "${DOWNLOAD_URL}"
chmod +x "${BIN_DIR}/pnpm"

echo "pnpm $(\"${BIN_DIR}/pnpm\" --version) installed to ${BIN_DIR}/pnpm"
echo "Add to shell: export PATH=\"\${HOME}/.local/bin:\${PATH}\""
