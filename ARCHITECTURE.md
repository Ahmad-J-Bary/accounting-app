# Almowakeb Architecture — المُواكب

> **Almowakeb** (المُواكب) is an Arabic-first ERP Accounting & Inventory System.
> Desktop application built with **Tauri 2** (React + Rust).
> Version **0.9.5** (pre-release).

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Pattern](#architecture-pattern)
- [Directory Structure](#directory-structure)
- [Tech Stack](#tech-stack)
- [Backend Architecture (Rust)](#backend-architecture-rust)
  - [Dependency Flow](#dependency-flow)
  - [Domain Layer](#domain-layer)
  - [Application Layer](#application-layer)
  - [Infrastructure Layer](#infrastructure-layer)
  - [Adapter Layer](#adapter-layer)
- [Frontend Architecture (React)](#frontend-architecture-react)
  - [Feature Modules](#feature-modules)
  - [Widgets](#widgets)
  - [Shared Components](#shared-components)
- [Key Features](#key-features)
- [Development Commands](#development-commands)
- [CI/CD](#cicd)

---

## Project Overview

| Property | Value |
|---|---|
| Name | Almowakeb (المُواكب) |
| Type | ERP Accounting & Inventory System |
| Orientation | Arabic-first |
| Platform | Desktop (Tauri 2) |
| Version | 0.9.5 (pre-release) |
| Repository | Monorepo (pnpm workspaces + Cargo workspace) |

---

## Architecture Pattern

| Layer | Pattern |
|---|---|
| Backend (Rust) | **Hexagonal Architecture** (Ports & Adapters) |
| Frontend (React) | **Feature Module Architecture** |

The backend enforces strict dependency inversion: domain logic depends on nothing, application logic depends only on domain, infrastructure implements domain ports, and the Tauri adapter wires everything together.

---

## Directory Structure

```
accounting-app/
├── apps/desktop/              # Tauri 2 desktop application (React + Rust)
│   ├── src/                   # React frontend
│   │   ├── app/               # Application shell (router, providers, config)
│   │   ├── modules/           # Feature modules (7 business domains)
│   │   ├── shared/            # Shared components, hooks, utils, UI library
│   │   └── widgets/           # Reusable composite UI widgets (12 types)
│   └── src-tauri/             # Tauri integration
├── crates/                    # Rust backend (Hexagonal Architecture)
│   ├── domain/                # Domain entities, value objects, business rules
│   ├── application/           # Use cases, DTOs, ports (interfaces)
│   ├── infrastructure/        # SQLite repository implementations
│   ├── ports/                 # Legacy port definitions (deprecated)
│   └── tauri-adapter/         # Tauri command handlers, DI container
├── packages/shared-types/     # Shared TypeScript type definitions
└── scripts/                   # Setup, build, and utility scripts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Tauri 2 |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| State Management | React Context + TanStack React Query |
| Forms | React Hook Form + Zod |
| Routing | React Router DOM 6 |
| Backend | Rust 2021 Edition |
| Database | SQLite via sqlx 0.7 |
| Package Manager | pnpm 11.3.0 |
| Monorepo | Turborepo |

---

## Backend Architecture (Rust)

### Dependency Flow

```
domain ← application ← infrastructure ← tauri-adapter ← src-tauri
```

Inner layers never depend on outer layers. The domain is the most stable layer; the Tauri entrypoint is the most volatile.

### Domain Layer

**Crate:** `crates/domain`
**Modules:** 14

| Module | Responsibility |
|---|---|
| `accounting` | Core accounting rules, posting logic |
| `sales` | Sales invoice domain logic |
| `inventory` | Material, lot, warehouse domain logic |
| `customers` | Customer entity and rules |
| `suppliers` | Supplier entity and rules |
| `purchases` | Purchase invoice domain logic |
| `payments` | Receivable/payable domain logic |
| `auth` | Authentication and authorization rules |
| `settings` | Application settings domain logic |
| `audit` | Audit log domain logic |
| `assets` | Fixed asset and depreciation logic |
| `returns` | Sales/purchase return domain logic |
| `shared` | Value objects (Money, Currency, Date, etc.) |

### Application Layer

**Crate:** `crates/application`

| Artifact | Count |
|---|---|
| Use case modules | 37 |
| DTO files | 24 |
| Port/trait definitions | 29 |

This layer defines **ports** (interfaces) that infrastructure must implement, and orchestrates domain logic through use cases.

### Infrastructure Layer

**Crate:** `crates/infrastructure`

| Artifact | Count |
|---|---|
| SQLite repository implementations | 29 |
| Unit of Work implementations | yes |
| Database migration files | 79+ |

All database access is abstracted behind ports. SQLite is the only storage backend, accessed via `sqlx 0.7`.

### Adapter Layer

**Crate:** `crates/tauri-adapter`

| Artifact | Count |
|---|---|
| Command modules | 28 |
| Tauri commands (approx.) | 170+ |
| DI container entries (`Arc<dyn Trait>`) | 27+ |

The adapter layer wires the DI container (`AppState`), maps Tauri command parameters to DTOs, delegates to use cases, and returns results to the frontend.

---

## Frontend Architecture (React)

### Feature Modules (7)

Each module encapsulates a business domain with its own routes, components, hooks, and types.

| Module | Description |
|---|---|
| `accounting` | Chart of Accounts, Journal Entries, Reports |
| `core` | Settings, Users, Dashboard, Audit Log, Currency |
| `fixed-assets` | Asset Management, Depreciation, Consumables |
| `inventory` | Materials, Categories, Stock Movements, Warehouses |
| `invoicing` | Sales/Purchase Invoices, Returns, Unified Invoice |
| `partners` | Customers, Suppliers, Partners (unified PartyPage) |
| `payments` | Receivables, Payables |

### Widgets (12)

Reusable composite UI widgets that combine shared primitives into higher-order patterns.

| Widget | Purpose |
|---|---|
| `dashboard` | Dashboard layout and stat cards |
| `document-shell` | Invoice/document page frame |
| `form-shell` | Form page wrapper with validation |
| `IconPicker` | Icon selection component |
| `master-detail` | Master list + detail pane layout |
| `page-header` | Page title, breadcrumb, actions |
| `reports` | Report generation and display |
| `sidebar-shell` | Application sidebar layout |
| `stats` | Statistics display cards |
| `table-shell` | Data table with pagination, filters |
| `templates` | Document templates |
| `tree-sidebar` | Hierarchical tree sidebar (e.g. CoA) |

### Shared Components

| Package | Contents |
|---|---|
| `@shared/ui` | shadcn/ui components (Radix UI primitives) |
| `@shared/hooks` | Custom hooks (`useDataTable`, `useEntityList`, etc.) |
| `@shared/lib` | Utilities, formatters, validators |
| `@shared/context` | React contexts (Currency, Tabs, Sidebar) |

---

## Key Features

- Multi-currency support with exchange rates
- Hierarchical Chart of Accounts
- Journal entries with posting and reversal
- Sales and Purchase invoices with returns
- Partner profit sharing
- Inventory management with lots, warehouses, and transfers
- Fixed assets with depreciation schedules
- Auto-update mechanism (Tauri updater)
- Setup wizard for initial configuration
- 79+ database migrations

---

## Development Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run Vitest tests |

---

## CI/CD

GitHub Actions workflows handle:

- **Lint & typecheck** — ESLint + TypeScript
- **Rust tests** — `cargo test` across crates
- **Cross-platform builds** — macOS, Ubuntu, Windows
- **Release pipeline** — Automated builds and artifacts for each platform
