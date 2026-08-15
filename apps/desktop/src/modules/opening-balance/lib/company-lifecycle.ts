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

// Node id of the opening-balance page in the sidebar page registry. For a NEW
// company the item is filtered out and the route redirects to /dashboard.
export const OPENING_NAV_ID = "opening-balance-migration";

export function companyTypeOf(settings?: CompanyLifecycleSettingsLike | null): CompanyType {
  // Defaults to EXISTING (waiting for persisted settings while loading, and the
  // new-company default at creation) so nothing flashes to "company is new".
  return settings?.accounting_start_mode === START_MODE_NEW
    ? START_MODE_NEW
    : START_MODE_EXISTING;
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
// migration, so its nav entry is filtered out (the route also redirects).
export function filterNavByCompanyType<T extends { id: string }>(
  items: readonly T[],
  settings?: CompanyLifecycleSettingsLike | null,
): T[] {
  const type = companyTypeOf(settings);
  if (type === START_MODE_NEW) {
    return items.filter((item) => item.id !== OPENING_NAV_ID);
  }
  return [...items];
}

export const INIT_STATE_LABELS: Record<CompanyInitState, string> = {
  NOT_STARTED: "لم يبدأ بعد",
  OPENING_IN_PROGRESS: "رصيد الافتتاح قيد الإعداد",
  OPENING_READY: "رصيد الافتتاح جاهز للمراجعة",
  OPENING_POSTED: "رصيد الافتتاح مُرّحل",
  OPENING_LOCKED: "أُقفل الرصيد — بانتظار أول فترة مالية",
  ACTIVE: "العمليات جارية",
};