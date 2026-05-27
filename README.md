# المواكب (Almowakeb) - ERP Accounting & Inventory System

نظام متكامل للمحاسبة والمخزون

## Prerequisites

### Windows
- **PowerShell 5.1+** (built-in on Windows 10/11)
- **Visual Studio Build Tools** (or Visual Studio with "Desktop development with C++") - [Download](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- **Node.js** 18+ (with npm)
- **Rust** (via rustup) - installed automatically by `setup-windows.ps1`

### Linux (Ubuntu/Debian)
- **Node.js** 18+
- **Rust** (via rustup) - installed automatically by `setup-linux.sh`
- **System packages**: `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libsoup-3.0-dev`, etc.

## Quick Start

### Windows
```powershell
.\scripts\setup-windows.ps1
pnpm tauri:dev
```

### Linux
```bash
sudo ./scripts/setup-linux.sh
pnpm tauri:dev
```

## Development

```bash
# Start dev server with hot reload
pnpm tauri:dev

# Run frontend only (browser)
pnpm dev

# Lint
pnpm lint

# Run tests
pnpm --filter desktop test

# Build for production
pnpm build
```

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Rust, Tauri 2, SQLite (via sqlx)
- **Package Manager**: pnpm 11
- **Monorepo**: pnpm workspace + Turborepo

## Project Structure
```
accounting-app/
├── apps/desktop/          # Tauri desktop application
│   ├── src/               # React frontend
│   └── src-tauri/         # Tauri/Rust backend
├── crates/                # Rust crates
│   ├── domain/            # Domain logic
│   ├── application/       # Application services
│   ├── infrastructure/    # Database/repository implementations
│   ├── ports/             # Port/trait definitions
│   └── tauri-adapter/     # Tauri command handlers
├── packages/              # Shared packages
│   └── shared-types/      # TypeScript type definitions
└── scripts/               # Build and setup scripts
```

## CI/CD
The project includes GitHub Actions workflows for:
- **CI**: Lint, type-check, test, and cross-platform Rust checks
- **Release**: Build desktop bundles for Windows (.msi, .nsis), Linux (.deb, .rpm, .AppImage), and macOS (.dmg, .app)
