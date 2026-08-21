# Contributing

This is a Tauri v2 + React workspace. One command drives the whole development
loop:

```bash
pnpm tauri:dev
```

No `pnpm build` is ever required between edits during development.

## The dev loop

| You edit…                          | What happens                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `apps/desktop/src/**` (React/TSX)  | Vite HMR — live update, state preserved                                       |
| `apps/desktop/src/**/*.css`        | Vite HMR — live restyle                                                        |
| `packages/*` (`@erp/shared-types`) | Vite HMR — source-linked, explicitly watched + excluded from pre-bundling    |
| `crates/**/*.rs`, `Cargo.toml`     | Rust watcher touches an inert marker → `cargo build` → Tauri restarts the app |
| root `Cargo.toml`, `.cargo/config.toml` | Same watcher — workspace-manifest / build-config edits force a rebuild      |

`pnpm tauri:dev` = Vite dev server (port 3000) + `tauri dev` + the workspace
Rust watcher (`scripts/watch-crates.js`, zero dependencies).

For Rust the loop is intentionally:

```
EDIT → CARGO REBUILD → TAURI RESTART → CONTINUE
```

A Rust restart reloads the native side; the desktop window reconnects to the
same Vite server. In-memory UI state resets, the process restarts — but the
database never does.

## Database safety

Development never deletes, resets, or recreates your database:

- The DB lives in the OS app-data dir (`app_data_dir()`), not in the repo.
- Restarts, Rust rebuilds, and frontend reloads all reuse the same `almowakeb.sqlite`.
- `scripts/clean.js` removes **build artifacts only** (`node_modules`, `dist`,
  `target`, `gen`, `tsbuildinfo`). It never touches app data.

## Backup / import / restore safeguards

- **Manual backup** — one click from Settings → Backups, progress is
  event-driven (`backup-progress`).
- **Automatic backup** — configurable policy (`backup_auto_enabled` +
  daily/weekly/monthly retention), enforced on startup and on-demand.
- **Before import** — an untrimmed **safety snapshot** of the current DB is
  always taken first (PreImport), so there is always a rollback copy.
- **Restore** — the candidate is validated before staging (schema, integrity,
  FKs, posted-entry balance); after the restart swap it is validated again and
  rolled back automatically if anything is wrong (`restore-rejected` event).
- The restore is **crash-safe**: an interrupted swap reconciles on next launch.

## Final development experience check

Start once with `pnpm tauri:dev`, then verify (in the same session, without
calling `pnpm build`):

| Test | Action | Expected |
| ---- | ------ | -------- |
| A | Edit a React string | HMR text swap, no reload |
| B | Edit CSS | restyle in place |
| C | Edit `packages/shared-types/src/*` | frontend updates |
| D | Edit a Rust command (`crates/tauri-adapter/src/commands/*`) | cargo rebuild + app restart |
| E | Edit `crates/infrastructure/src/*` | cargo rebuild + app restart |
| F | Create a transaction | persists across the next restart |
| G | Create a backup | one click, progress shown |
| H | Import an invalid DB | rejected, safety snapshot preserved |
| I | Import a valid DB | staged, restart applied |
| J | Restore a backup | validated, recoverable |

After D/E/F, confirm the DB still holds your data (it always does).

## Notes

- **One dev session at a time.** `pnpm tauri:dev` refuses to start while another
  session is running (a PID lock at `%TEMP%\erp-tauri-dev.lock` plus a port
  probe). If the lock survives a crashed session, the pid-liveness check treats
  it as stale automatically; to force it, delete the lock file.
- **Error recovery.** A TypeScript/Vite error shows an overlay and never ends
  the session. A Rust compiler error keeps `tauri dev` waiting — fixing the
  file rebuilds automatically. The session only exits on a real shutdown
  (Ctrl+C) or an app/monitor failure; a stale `desktop.exe`/`cargo` holding the
  build outputs surfaces as `os error 32` with a clear hint.
- Both `apps/desktop/src-tauri/Cargo.toml` and its workspace counterpart stay
  consistent manually; Vite is served on the `devUrl` port from
  `tauri.conf.json`, and `VITE_PORT` overrides must match or the window opens
  blank.
- Do **not** run `cargo check` / `cargo clippy` / `cargo build` in parallel with
  a live `pnpm tauri:dev` — cargo output files are locked by the running
  `desktop.exe` on Windows (`os error 32`). Stop the dev session first.
- `pnpm tauri:dev` requires the Vite port (3000) and HMR port to be free; a
  second instance will fail fast.