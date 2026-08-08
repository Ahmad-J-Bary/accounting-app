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

## 8. Lifecycle & immutability

Migration status: `Draft → Validated → Approved → Posted → Locked` (+
`Cancelled`). Posted entries are reversible only via `create_reversal`
(swaps legs, links the original, forces `source_type` to the canonical tag).
Posted / hit-locked migrations cannot be edited.