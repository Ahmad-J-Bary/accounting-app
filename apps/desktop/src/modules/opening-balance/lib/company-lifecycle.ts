// Company type + initialization-state derivation. The company type lives in the
// persisted `settings.accounting_start_mode` value; the initialization state is
// DERIVED (never stored) from that type plus the opening-balance migration
// status and the existence of a first fiscal period.

import { START_MODE_EXISTING, START_MODE_NEW } from "@modules/opening-balance/lib/wizard-types";

export { COMPANY_TYPE_EXISTING, COMPANY_TYPE_NEW } from "@modules/opening-balance/lib/wizard-types";

export type CompanyType = typeof START_MODE_NEW | typeof START_MODE_EXISTING;

export type CompanyInitState =
  | "NOT_STARTED"
  | "OPENING_IN_PROGRESS"
  | "OPENING_READY"
  | "OPENING_POSTED"
  | "OPENING_LOCKED"
  | "ACTIVE";

export interface CompanyLifecycleSettingsLike {
  accounting_start_mode?: string | null;
}

export interface CompanyLifecycleMigrationLike {
  status?: string;
}

export interface CompanyLifecyclePeriodLike {
  status?: string;
}

export interface CompanyLifecycleInput {
  settings?: CompanyLifecycleSettingsLike | null;
  migrations?: CompanyLifecycleMigrationLike[];
  periods?: CompanyLifecyclePeriodLike[];
}

// Node ids of the opening pages in the sidebar page registry. For a NEW company
// these items are filtered out and their routes redirect to /dashboard. They are
// also hidden once an EXISTING company becomes fully ACTIVE.
export const OPENING_NAV_ID = "opening-balance-migration";
export const OPENING_INVOICE_NAV_ID = "opening-balance";

// Every nav entry that must disappear for a NEW company.
export const HIDDEN_NAV_IDS_FOR_NEW: readonly string[] = [
  OPENING_NAV_ID,
  OPENING_INVOICE_NAV_ID,
];

// Nav ids whose routes must disappear while an EXISTING company is still in its
// opening workflow (NOT_STARTED … OPENING_LOCKED): daily-log operational entry
// points. Master-data / opening pages stay reachable during that window.
export const TRANSACTIONAL_NAV_IDS: readonly string[] = [
  "journal",
  "payments",
  "sales-invoices",
  "purchase-invoices",
  "sales-returns",
  "purchase-returns",
  "inventory",
  "transfers",
  "damaged",
  "production",
  "adjustments",
];

// Route paths covered by the transactional gate (shared with ErpRoutes).
export const TRANSACTIONAL_PATHS: readonly string[] = [
  "/journal",
  "/payments",
  "/sales-invoices",
  "/purchase-invoices",
  "/sales-returns",
  "/purchase-returns",
  "/inventory",
  "/inventory/transfers",
  "/damaged",
  "/production",
  "/adjustments",
  "/inventory/purchases/",
  "/inventory/sales/",
];

export function companyTypeOf(settings?: CompanyLifecycleSettingsLike | null): CompanyType {
  // Defaults to EXISTING (waiting for persisted settings while loading, and the
  // new-company default at creation) so nothing flashes to "company is new".
  return settings?.accounting_start_mode === START_MODE_NEW
    ? START_MODE_NEW
    : START_MODE_EXISTING;
}

export interface CompanyCapabilities {
  isExistingCompany: boolean;
  isOpeningRequired: boolean;
  canUseOpeningWorkflow: boolean;
}

// Single source of truth for "does this company touch the opening-balance
// workflow?" — every form/page that must hide opening controls reads these
// capabilities (via `useCompanyCapabilities`) instead of repeating
// `if (type === NEW) ... else ...`.
export function companyCapabilities(type: CompanyType): CompanyCapabilities {
  const isExistingCompany = type === START_MODE_EXISTING;
  return {
    isExistingCompany,
    isOpeningRequired: isExistingCompany,
    canUseOpeningWorkflow: isExistingCompany,
  };
}

export function companyCapabilitiesOf(
  settings?: CompanyLifecycleSettingsLike | null,
): CompanyCapabilities {
  return companyCapabilities(companyTypeOf(settings));
}

export function deriveCompanyInitState(input: CompanyLifecycleInput): CompanyInitState {
  const type = companyTypeOf(input.settings);

  // A NEW company records operations from scratch: no opening migration ever.
  if (type === START_MODE_NEW) return "ACTIVE";

  const migrations = (input.migrations ?? []).filter((m) => m.status !== "Cancelled");
  let rank = 0;
  for (const m of migrations) {
    switch (m.status) {
      case "Locked": rank = Math.max(rank, 5); break;
      case "Posted": rank = Math.max(rank, 4); break;
      case "Approved": rank = Math.max(rank, 3); break;
      case "Validated": rank = Math.max(rank, 2); break;
      default: rank = Math.max(rank, 1); break;
    }
  }

  if (rank === 0) return "NOT_STARTED";
  if (rank <= 2) return "OPENING_IN_PROGRESS";
  if (rank === 3) return "OPENING_READY";
  if (rank === 4) return "OPENING_POSTED";

  // rank 5 = migration locked; once the first fiscal period exists the company
  // is fully active, otherwise the wizard finished but the first period is
  // still awaited.
  const hasPeriod = (input.periods ?? []).length > 0;
  return hasPeriod ? "ACTIVE" : "OPENING_LOCKED";
}

// Nav items hidden per company type. A NEW company never touches the opening
// migration or the opening invoice, so those entries are filtered out (their
// routes also redirect).
export function filterNavByCompanyType<T extends { id: string }>(
  items: readonly T[],
  settings?: CompanyLifecycleSettingsLike | null,
): T[] {
  const type = companyTypeOf(settings);
  if (type === START_MODE_NEW) {
    const hidden = new Set(HIDDEN_NAV_IDS_FOR_NEW);
    return items.filter((item) => !hidden.has(item.id));
  }
  return [...items];
}

// Ids hidden for a NEW company, as a set (used by the sidebar to drop pinned
// entries too). Empty set for EXISTING.
export function hiddenNavIdsForNew(
  settings?: CompanyLifecycleSettingsLike | null,
): ReadonlySet<string> {
  return companyTypeOf(settings) === START_MODE_NEW
    ? new Set(HIDDEN_NAV_IDS_FOR_NEW)
    : new Set<string>();
}

// Generalized nav hiding driven by both the persisted company type and the
// derived initialization state (Phase 4):
//  * NEW company                     → opening nav ids hidden for good.
//  * EXISTING once fully ACTIVE      → opening nav ids hidden (lifecycle done).
//  * EXISTING still opening          → transactional nav ids hidden so daily
//    operations cannot begin before the opening migration is sealed.
export function hiddenNavIds(
  type: CompanyType,
  initState: CompanyInitState,
): ReadonlySet<string> {
  if (type === START_MODE_NEW || initState === "ACTIVE") {
    return new Set(HIDDEN_NAV_IDS_FOR_NEW);
  }
  return new Set(TRANSACTIONAL_NAV_IDS);
}

// Whether transactional (daily-log) pages may be accessed: NEW companies are
// always active, EXISTING companies only once the lifecycle reaches ACTIVE.
export function isTransactionalAllowed(
  type: CompanyType,
  initState: CompanyInitState,
): boolean {
  return type === START_MODE_NEW || initState === "ACTIVE";
}

export const INIT_STATE_LABELS: Record<CompanyInitState, string> = {
  NOT_STARTED: "لم يبدأ بعد",
  OPENING_IN_PROGRESS: "رصيد الافتتاح قيد الإعداد",
  OPENING_READY: "رصيد الافتتاح جاهز للمراجعة",
  OPENING_POSTED: "رصيد الافتتاح مُرّحل",
  OPENING_LOCKED: "أُقفل الرصيد — بانتظار أول فترة مالية",
  ACTIVE: "العمليات جارية",
};