#!/usr/bin/env bash
# Activate user-local apt packages extracted under ~/.local/linux-build-prefix
PREFIX="${HOME}/.local/linux-build-prefix"
if [[ ! -d "${PREFIX}/usr/bin" ]]; then
  echo "Missing ${PREFIX}. Run: ./scripts/extract-local-deps.sh"
  return 1 2>/dev/null || exit 1
fi

export PATH="${PREFIX}/usr/bin:${PREFIX}/usr/sbin:${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"
export PKG_CONFIG_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu/pkgconfig:${PREFIX}/usr/share/pkgconfig:${PKG_CONFIG_PATH:-}"
export LIBRARY_PATH="${PREFIX}/usr/lib/x86_64-linux-gnu:${PREFIX}/lib/x86_64-linux-gnu:${LIBRARY_PATH:-}"
# LD_LIBRARY_PATH deliberately left unset — the system provides all
# runtime libraries (webkit2gtk, gtk3, glib …).  The local prefix only
# supplies build‑time headers / .pc files / static archives.
# Setting LD_LIBRARY_PATH to the prefix would override the system
# libpthread.so.0 / libc.so.6 and cause a glibc mismatch at runtime.
# Also unset any inherited value (e.g. from snap's core20) to prevent
# the same mismatch.
unset LD_LIBRARY_PATH
unset LD_PRELOAD
export C_INCLUDE_PATH="${PREFIX}/usr/include:${C_INCLUDE_PATH:-}"

export CC="${PREFIX}/usr/bin/gcc"
export CXX="${PREFIX}/usr/bin/g++"
[[ -x "${CC}" ]] && ln -sf gcc "${PREFIX}/usr/bin/cc" 2>/dev/null || true
[[ -x "${CXX}" ]] && ln -sf g++ "${PREFIX}/usr/bin/c++" 2>/dev/null || true
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER="${CC}"
