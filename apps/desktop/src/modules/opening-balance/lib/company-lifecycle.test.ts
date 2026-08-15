import { describe, it, expect } from "vitest";
import {
  companyTypeOf,
  deriveCompanyInitState,
  filterNavByCompanyType,
  OPENING_NAV_ID,
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
    { id: "fiscal-periods" },
    { id: "dashboard" },
  ] as { id: string }[];

  it("hides the opening-balance entry for a NEW company, keeps everything else", () => {
    const filtered = filterNavByCompanyType(items, NEW);
    expect(filtered.map((i) => i.id)).toEqual(["fiscal-periods", "dashboard"]);
  });

  it("keeps the opening-balance entry for an EXISTING company", () => {
    expect(filterNavByCompanyType(items, EXISTING).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("keeps everything while settings are unknown (default EXISTING)", () => {
    expect(filterNavByCompanyType(items, undefined).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("uses the single opening nav id", () => {
    expect(OPENING_NAV_ID).toBe("opening-balance-migration");
    expect(COMPANY_TYPE_NEW).toBe(START_MODE_NEW);
    expect(COMPANY_TYPE_EXISTING).toBe(START_MODE_EXISTING);
  });
});