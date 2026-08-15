import { describe, it, expect } from "vitest";
import {
  companyTypeOf,
  companyCapabilities,
  companyCapabilitiesOf,
  deriveCompanyInitState,
  filterNavByCompanyType,
  hiddenNavIdsForNew,
  hiddenNavIds,
  isTransactionalAllowed,
  OPENING_NAV_ID,
  OPENING_INVOICE_NAV_ID,
  HIDDEN_NAV_IDS_FOR_NEW,
  TRANSACTIONAL_NAV_IDS,
} from "@modules/opening-balance/lib/company-lifecycle";
import {
  COMPANY_TYPE_EXISTING,
  COMPANY_TYPE_NEW,
  START_MODE_EXISTING,
  START_MODE_NEW,
} from "@modules/opening-balance/lib/wizard-types";

const EXISTING = { accounting_start_mode: START_MODE_EXISTING };
const NEW = { accounting_start_mode: START_MODE_NEW };

describe("companyTypeOf", () => {
  it("defaults to EXISTING while settings are unknown/loading", () => {
    expect(companyTypeOf(undefined)).toBe(COMPANY_TYPE_EXISTING);
    expect(companyTypeOf(null)).toBe(COMPANY_TYPE_EXISTING);
    expect(companyTypeOf({})).toBe(COMPANY_TYPE_EXISTING);
  });

  it("reads the persisted company type", () => {
    expect(companyTypeOf(EXISTING)).toBe(COMPANY_TYPE_EXISTING);
    expect(companyTypeOf(NEW)).toBe(COMPANY_TYPE_NEW);
  });
});

describe("deriveCompanyInitState", () => {
  it("a NEW company is always ACTIVE (no opening balance ever)", () => {
    expect(deriveCompanyInitState({ settings: NEW, migrations: [], periods: [] })).toBe("ACTIVE");
    expect(
      deriveCompanyInitState({ settings: NEW, migrations: [{ status: "Approved" }], periods: [] }),
    ).toBe("ACTIVE");
  });

  it("an EXISTING company with no migration is NOT_STARTED", () => {
    expect(deriveCompanyInitState({ settings: EXISTING, migrations: [], periods: [] })).toBe(
      "NOT_STARTED",
    );
  });

  it("cancelled-only migrations are treated as not started", () => {
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Cancelled" }], periods: [] }),
    ).toBe("NOT_STARTED");
  });

  it("maps migration status to the initialization state", () => {
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Draft" }], periods: [] }),
    ).toBe("OPENING_IN_PROGRESS");
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Validated" }], periods: [] }),
    ).toBe("OPENING_IN_PROGRESS");
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Approved" }], periods: [] }),
    ).toBe("OPENING_READY");
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Posted" }], periods: [] }),
    ).toBe("OPENING_POSTED");
  });

  it("a locked migration without a fiscal period is OPENING_LOCKED, with one it is ACTIVE", () => {
    expect(
      deriveCompanyInitState({ settings: EXISTING, migrations: [{ status: "Locked" }], periods: [] }),
    ).toBe("OPENING_LOCKED");
    expect(
      deriveCompanyInitState({
        settings: EXISTING,
        migrations: [{ status: "Locked" }],
        periods: [{ status: "Open" }],
      }),
    ).toBe("ACTIVE");
  });

  it("prefers the most advanced non-cancelled migration", () => {
    expect(
      deriveCompanyInitState({
        settings: EXISTING,
        migrations: [{ status: "Draft" }, { status: "Locked" }],
        periods: [{ status: "Open" }],
      }),
    ).toBe("ACTIVE");
  });
});

describe("filterNavByCompanyType", () => {
  const items = [
    { id: "opening-balance-migration" },
    { id: "opening-balance" },
    { id: "fiscal-periods" },
    { id: "dashboard" },
  ] as { id: string }[];

  it("hides ALL opening entries for a NEW company, keeps everything else", () => {
    const filtered = filterNavByCompanyType(items, NEW);
    expect(filtered.map((i) => i.id)).toEqual(["fiscal-periods", "dashboard"]);
  });

  it("keeps the opening entries for an EXISTING company", () => {
    expect(filterNavByCompanyType(items, EXISTING).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("keeps everything while settings are unknown (default EXISTING)", () => {
    expect(filterNavByCompanyType(items, undefined).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("uses the single opening nav id", () => {
    expect(OPENING_NAV_ID).toBe("opening-balance-migration");
    expect(OPENING_INVOICE_NAV_ID).toBe("opening-balance");
    expect(HIDDEN_NAV_IDS_FOR_NEW).toContain(OPENING_NAV_ID);
    expect(HIDDEN_NAV_IDS_FOR_NEW).toContain(OPENING_INVOICE_NAV_ID);
    expect(COMPANY_TYPE_NEW).toBe(START_MODE_NEW);
    expect(COMPANY_TYPE_EXISTING).toBe(START_MODE_EXISTING);
  });
});

describe("hiddenNavIdsForNew", () => {
  it("returns the opening ids as a set only for a NEW company", () => {
    expect([...hiddenNavIdsForNew(NEW)]).toEqual([...HIDDEN_NAV_IDS_FOR_NEW]);
  });

  it("returns an empty set for an EXISTING company or while loading", () => {
    expect(hiddenNavIdsForNew(EXISTING).size).toBe(0);
    expect(hiddenNavIdsForNew(undefined).size).toBe(0);
  });
});

describe("hiddenNavIds", () => {
  it("NEW company hides the opening nav ids regardless of state", () => {
    expect([...hiddenNavIds(COMPANY_TYPE_NEW, "OPENING_IN_PROGRESS")]).toEqual([...HIDDEN_NAV_IDS_FOR_NEW]);
    expect([...hiddenNavIds(COMPANY_TYPE_NEW, "ACTIVE")]).toEqual([...HIDDEN_NAV_IDS_FOR_NEW]);
  });

  it("EXISTING company hides the opening nav ids once ACTIVE", () => {
    expect([...hiddenNavIds(COMPANY_TYPE_EXISTING, "ACTIVE")]).toEqual([...HIDDEN_NAV_IDS_FOR_NEW]);
  });

  it("EXISTING company mid-opening hides the transactional nav ids instead", () => {
    for (const state of ["NOT_STARTED", "OPENING_IN_PROGRESS", "OPENING_READY", "OPENING_POSTED", "OPENING_LOCKED"] as const) {
      const hidden = hiddenNavIds(COMPANY_TYPE_EXISTING, state);
      expect([...hidden]).toEqual([...TRANSACTIONAL_NAV_IDS]);
    }
  });

  it("transactional set contains the daily-log entry points but not master data", () => {
    for (const id of ["journal", "payments", "sales-invoices", "inventory", "adjustments"]) {
      expect(TRANSACTIONAL_NAV_IDS).toContain(id);
    }
    for (const id of ["customers", "suppliers", "materials", "opening-balance-migration", "opening-balance"]) {
      expect(TRANSACTIONAL_NAV_IDS).not.toContain(id);
    }
  });
});

describe("isTransactionalAllowed", () => {
  it("NEW companies are always allowed to transact", () => {
    expect(isTransactionalAllowed(COMPANY_TYPE_NEW, "NOT_STARTED")).toBe(true);
    expect(isTransactionalAllowed(COMPANY_TYPE_NEW, "ACTIVE")).toBe(true);
  });

  it("EXISTING companies transact only once ACTIVE", () => {
    expect(isTransactionalAllowed(COMPANY_TYPE_EXISTING, "ACTIVE")).toBe(true);
    for (const state of ["NOT_STARTED", "OPENING_IN_PROGRESS", "OPENING_READY", "OPENING_POSTED", "OPENING_LOCKED"] as const) {
      expect(isTransactionalAllowed(COMPANY_TYPE_EXISTING, state)).toBe(false);
    }
  });
});

describe("companyCapabilities", () => {
  it("NEW company: no opening workflow at all", () => {
    const caps = companyCapabilities(COMPANY_TYPE_NEW);
    expect(caps.isExistingCompany).toBe(false);
    expect(caps.isOpeningRequired).toBe(false);
    expect(caps.canUseOpeningWorkflow).toBe(false);
  });

  it("EXISTING company: opening workflow fully available", () => {
    const caps = companyCapabilities(COMPANY_TYPE_EXISTING);
    expect(caps.isExistingCompany).toBe(true);
    expect(caps.isOpeningRequired).toBe(true);
    expect(caps.canUseOpeningWorkflow).toBe(true);
  });

  it("derives capabilities from persisted settings (default EXISTING while loading)", () => {
    expect(companyCapabilitiesOf(NEW).canUseOpeningWorkflow).toBe(false);
    expect(companyCapabilitiesOf(EXISTING).canUseOpeningWorkflow).toBe(true);
    expect(companyCapabilitiesOf(undefined).canUseOpeningWorkflow).toBe(true);
  });
});