# Accounting Model — دليل النموذج المحاسبي

Reference documentation for the accounting engine implemented in this app:
double-entry journals, normal balances, the partner equity model (capital,
drawings, capitalization, profit allocation) and the opening-balance /
company-start cutover.

## 1. Double-entry fundamentals

### 1.1 Journal entries (قيود)

Every financial event is captured as a `JournalEntry` (domain aggregate) that:

- holds at least one `JournalLine`;
- each line carries **either** a debit **or** a credit leg (expressed in the
  original currency plus its base-currency equivalent `MonetaryAmount`);
- is **balanced**: Σ(debit) = Σ(credit), enforced at construction and by
  `JournalEntry::post()` / `is_balanced()`;
- is immutable after posting — a posted entry can only change through a true
  **contra/reversal** entry (`JournalType::Reversal` or the opening-balance
  `OpeningBalanceReversal`), never by editing the original.

### 1.2 Balance storage

Balances are stored **debit-positive** on every row:

```
balance = opening_balance + debit − credit
```

Interpretation helpers on `Account`:

- `normal_balance()` — the account's natural side per its type (Sec 12);
- `signed_balance()` — positive when the balance sits on the natural side;
- `display_balance()` — always the absolute value; the side is reported
  separately so UIs never print negative totals for a normal credit balance.

### 1.3 Normal balance by account type

| AccountType               | NormalBalance | Increases on |
|---------------------------|---------------|--------------|
| Assets                    | Debit         | debit        |
| Expenses                  | Debit         | debit        |
| Drawings (44X, contra)    | Debit         | debit        |
| Liabilities               | Credit        | credit       |
| Equity                    | Credit        | credit       |
| Revenue                   | Credit        | credit       |

## 2. Chart of accounts (equity subtree)

| Code    | Account                  | Type   | Kind             |
|---------|--------------------------|--------|------------------|
| `51`    | رأس المال (parent)       | Equity | Summary          |
| `51X`   | رأس مال الشريك: {name}   | Equity | Detail           |
| `52`    | أرباح مبقاة               | Equity | Detail           |
| `53`    | رصيد افتتاحي (OBE)       | Equity | Detail           |
| `44`    | مسحوبات الشركاء (parent) | Equity | Summary (contra) |
| `44X`   | مسحوبات الشريك: {name}   | Equity | Detail (contra)  |

The `44*` subtree is reclassified from Expenses to Equity by migration
`143_partner_drawings_and_residual.sql` so owner drawings never appear as an
operating expense in the P&L.

### 2.1 Semantic account purpose (Sec 46)

`AccountPurpose` replaces brittle code-prefix/name string matching as the source
of truth for account semantics (`general`, `partner_capital`,
`partner_drawings`, `partner_current`, `receivable`, `payable`, `inventory`,
`fixed_asset`, `retained_earnings`, `opening_balance_equity`):

- Stored on every account by migrations 148/149 and surfaced as `purpose` in
  the backend `AccountDto` and `JournalLineDto` (shared-types), so the UI never
  re-derives semantics from volatile code prefixes or names.
- Frontend classifiers are **purpose-first with fallback**: the balance sheet,
  journal line and capital-source dialog match `purpose` first (`fixed_asset`
  → fixed assets, `receivable`/`inventory` → current assets & owed funds,
  `payable` → current liabilities), and only for legacy `general` rows
  fall back to the old code/name heuristics.
- `AccountPurpose::to_str()` in the domain is the single canonical tag mapping,
  reused by persistence and DTOs so the strings never drift apart.

## 3. Partner master data (atomic creation)

`CreatePartnerUseCase` creates a partner plus its two linked accounts
(`51X` capital, `44X` drawings) in **one SQLite transaction**
(`PartnerRepository::save_with_accounts`). Either all three rows persist or
none — an integration test forces a mid-transaction failure and asserts no
partial rows.

- `accounting_start_mode == NewCompany`: opening capital 0 — capital enters the
  ledger only via an explicit `CapitalContribution` journal.
- `accounting_start_mode == ExistingCompanyMigration`: the capital account
  carries the opening balance directly (no cash journal).

## 4. Capital contribution (new company)

`CreateCapitalContributionUseCase` — a real financial event, deliberately kept
separate from master-data creation:

```
Dr <funding account (cash/bank)>
    Cr <partner capital (51X)>
```

Journal type `CapitalContribution`.

## 5. Partner drawings (contra-equity, never a P&L expense)

`CreatePartnerDrawingUseCase` — an explicit owner-draw event:

```
Dr <partner drawings (44X, contra-equity)>
    Cr <funding account (cash/bank)>
```

Journal type `PartnerDrawing`.

Drawings are NOT operating expenses (Sec 11 / Sec 31 / Sec 40). Besides the
Equity reclassification, `ComputeNetProfitUseCase` skips any line whose account
`is_drawings_account()` (code prefix `44`) so drawings can never depress net
profit — self-defensive even against a legacy DB still typed Expenses.

## 6. Capitalization of retained earnings

`CapitalizeRetainedEarningsUseCase` — moves a portion of retained earnings (52)
into a partner's capital through an auditable journal:

```
Dr <retained earnings (52)>
    Cr <capital (51X)>
```

Journal type `Capitalization`. Pure equity-to-equity: no P&L impact.

### 6.1 Partner equity statement (profit vs loss allocations)

`GetPartnerEquityStatementUseCase` serves each partner's owner position from the
ledgers only (never `ledger_balance − registered_capital`):

- `current_balance` = net credit−debit of the partner's current account (the
  accumulated profit allocations, Sec 13), read straight from POSTed/reversed
  `journal_lines`.
- `profit_allocated` = the same current-account net figure (a loss period makes
  it negative).
- `loss_allocated` = the **debit leg magnitude** of the current account,
  exposed separately so a loss period shows explicitly (red in the UI) and can
  never be silently folded into the profit figure. Invariant:
  `profit_allocated − loss_allocated == current_balance` when the drift is only
  the debit leg with a zero net — verified by `equity_gl_reconcile` test that
  reconciles the statement row against raw SQL `journal_lines`.
- `total_equity = ledger_balance + current_balance − drawings`.

## 7. Opening-balance cutover & residual equity

- `CreateOpeningBalanceUseCase` saves `source_system` / `source_reference` at
  create time for traceability to the legacy system.
- `PostOpeningBalanceUseCase` requires a **balanced and reconciled** migration
  (no silent plug account). Residual equity is computed automatically, but its
  nature is the accountant's explicit decision (Sec 6 / Sec 8).
- `SetResidualClassificationUseCase` persists `ResidualClassification`:
  `RetainedEarnings | OpeningEquityAdjustment | PriorPeriodAdjustment |
  OtherEquity | UnresolvedDifference`, along with a
  `residual_account_id` (e.g. 52).

### 7.1 Opening Position Control (read-only, v0.9.9)

`GetOpeningPositionControlUseCase` derives the opening financial position of a
migration from **its own opening lines + chart semantics** — it is a pure
projection and never creates or touches a `JournalEntry` (verified by an
integration test that asserts the journal count is unchanged).

- `net_assets = total_assets − total_liabilities`
- `total_equity = partner_capital + partner_current + retained_earnings +
  opening_equity_adjustment + other_equity − drawings`
- `equity_difference = net_assets − total_equity`; `is_balanced` when
  `|difference| ≤ 0.01` (Decimal — f64 is never introduced, and `Math.abs` is
  never used to hide an error).
- Account grouping is semantic via `AccountPurpose` (`Receivable`, `Inventory`,
  `FixedAsset`, `Payable`, `PartnerCapital/…`, plus `Other`) — never code
  prefixes or names.
- P&L lines are skipped defensively: **expenses never enter the balance
  equation** (they are not cash, and the migration lifecycle already rejects
  Revenue/Expenses lines).
- `opening_historical_result = net_assets − partner_capital − explicit_other_equity`
  — informational only. It is derived, never reloaded, so `PartnerCurrent`,
  `PartnerDrawings` and `RetainedEarnings` are counted exactly once.
  This is **not** the current-period profit; `ComputeNetProfitUseCase` remains
  the ledger result to date.
- An unbalanced position shows "Unclassified Difference" plus the exact amount
  and points back to the residual workflow (`SetResidualClassificationUseCase` /
  `ApplyResidualToLedgerUseCase`); the system never silently plugs the gap and
  never decides the residual's nature.
- UI: the report is displayed as a read-only card (`مركز الافتتاحي`) with a
  text status badge (✓ متوازن / يوجد فرق — never color-only).

## 8. Lifecycle & immutability

Migration status: `Draft → Validated → Approved → Posted → Locked` (+
`Cancelled`). Posted entries are reversible only via `create_reversal`
(swaps legs, links the original, forces `source_type` to the canonical tag).
Posted / hit-locked migrations cannot be edited.

## 9. Fiscal periods & distributable profit (Sec 18–22)

### 9.1 Fiscal period (Sec 20)

`FiscalPeriod` is a formal reporting window, **independent of the opening
migration cutover**:

- the cutover is the company's position at a moment in time (a snapshot);
- the period is the accounting window whose current-period net profit is
  computed and distributable — it must never be derived from the cutover.

Status lifecycle: `Open → Closing → Closed`, plus `Reopened` (explicit
accountant action, only from `Closed`) and `Cancelled`. `close(by, status)`
records who closed and when; a non-final `Closing` step can be finalized.

- Migration `150_fiscal_periods.sql`; port
  `FiscalPeriodRepository` (`create / find_by_id / list / find_by_date /
  update`).
- Creating a period whose window overlaps an existing same-company period is
  rejected (`AppError::Conflict`) so reporting windows never double-count a
  date. `company_id` is an optional column until a companies table exists.
- `CloseFiscalPeriodUseCase` is **idempotent**: re-running it for an already
  closed/cancelled period returns the existing state instead of failing.

### 9.2 Explicit-window net profit (Sec 19)

`ComputePeriodNetProfitUseCase` computes net profit for an **explicit
`period_start` / `period_end` pair** from the posted journal ledger only:

```
revenue  = Σ over Revenue-typed lines of (credit − debit)
expenses = Σ over Expenses-typed lines of (debit − credit)
net      = revenue − expenses
```

- Ledger-only, keyed on explicit accounting dates — never on a migration cutover
  (the fix point of this work). The legacy migration-keyed
  `ComputeNetProfitUseCase` is kept as a thin backward-compat wrapper.
- Only `JournalEntryStatus::Posted` entries count; draft entries and partner
  drawings (contra-equity, `is_drawings_account()`) are excluded automatically.
  Reversals net because a contra carries swapped legs.
- `from > to` is rejected; both bounds must parse as RFC-3339 (`UTC`).
- Aggregation reuses the shared pure `compute_ledger_totals` from the
  opening-balance engine, so the summation semantics are identical everywhere.

### 9.3 Distributable profit projection (Sec 18, Sec 22)

`GetDistributableProfitUseCase` is a **READ-ONLY projection** — it never posts,
allocates or mutates anything:

```
retained_earnings_balance = Σ credit − debit over the purpose-`RetainedEarnings`
                            account (credit-normal account), posted lines only
allocated_to_date         = Σ total_base_debit of posted journals whose
                            source_id starts with `profit_distribution:`
distributable = current_period_profit + retained_earnings_balance − allocated_to_date
```

- `current_period_profit` is the §9.2 ledger result for the same window;
  `retained_earnings` is the historical/accumulated result booked in the chart;
  the three figures are kept distinct (never conflated).
- Counting only the posted `profit_distribution:*` source journals keeps the
  projection idempotency-safe: an already-allocated amount is never counted
  twice.
- The opening migration never auto-allocates profit — allocation remains a
  separate explicit command (migration-keyed `AllocateNetProfitUseCase`).

### 9.4 Tauri & UI

Commands: `create_fiscal_period`, `list_fiscal_periods`,
`close_fiscal_period`, `compute_period_net_profit`,
`get_distributable_profit`. Route `/accounting/reports/fiscal-periods`
(`FiscalPeriodReport` page) with period list/create/close plus a read-only
distributable-profit panel for the active period.