# Progress — Bilingualize accounting module (i18n sweep)

## Goal
Translate the accounting module's hardcoded Arabic UI strings to the bilingual i18n system by adding `t()` calls and filling `accounting.ts`, keeping Arabic output byte-identical via fallbacks, passing typecheck and the 486-test suite.

## Constraints & Preferences
- API: `const { t } = useLocalization();` then `t("key.path", { namespace: "accounting", fallback: "العربي الأصلي", vars?, count? })`.
- `useLocalization()` never throws; untested providers get `options?.fallback ?? key`.
- Byte-identical fallbacks. Do NOT touch tests, PropTypes/logic, budget numbers, IDs, storage/db keys, route/enum values, currency codes, icon names, other namespaces' resources.
- Do NOT lint/format/commit.
- Verify: typecheck exit 0; 486 tests.
- If blocked, STOP and report; do not unilaterally edit tests.

## Progress

### Done
- **Filled `apps/desktop/src/shared/i18n/resources/accounting.ts`** (ar + en, 6 sub-namespaces). Includes `journal.actions.cancel`, `journal.loading` (ar+en) added during this sweep.
- **chart-of-accounts/** fully swept (accounting.tsx, AccountForm.tsx, AccountPanel.tsx, AccountTreeNodeItem.tsx, hooks/useLinkedEntityFields.ts).
- **journal libs**: `journal-config.ts` (`journalTypeKey`/`journalTypeOptionKey`), `journal-entry-utils.ts` (`validateJournalEntry(..., t?)`), `journal-view.ts` (`deriveJournalTypeDisplay`/`toJournalLines`/`toJournalLinesSingleLine` with optional `t`, `assetSubtypeKey`).
- **journal.tsx** swept (titles, filter pills, reverse toast, confirm-reverse dialog, audit archive toggle, display-mode tooltips; deps updated).
- **JournalEntryCreatePage.tsx** swept — `useLocalization` + `t`; type SelectItems via `journalTypeKey`; header/title/subtitle; submit button (create.submit/submitting); info section card + type/date/description labels + placeholder; lines section; toasts via `journal.toast.created/createFailed`; `validateJournalEntry(..., t)`.
- **JournalEntryDetailPage.tsx** swept — `StatusBadge` uses `t(journal.detail.status.*)`; loading (`journal.loading`), load error, back, title, journal type (header + info card via `journalTypeKey`), post/reverse buttons, info card labels, lines table headers + total, toasts (`detail.toast*`), tab title, ConfirmDialogs (`detail.confirmPost.*`, `journal.confirmReverse.*`, `journal.actions.cancel`). Deps updated.

### In Progress
- `JournalTable.tsx` / `JournalLineEditor.tsx` / `JournalLineRow.tsx` / `JournalEntrySummary.tsx` sweep.

### Next Steps
1. Sweep `JournalTable.tsx` (audit archive, display-mode toggle, badge labels, reverse in-progress, reversal-of, empty state, search placeholder, export, summary, `journal_type_display` cells) + wire `t` into `toJournalLines`/`toJournalLinesSingleLine` call sites (×2 each audit+operational).
2. Sweep `JournalLineEditor.tsx`, `JournalLineRow.tsx`, `JournalEntrySummary.tsx`.
3. `fiscal-years/**`, then `fiscal-periods/**`.
4. `account-movements/**` + `lib/openingLines.ts`.
5. `profit-distribution/**`.
6. Remaining Arabic remnants check (api/*.ts, BranchPanel.tsx, etc.).
7. Typecheck → fix errors.
8. Test suite → confirm 486.
9. Report.

## Key Decisions
- Sub-namespaces: `chartOfAccounts`, `journal`, `ledger`, `fiscalPeriods`, `fiscalYears`, `profitDistribution`.
- Arabic constants stay as fallbacks; usage-site `t()` (payments-module convention).
- `journal.types.*` == `JOURNAL_TYPE_LABELS`; `journal.typeOptions.*` == filter pills.