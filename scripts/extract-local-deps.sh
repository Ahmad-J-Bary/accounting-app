#!/usr/bin/env bash
set -euo pipefail

DEPS_DIR="${HOME}/.local/apt-deps"
PREFIX="${HOME}/.local/linux-build-prefix"

if [[ ! -d "${DEPS_DIR}" ]] || [[ -z "$(ls -A "${DEPS_DIR}"/*.deb 2>/dev/null)" ]]; then
  echo "No .deb files in ${DEPS_DIR}."
  echo "Option A (recommended): sudo ./scripts/setup-linux.sh"
  echo "Option B (no sudo): download .deb files to ${DEPS_DIR} then re-run this script"
  exit 1
fi

mapfile -t DEBS < <(find "${DEPS_DIR}" -maxdepth 1 \( -name '*_amd64.deb' -o -name '*_all.deb' \) | sort -u)
echo "==> Extracting ${#DEBS[@]} amd64/all packages to ${PREFIX}..."
rm -rf "${PREFIX}"
mkdir -p "${PREFIX}"
for deb in "${DEBS[@]}"; do
  dpkg-deb -x "${deb}" "${PREFIX}" 2>/dev/null || true
done

echo "==> Done. Activate via:"
echo "  source scripts/env-local-deps.sh"
