# ENGINEERING_HANDOVER.md

## 1. Project Overview

### Purpose
**Almowakeb (المُواكب)** is an Arabic-first desktop ERP Accounting & Inventory platform built on **Tauri 2 + React + Rust + SQLite**.  
Its current scope already covers accounting, inventory, opening balance migration, partners, payments, invoices, returns, reports, fixed assets, audit, settings, and user/role administration.  
The longer-term goal is to evolve it into a reusable business platform that can support multiple editions and future capabilities without rewriting the core.

### Current Version / Status
- **Workspace version:** `0.10.3`
- **Branch at handover capture:** `main`
- **Worktree state at handover capture:** clean
- **Project state:** active development, pre-production
- **Current development phase:** **Phase 5 - Backend + Database Implementation**
- **Phase status:** **In progress**

### Technology Stack
**Frontend**
- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3
- shadcn/ui + Radix UI
- React Router 6
- TanStack Query
- Vitest + Testing Library

**Backend**
- Rust 2021
- Tauri 2
- SQLite
- sqlx 0.7
- tokio
- serde / serde_json
- rust_decimal
- chrono
- uuid

### Platforms
- Desktop via **Tauri 2**
- Repository/docs explicitly support Windows and Linux development
- CI/release docs indicate Windows/Linux/macOS bundle targets

### Current Phase
**Phase 5 - Backend + Database Implementation**

Why:
- Phase 1 analysis docs exist
- Phase 2 architecture blueprint exists
- Phase 3 UI/UX blueprint exists
- Phase 4 frontend platform foundations were already implemented
- Phase 5 backend foundations and fiscal lifecycle work are actively implemented
- Phase 6 full verification is not complete

---

## 2. Architecture

### Overall Architecture
The repository uses a layered architecture with explicit inward dependency direction:

```text
Frontend UI
  -> Tauri command surface
    -> Application use cases
      -> Domain model
      -> Ports
        <- Infrastructure implementations
          -> SQLite / external integrations
```

### Dependency Direction
**Must be preserved**
- `domain` depends on nothing outward
- `application` depends on `domain`
- `infrastructure` implements `application` ports
- `tauri-adapter` wires commands and DI
- frontend calls adapters through Tauri IPC

### Backend Architecture
Rust side is organized into four main crates:
- `crates/domain`
- `crates/application`
- `crates/infrastructure`
- `crates/tauri-adapter`

This is the intended authoritative backend shape.

### Frontend Architecture
Frontend is a modular React desktop app with:
- central shell and router
- platform providers
- business modules
- shared UI primitives
- widgets/templates
- Tauri service adapters

### Major Architectural Principles
**Implemented / approved principles**
- Domain/application/backend are the authority for accounting behavior
- Clean inward dependency direction
- Shared platform concerns should not be duplicated inside business modules
- Navigation state should be independent from presentation style
- Voice/search/barcode/publishing should go through normal application rules
- Reports should use authoritative accounting sources rather than ad hoc reconstruction
- Capability/edition architecture is preferred over forking the product

---

## 3. File Tree

### Important Actual Project Structure

```text
accounting-app/
├─ apps/
│  └─ desktop/
│     ├─ src/
│     │  ├─ app/                  # shell, router, providers, layout, navigation
│     │  ├─ modules/              # business-facing frontend modules
│     │  ├─ shared/               # shared hooks, utils, types, UI helpers
│     │  ├─ widgets/              # reusable composite UI widgets/templates
│     │  ├─ test/                 # frontend test fixtures/setup
│     │  └─ App.tsx               # top-level provider chain + routes
│     └─ src-tauri/
│        └─ Cargo.toml            # Tauri app entry crate
├─ crates/
│  ├─ domain/                     # entities, value objects, business rules
│  ├─ application/                # use cases, DTOs, ports, shared policies
│  ├─ infrastructure/             # SQLite pool, migrations, repositories, search providers
│  └─ tauri-adapter/              # Tauri commands and DI container
├─ packages/
│  └─ shared-types/               # TS shared contracts used by frontend
├─ docs/                          # architecture and accounting design docs
├─ scripts/                       # setup/dev/build helpers
├─ Cargo.toml                     # Rust workspace
├─ package.json                   # pnpm workspace
├─ README.md
└─ ARCHITECTURE.md                # legacy architecture doc, now outdated
```

### Responsibility of Major Areas
- `apps/desktop/src/app`: shell and platform behavior
- `apps/desktop/src/modules`: user-facing ERP screens and flows
- `apps/desktop/src/shared`: reusable UI-independent frontend infrastructure
- `apps/desktop/src/widgets`: reusable high-level UI structures
- `crates/domain`: business truth
- `crates/application`: orchestration, lifecycle policies, DTO contracts, ports
- `crates/infrastructure`: SQLite-specific implementations and migrations
- `crates/tauri-adapter`: command surface exposed to the frontend
- `packages/shared-types`: TS contracts mirrored for frontend use
- `docs/target-architecture-blueprint.md`: approved Phase 2 blueprint
- `docs/ui-ux-architecture-blueprint.md`: approved Phase 3 blueprint

---

## 4. Modules

### Frontend Business Modules
Actual frontend modules under `apps/desktop/src/modules`:

| Module | Status | Responsibility |
|---|---|---|
| `accounting` | Implemented / active | Chart of accounts, journal, fiscal periods, account movement, profit distribution UI |
| `audit` | Implemented | Audit log screens |
| `auth` | Implemented | startup/auth callback/error pages |
| `core` | Implemented | setup, settings, updates, currencies, backups |
| `dashboard` | Implemented | dashboard pages |
| `expenses` | Implemented | expense items UI |
| `fixed-assets` | Implemented / partial backend alignment | fixed asset UI |
| `inventory` | Implemented | materials, categories, warehouses, transfers, damaged, adjustments, production |
| `invoicing` | Implemented | sales/purchase invoices and returns |
| `opening-balance` | Implemented / high-complexity | opening migration flow, opening invoice, lifecycle gating |
| `partners` | Implemented | partners, customer/supplier pages, statements |
| `payments` | Implemented | receipts/payments UI |
| `reports` | Implemented | ledger, trial balance, balance sheet, income statement, inventory reports |
| `users` | Implemented | users and roles UI |

### Backend Use Case Modules
Actual application use case modules include:

`account`, `adjustment`, `asset`, `audit`, `barcode`, `category`, `currency`, `customer`, `damaged`, `equity`, `fiscal_period`, `fiscal_year`, `invoice`, `journal`, `material`, `opening_balance`, `partner`, `payment`, `platform`, `production`, `purchase_invoice`, `purchase_return`, `sales_return`, `search`, `settings`, `shared`, `supplier`, `transfer`, `unified_invoice`, `user`, `voice`

### Module Relationships
Key relationships:
- `inventory` interacts with `accounting` through stock movements, journal entries, damaged items, and adjustments
- `partners`, `customers`, and `suppliers` interact with `accounting` through linked accounts and payment/statement flows
- `opening_balance` is both a setup/migration module and an accounting integrity workflow
- `fiscal_period` and `fiscal_year` are becoming lifecycle control modules for all posting
- `reports` depend on accounting truth and ledger data
- `settings` and `app_config` support company config, terminology, product edition, and publishing profiles

---

## 5. Backend & Database

### Rust / Tauri Architecture
**Current actual layout**
- Domain entities and rules: `crates/domain`
- Application DTOs, ports, use cases: `crates/application`
- SQLite/sqlx repositories and pool: `crates/infrastructure`
- Tauri commands and state container: `crates/tauri-adapter`
- Tauri desktop app crate: `apps/desktop/src-tauri`

### App Container
The DI container is in:
- `crates/tauri-adapter/src/bootstrap/container.rs`

It builds:
- SQLite pool
- migrations at startup
- repository instances
- search providers
- currency services
- `AppState` shared across Tauri commands

### SQLite / sqlx
Important current SQLite behavior from `crates/infrastructure/src/db/pool.rs`:
- `journal_mode = WAL`
- `busy_timeout = 10 seconds`
- `foreign_keys = true`
- `max_connections = 5`

This is intentional and must be preserved unless there is a strong reason.

### Migrations
Migrations live in:
- `crates/infrastructure/src/db/migrations`

Recent migrations include:
- `151_atomicity_idempotency.sql`
- `152_opening_migration_items.sql`
- `153_fiscal_periods_lock.sql`
- `155_opening_wizard_draft.sql`
- `159_residual_classification_accounts.sql`
- `160_journal_numbering.sql`
- `162_normalize_reversal_semantics.sql`
- `163_backup_settings.sql`
- `167_backfill_partner_drawings_accounts.sql`
- `168_add_partner_notes.sql`
- `169_damaged_item_financial_snapshot.sql`
- `170_fiscal_years.sql`

### Important Repositories / Ports
Examples:
- `JournalEntryRepository`
- `AccountRepository`
- `MaterialRepository`
- `PartnerRepository`
- `FiscalPeriodRepository`
- `FiscalYearRepository`
- `AppConfigRepository`
- `SearchProvider`

These are used by application services and implemented in infrastructure repositories.

### Important Entities / Aggregates
Representative core entities:
- `JournalEntry`
- `JournalLine`
- `Account`
- `FiscalPeriod`
- `FiscalYear`
- `Partner`
- `Material`
- `Payment`
- `Invoice` / `UnifiedInvoice`
- `DamagedItem`
- `FixedAsset`
- opening migration aggregates and items

### Source-of-Truth Data
**Current/intentional authoritative sources**
- **Posted accounting truth:** `journal_entries` + `journal_lines`
- **Chart/account semantics:** `accounts`, including `purpose`
- **Opening migration truth before posting:** opening migration aggregate + lines
- **Inventory movement history:** `stock_movements`
- **Fiscal lifecycle windows:** `fiscal_periods`, `fiscal_years`
- **Company/settings:** `settings`
- **Platform/edition/publishing config:** `app_config`

**Important nuance**
- The target architecture wants:
  `Business operation -> Use case -> Domain validation -> Posted journal -> Projections/snapshots -> Reports`
- Current repository is moving toward that, but not every report/module is fully projection-driven yet

### Transactions
Actual transaction-sensitive patterns exist in the codebase:
- partner + linked accounts save atomically
- reversal pairs save atomically
- opening posting persists migration state + journal atomically
- fiscal year close has idempotent close-run tracking
- many repository methods are explicitly designed around atomic writes

### Audit
Audit infrastructure exists:
- domain/audit module
- audit repository/use cases
- audit frontend screen
- backup/integrity metadata
- some high-sensitivity operations already carry explicit source IDs / reversal links / close runs

Audit is present, but not yet uniformly complete for every sensitive future operation.

### Permissions
Permissions exist in multiple forms:
- frontend route/page behavior
- backend `ExecutionContext.permission_keys`
- Tauri command guards in some places
- search result filtering by permission
- voice route execution checks permissions

**Current weakness**
- permission/error handling is not yet normalized end-to-end; much of the Tauri surface still stringifies errors

---

## 6. Accounting Business Logic

### Non-Negotiable Rules
These rules are either already implemented or explicitly approved and must not be violated:
1. **Double-entry is mandatory**
2. **Posted journals must be balanced**
3. **Posted journals are immutable; changes happen via reversal/contra**
4. **Frontend must not be the final accounting authority**
5. **Drawings are not operating expenses**
6. **Partner capital is separate from current account under the fixed-capital model**
7. **Opening balance posting must not silently plug unexplained differences**
8. **Residual classification must be explicit**
9. **Fiscal lifecycle enforcement must occur in backend/application/domain layers**
10. **Reports must not invent independent accounting truth**
11. **Currency conversion must not be silently duplicated**
12. **Accounting history must never be silently destroyed**

### Double-Entry and Posting
Documented in:
- `docs/accounting-model.md`

Key rules:
- `JournalEntry` contains one or more lines
- each line is debit or credit using `MonetaryAmount`
- posting enforces balance
- posted entries are immutable
- reversal is a true contra entry, not an edit

### Ledger / Balance Behavior
Important conventions from `docs/accounting-model.md`:
- balances are stored debit-positive
- signed display helpers exist on `Account`
- account natural side matters for interpretation
- reports should be explicit about reversal policy

### Opening Balance
Opening balance is a controlled workflow, not a casual journal preview.
Current implemented concepts:
- opening migration lifecycle
- reconciliation gate
- no silent plug account
- residual classification with explicit allowed targets
- posting uses one aggregate opening journal
- residual clearing is a second explicit journal
- posted/locked migrations are immutable except through explicit reversal/correction paths

### Fiscal Periods
Implemented:
- `FiscalPeriod` entity
- states: `Open`, `Closing`, `Closed`, `Reopened`, `Locked`, `Cancelled`
- overlap prevention on create
- period-level net profit and distributable calculations exist

### Fiscal Years
Implemented foundation:
- `FiscalYear` entity
- states: `Open`, `Closing`, `Closed`, `Reopened`, `Locked`
- `170_fiscal_years.sql`
- close-run idempotency tracking
- permission-controlled close/reopen commands
- overlap prevention now exists in create use case
- direct `find_by_date` resolution exists

Partially implemented:
- fiscal year close currently records/controls lifecycle state, but does **not** yet autonomously generate retained earnings transfer and carry-forward journals

### Fiscal Lifecycle Enforcement
Implemented recently:
- shared lifecycle policy in `crates/application/src/use_cases/shared/fiscal_lifecycle.rs`
- standard policy for `NormalOperational`
- requires:
  - matching fiscal year
  - matching fiscal period
  - non-ambiguous configuration
  - period/year open for posting

Designed but not implemented:
- explicit policies for:
  - `OpeningBalance`
  - `OpeningResidualReclassification`
  - `Reversal`
  - `Correction`
  - `FiscalYearClosing`
  - `CarryForward`
  - `OpeningNextFiscalYear`
  - `OtherSystemGenerated`

Current behavior:
- special operations are represented in `PostingOperationType`
- but policy resolution for them is intentionally **not implemented**
- validator returns `Unsupported` for those until user-approved policies are defined

### Partners / Capital / Current Accounts / Drawings
Implemented decisions:
- partner creation can atomically create linked capital/drawings accounts
- drawings use contra-equity accounts
- contributions are explicit journals
- capitalization of retained earnings is explicit
- partner equity statement derives from ledgers, not shortcut arithmetic
- drawings must not depress net profit

Partially implemented:
- broader partner/equity/fiscal-year integration is still not fully complete

### Current-Year Profit / Retained Earnings
Implemented:
- profit computation exists
- retained earnings account exists
- allocation/distribution logic exists in parts of opening/fiscal flows

Not complete:
- full year-end retained earnings closing orchestration is not yet finished

### Inventory Accounting
Implemented:
- stock movement repositories/use cases
- damaged inventory
- stock adjustments
- lots
- inventory reports
- multi-currency support work has been added over recent commits

Important recent accounting work:
- `169_damaged_item_financial_snapshot.sql`
- damaged item canonical financial fields and source-of-truth cleanup
- separation between cost impact / loss / original/base fields was explicitly audited and corrected

Still important:
- inventory/accounting consistency must continue to be protected when finishing Phase 5

### Fixed Assets
Implemented:
- fixed asset UI and backend flows
- fixed asset categories and automotive additions
- depreciation/disposal-related code paths exist

Partial / known concern:
- some asset accounting paths still use `Utc::now()` in important operations and need lifecycle/business-date review

### Multi-Currency / FX
Implemented foundation:
- shared formatting and currency context on frontend
- backend currency/exchange-rate repositories and use cases
- damaged/adjustment currency work already landed
- historical/base/original concepts are actively modeled

Known gap:
- some older posting paths still use runtime timestamps or older patterns and need continued cleanup to ensure lifecycle + business date + FX consistency stay aligned

### Reversals / Corrections
Implemented principles:
- posted originals are not edited
- reversals are explicit relationships
- repository supports atomic reversal pair persistence
- reversal semantics were normalized in migration `162_normalize_reversal_semantics.sql`

Pending policy decision:
- how reversals interact with fiscal lifecycle in closed periods/years is **not yet approved**

---

## 7. UI/UX & Navigation

## Current Implementation

### Application Shell
Current app shell is centered around:
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/app/shell/AppLayout.tsx`
- `apps/desktop/src/app/router/ErpRoutes.tsx`

Implemented:
- provider-driven shell
- multiple shell layout variants
- global overlays for search, voice, barcode
- RTL/LTR direction via localization provider
- keyboard shortcuts
- exchange rate widget integration
- startup/setup/update gating

### Sidebar / Route Registry
Implemented in:
- `apps/desktop/src/app/shell/routeRegistry.ts`
- `apps/desktop/src/app/router/ErpRoutes.tsx`

Current state:
- central route registry exists
- route groups exist
- actual route mapping exists
- some redirects and compatibility routes are present

Known debt:
- route registry still includes duplicate/report aliasing patterns and mixed grouping

### Tabs
Implemented:
- persistent tabs with localStorage restore
- dirty-state tracking
- new dashboard tab
- route-to-module metadata
- tab presentation mode metadata
- open/switch/next/prev/close behavior

Main file:
- `apps/desktop/src/app/providers/TabProvider.tsx`

Current state:
- one tab state system exists
- visual style can vary without replacing the model

### Current Tab Implementation
Implemented styles:
- default
- browser-like
- VS Code-like

Current behavior:
- styles are presentation choices
- same underlying tab model is reused
- new tab opens dashboard

### Window Behavior
Implemented partially:
- `WindowProvider.tsx` can open a destination in a Tauri native webview window
- can close tracked windows

Not implemented fully:
- tab-to-window transfer lifecycle
- restore
- permission-scoped window lifecycle
- true multi-window state persistence

### Global Search
Current frontend implementation:
- client-side provider merges:
  - routes
  - commands
  - open tabs
- quick-open UI exists
- recent searches stored in localStorage

Current backend implementation:
- separate provider-based backend search foundation exists

Gap:
- frontend quick search is not yet fully wired to backend provider-based search

### Voice
Current frontend:
- state machine and overlay exist
- currently executes normal frontend commands

Current backend:
- `PreviewVoiceIntentUseCase`
- `ExecuteVoiceCommandUseCase`
- search/route execution through normal command structure
- permission checks on some routes

Gap:
- frontend is not yet fully integrated with backend voice parsing/execution
- current backend voice parser is a narrow rule-based foundation

### Barcode
Current frontend:
- barcode scanner provider and dialog exist
- material form can use shared scan session

Current backend:
- device-neutral `ResolveBarcodeUseCase`

Gap:
- input source normalization exists conceptually, but full device adapter integration is still future work

### Chart of Accounts
Implemented:
- explorer-style presentation mode toggle
- detail panel behavior
- single-click selection/details
- double-click context-aware navigation
- shared resolver-based navigation rather than brittle inline route logic

Important files:
- `apps/desktop/src/shared/tree/navigationResolver.ts`
- `apps/desktop/src/modules/accounting/chart-of-accounts/pages/accounting.tsx`

Important decision already implemented:
- customer/supplier child accounts route to **ledger/account movement**, not statement pages

### Forms / Tables / Panels
Current reality:
- there is already a strong shared UI/wrapper ecosystem
- not every business module is fully migrated to uniform platform patterns yet
- opening balance, accounting, inventory, and settings have more advanced structured UI than some other areas

### Responsive / Theme / Localization
Implemented:
- appearance provider
- tab style and motion settings
- localization provider
- language switch
- formatter locale/direction integration

Partial:
- module-wide i18n extraction is incomplete
- many labels remain hardcoded Arabic strings in module/page code

## Future Design (Approved, Not Fully Implemented)
Per `docs/ui-ux-architecture-blueprint.md`, target UX includes:
- one navigation/workspace core
- switchable default/browser/VS Code shell experiences
- detachable windows
- controlled terminology system
- platform design tokens
- consistent forms/tables/panels/reports/search/voice/barcode UX

---

## 8. Future Architecture

The following capabilities are **planned/approved in architecture** but not all are implemented end-to-end.

| Capability | Current State | Future Direction |
|---|---|---|
| Voice Assistant | Foundation implemented front/back, not full workflow | speech -> intent -> command -> permission -> validation -> use case -> audit |
| Browser/VS Code tabs | presentation styles implemented | richer unified workspace model with full parity |
| Detachable windows | minimal provider implemented | full tab/window transfer, restore, lifecycle policies |
| Fiscal-year lifecycle | year+period foundations implemented | complete lifecycle across all posting + explicit special operation policies |
| Partner accounting | substantial accounting model exists | tighter fiscal/year-end integration and projections |
| i18n | provider + resources foundation implemented | full namespace extraction and terminology overrides across modules |
| Themes/responsive | appearance/settings foundations exist | platform token system and complete module alignment |
| Custom terminology | local override foundation exists | persisted, governed terminology system |
| Barcode devices | normalized backend/frontend foundation exists | real camera/USB/Bluetooth/native adapter integration |
| Global search | frontend quick-open + backend provider search foundations exist | fully unified backend-driven search and destinations |
| Production | production module exists | broader domain maturity and accounting integration |
| Product editions | app_config + edition profile foundations exist | capability-driven platform editions |
| Web publishing | publishing profiles foundation exists | publish DTOs + provider adapters + connectors |

---

## 9. Important Decisions

### Decision 1
- **Decision:** Backend/domain is authoritative for accounting truth
- **Chosen option:** backend authority
- **Reason:** accounting correctness, auditability, prevention of UI drift
- **Impact:** frontend must not become final source of balances/posting/profit/equity/fiscal control

### Decision 2
- **Decision:** Use one shared navigation/workspace model for multiple tab styles
- **Chosen option:** one model, multiple presentations
- **Reason:** avoid 3 independent navigation systems
- **Impact:** `TabProvider` and route metadata are platform concerns

### Decision 3
- **Decision:** Global search should be provider-based, not one giant SQL query
- **Chosen option:** `SearchProvider` + `SearchUseCase`
- **Reason:** modularity, extensibility, domain ownership
- **Impact:** search remains composable by domain

### Decision 4
- **Decision:** Voice must execute normal application commands/use cases
- **Chosen option:** voice -> normalized command -> normal flow
- **Reason:** prevent AI bypass of accounting/domain rules
- **Impact:** backend voice foundation exists; direct DB mutation is forbidden

### Decision 5
- **Decision:** Barcode must be device-neutral
- **Chosen option:** normalized barcode boundary
- **Reason:** future support for camera, USB, Bluetooth, keyboard wedge, native adapters
- **Impact:** business modules should consume normalized input, not device APIs

### Decision 6
- **Decision:** Product variants should be capability/configuration-based
- **Chosen option:** edition profile + app_config foundation
- **Reason:** avoid forking codebases/databases per vertical
- **Impact:** partial implementation exists in platform/edition profile use cases

### Decision 7
- **Decision:** Fiscal lifecycle enforcement should prefer accounting correctness over permissive legacy behavior
- **Options considered:** permissive legacy fallback vs strict lifecycle enforcement
- **Chosen option:** strict enforcement (Option B)
- **Reason:** no production legacy users; correctness preferred
- **Impact:** normal operational postings must belong to a valid fiscal year and period

### Decision 8
- **Decision:** Special/system accounting operations must not silently bypass lifecycle checks
- **Chosen option:** policy-driven model with explicit operation types
- **Reason:** avoid hidden bypasses
- **Impact:** `PostingOperationType` exists, but special policies remain pending user decisions

### Decision 9
- **Decision:** COA smart double-click navigation must use a resolver, not brittle name-based UI logic
- **Chosen option:** central resolver
- **Reason:** maintainability and semantic routing
- **Impact:** implemented in shared tree navigation resolver

### Decision 10
- **Decision:** Drawings are contra-equity, not expenses
- **Chosen option:** contra-equity model
- **Reason:** accounting correctness
- **Impact:** protected in domain/use cases/tests and docs

---

## 10. Rejected Approaches

These approaches were explicitly rejected by architecture or user direction:

1. **Frontend as the final accounting authority**
2. **Name-based routing in Chart of Accounts UI**
3. **A giant monolithic SQL/global search implementation**
4. **Voice or AI directly mutating database tables**
5. **Silent fiscal bypass such as `skip_lifecycle_guard = true`**
6. **Posting outside configured fiscal windows just to preserve convenience**
7. **Silent auto-creation/auto-assignment of fiscal periods/years**
8. **Silent date shifting to fit accounting windows**
9. **Duplicating product codebases/business logic per edition**
10. **Multiple unrelated navigation/tab/window state systems**
11. **UI-only patches for accounting source-of-truth problems**
12. **Hardcoded currency logic spread across forms/screens**
13. **Destructive migration behavior that silently deletes accounting history**

---

## 11. Known Issues / Technical Debt

Only real issues evidenced by code/docs are listed here.

### 11.1 `ARCHITECTURE.md` is outdated
- `ARCHITECTURE.md` still says version `0.9.5`
- current workspace/package version is `0.10.3`
- newer docs in `docs/` are the approved source of truth

### 11.2 Tauri adapter still stringifies most errors
- Many commands return `Result<_, String>` and call `.map_err(|e| e.to_string())`
- stable backend `AppError` taxonomy exists, but adapter/frontend contract is not yet normalized

### 11.3 Fiscal lifecycle special-operation policies are not defined yet
- `PostingOperationType` includes special cases
- only `NormalOperational` is implemented
- special operations intentionally remain undecided

### 11.4 Fiscal lifecycle enforcement is not yet complete across every posting path
- important normal flows were wired
- but some major paths still need completion/review, especially:
  - `crates/application/src/use_cases/unified_invoice/post.rs`
  - fixed-asset accounting paths
  - any remaining direct journal/movement creators

### 11.5 `unified_invoice/post.rs` still contains many `Utc::now()` accounting timestamps
- real evidence from source search
- this is a serious business-date / lifecycle consistency issue

### 11.6 Frontend search and voice are only partially end-to-end
- frontend quick search is client-side merged state
- backend provider-based search exists separately
- frontend voice overlay executes local commands; it is not fully backed by backend voice workflow yet

### 11.7 Multi-window behavior is foundational, not complete
- `WindowProvider.tsx` can open/close Tauri windows
- no complete window restore/transfer/state model yet

### 11.8 Company lifecycle/setup model still has debt
From `docs/company-lifecycle-audit.md`:
- single-company model is still settings-based rather than a true company aggregate
- multiple setup gates and lifecycle checks exist
- opening-balance migration visibility/gating remains a sensitive area

### 11.9 Route registry has duplication and redirect debt
- some duplicate report aliases
- redirects for legacy paths
- mixed grouping quality

### 11.10 Audit coverage is not yet uniformly complete
- audit exists
- but not every future sensitive flow is fully modeled yet

---

## 12. Current Phase & Progress

### CURRENT PHASE
**Phase 5 - Backend + Database Implementation**

### STATUS
**In progress**

### COMPLETED
- Phase 1 analysis delivered in docs
- Phase 2 target architecture blueprint delivered
- Phase 3 UI/UX blueprint delivered
- Phase 4 frontend platform foundations implemented:
  - localization
  - command provider
  - global search provider
  - voice provider
  - barcode provider
  - window provider
  - tab/workspace model
  - explorer COA mode
- Phase 5 foundations implemented:
  - backend search abstraction
  - backend barcode abstraction
  - backend voice boundary
  - edition/publishing config foundation
  - fiscal year foundation
  - fiscal year migration
  - fiscal lifecycle standard policy for normal operational posting
  - fiscal year overlap prevention
  - direct fiscal-year-by-date resolution

### IN PROGRESS
- applying normal lifecycle guard across all normal operational posting flows
- tightening accounting/business date consistency
- continuing fiscal lifecycle enforcement
- continuing Phase 5 accounting consistency work

### PENDING DECISIONS
Special lifecycle policy decisions are still required for:
- Opening Balance
- Opening Residual Reclassification
- Reversal
- Correction
- System-generated Opening Journals
- Fiscal Year Closing
- Carry-forward
- Opening Next Fiscal Year
- Other system-generated accounting entries

### BLOCKERS
No hard technical blocker at repository level.

There **are** scoped implementation blockers by design:
- special accounting operations should not be changed further without explicit policy approval

---

## 13. Next Steps

### Exact Recommended Next Actions
1. **Finish normal operational lifecycle enforcement**
   - continue wiring `FiscalLifecyclePolicy::validate_normal_operational(...)`
   - complete `unified_invoice/post.rs`
   - review fixed-asset posting paths
   - review any remaining direct journal/movement creators

2. **Remove remaining `Utc::now()` accounting-date mismatches**
   - use authoritative business/accounting date where the journal/movement is posted

3. **Expand tests**
   - lifecycle guard across additional posting flows
   - boundary dates
   - ambiguous config rejection
   - no bypass path for normal operational posting

4. **Stop before changing any special/system accounting operation**
   - raise one decision at a time using the agreed “SPECIAL POLICY DECISION” format

5. **After lifecycle coverage is complete**
   - continue Phase 5 accounting consistency
   - strengthen partner/equity + year-end orchestration
   - only then move toward Phase 6 verification

---

## 14. AI Working Rules

These are permanent operating rules for the next AI agent:

1. Inspect the repository before modifying anything.
2. Do not repeat work that is already implemented correctly.
3. Prefer extend/refactor over rewrite.
4. Preserve working functionality unless there is a concrete reason to change it.
5. Do not invent accounting rules.
6. When accounting behavior is ambiguous, stop and ask.
7. Ask before major decisions affecting:
   - architecture
   - data model
   - accounting behavior
   - fiscal lifecycle
   - partner accounting
   - navigation/tabs/windows
   - permissions
   - migrations
   - backward compatibility
8. Provide options with pros/cons/impact when asking for a decision.
9. Do not automatically move to the next phase.
10. Keep one source of truth for balances, posting, inventory, equity, and lifecycle state.
11. Keep business logic out of UI components.
12. Preserve dependency direction: `domain -> application -> infrastructure -> adapter`.
13. Avoid duplication.
14. Protect accounting history; do not use destructive migrations casually.
15. Report changed files and tests after implementation.
16. Frontend validation is allowed, but never as the only enforcement point.
17. Special/system accounting operations must not become hidden lifecycle bypasses.

---

## 15. Important Files

### Architecture / Docs
- `docs/target-architecture-blueprint.md`  
  Approved Phase 2 technical architecture blueprint
- `docs/ui-ux-architecture-blueprint.md`  
  Approved Phase 3 UI/UX blueprint
- `docs/accounting-model.md`  
  Core accounting model and invariants
- `docs/company-lifecycle-audit.md`  
  Audit of company/setup/opening lifecycle
- `docs/postlock-equity-audit.md`  
  Audit of opening equity / post-lock period behavior
- `ARCHITECTURE.md`  
  Legacy architecture document; outdated

### Frontend Core
- `apps/desktop/src/App.tsx`  
  top-level provider chain and route root
- `apps/desktop/src/app/router/ErpRoutes.tsx`  
  actual route map and transaction gating
- `apps/desktop/src/app/shell/AppLayout.tsx`  
  shell composition, layouts, overlays
- `apps/desktop/src/app/shell/routeRegistry.ts`  
  centralized route metadata
- `apps/desktop/src/app/providers/TabProvider.tsx`  
  tab/workspace state
- `apps/desktop/src/app/providers/WindowProvider.tsx`  
  basic native window manager
- `apps/desktop/src/app/providers/GlobalSearchProvider.tsx`  
  current frontend search implementation
- `apps/desktop/src/app/providers/VoiceProvider.tsx`  
  current frontend voice state machine
- `apps/desktop/src/app/providers/LocalizationProvider.tsx`  
  language/direction/terminology foundation
- `apps/desktop/src/shared/tree/navigationResolver.ts`  
  COA smart navigation resolver

### Backend Core
- `crates/domain/src/lib.rs`  
  domain crate exports
- `crates/application/src/lib.rs`  
  application crate exports
- `crates/application/src/errors.rs`  
  central application error model
- `crates/application/src/use_cases/shared/fiscal_lifecycle.rs`  
  current normal lifecycle policy
- `crates/application/src/use_cases/fiscal_year/create.rs`  
  fiscal year creation with overlap prevention
- `crates/application/src/use_cases/fiscal_year/close.rs`  
  fiscal year close foundation and idempotency
- `crates/application/src/use_cases/opening_balance/post.rs`  
  opening migration posting
- `crates/application/src/use_cases/voice/preview.rs`  
  backend voice preview foundation
- `crates/application/src/use_cases/voice/execute.rs`  
  backend voice execution foundation
- `crates/application/src/use_cases/search/execute.rs`  
  backend provider-based search
- `crates/application/src/use_cases/barcode/resolve.rs`  
  normalized barcode resolution
- `crates/application/src/ports/fiscal_year_repository.rs`  
  fiscal year repository contract
- `crates/application/src/ports/journal_entry_repository.rs`  
  journal repository contract

### Infrastructure / DB
- `crates/infrastructure/src/db/pool.rs`  
  SQLite pool config, WAL, busy timeout, schema checks, healing helpers
- `crates/infrastructure/src/db/backup.rs`  
  backup/restore/integrity strategy
- `crates/infrastructure/src/db/migrations/170_fiscal_years.sql`  
  fiscal year schema
- `crates/infrastructure/src/repositories/fiscal_year/mod.rs`  
  SQLite fiscal year repository
- `crates/infrastructure/src/search/mod.rs`  
  search providers

### Tauri Adapter
- `crates/tauri-adapter/src/bootstrap/container.rs`  
  `AppState` and dependency wiring
- `crates/tauri-adapter/src/commands/mod.rs`  
  command module registry
- `crates/tauri-adapter/src/commands/fiscal_year.rs`  
  fiscal year command surface
- `crates/tauri-adapter/src/commands/search.rs`  
  backend search command
- `crates/tauri-adapter/src/commands/voice.rs`  
  backend voice commands
- `crates/tauri-adapter/src/commands/barcode.rs`  
  backend barcode command
- `crates/tauri-adapter/src/commands/platform.rs`  
  edition/publishing config commands

### Shared Types
- `packages/shared-types/src/index.ts`  
  shared TS export hub
- `packages/shared-types/src/opening_balance.ts`  
  opening balance TS contracts
- `packages/shared-types/src/account.ts`  
  account TS contracts

---

## 16. Final Handover Summary

### Current State
Almowakeb is a **real, active, pre-production ERP desktop codebase** with:
- a working React/Tauri UI
- a Rust layered backend
- SQLite/sqlx persistence
- extensive accounting/inventory/partners/opening/reporting features
- approved Phase 2 and Phase 3 architecture docs
- active Phase 5 backend hardening work

### Target State
A reusable ERP/business platform where:
- backend/domain is authoritative
- lifecycle/accounting integrity is enforced centrally
- navigation/workspace/search/voice/barcode/windows are platform services
- product editions are capability-driven
- reports consume authoritative accounting truth
- future integrations do not require restructuring the core

### Current Phase
**Phase 5 - Backend + Database Implementation**

### Remaining Work
- complete normal fiscal lifecycle enforcement across all operational posting flows
- fix remaining business-date mismatches
- define special lifecycle policies one-by-one with user approval
- continue accounting consistency / partner equity / year-end orchestration
- normalize Tauri error contracts
- eventually perform Phase 6 verification

### Pending Decisions
Still awaiting explicit accounting policy decisions for:
- Opening Balance
- Opening Residual Reclassification
- Reversal
- Correction
- Fiscal Year Closing
- Carry-forward
- Opening Next Fiscal Year
- Other system-generated accounting entries

### Critical Rules
- do not invent accounting rules
- do not let UI become the final authority
- do not add silent lifecycle bypasses
- do not weaken fiscal enforcement for convenience
- do not duplicate navigation/search/barcode/voice logic
- do not silently destroy accounting history
- ask before major architectural or accounting decisions

### Immediate Next Action
Continue **Phase 5 only** by finishing the shared **normal operational fiscal lifecycle enforcement** across remaining posting flows, starting with:
1. `crates/application/src/use_cases/unified_invoice/post.rs`
2. fixed-asset accounting paths
3. any remaining normal posting creators

Then stop and raise the first **SPECIAL POLICY DECISION** for special/system accounting operations.
