import { describe, it, expect } from "vitest";
import type { OpeningReconciliationDto } from "@modules/accounting/api/openingBalanceService";
import { reconciliationReadiness, readinessLabel, canValidateOpening, selectLatestOpenMigration } from "./migration-labels";

function res(partial: Partial<OpeningReconciliationDto>): OpeningReconciliationDto {
  return { rows: [], debit_total: "0", credit_total: "0", all_reconciled: true, debit_equals_credit: true, opening_control_balance: "0", ...partial };
}

describe("reconciliationReadiness", () => {
  it("is fully ready when balanced, reconciled and control is zero", () => {
    const r = reconciliationReadiness(res({}));
    expect(r.controlZero).toBe(true);
    expect(r.readyToPost).toBe(true);
    expect(r.readyToLock).toBe(true);
    expect(r.blockers).toEqual([]);
  });

  it("blocks when debit ≠ credit", () => {
    const r = reconciliationReadiness({ ...res({}), debit_equals_credit: false });
    expect(r.readyToPost).toBe(false);
    expect(r.blockers).toContain("القيد غير متوازن (مدين ≠ دائن)");
  });

  it("blocks when sub-ledgers do not match", () => {
    const r = reconciliationReadiness(res({ all_reconciled: false }));
    expect(r.readyToPost).toBe(false);
    expect(r.blockers).toContain("الواجهات الفرعية غير مطابقة");
  });

  it("blocks lock when the 53 control is not zero", () => {
    const r = reconciliationReadiness(
      res({ opening_control_balance: "12.5" }),
    );
    expect(r.controlZero).toBe(false);
    expect(r.readyToPost).toBe(true);
    expect(r.readyToLock).toBe(false);
    expect(r.blockers).toContain("رصيد الافتتاح (53) لم يُصفَّر بعد");
  });
});

describe("canValidateOpening", () => {
  const migration = (status: string) => ({ id: "m1", status });

  it("enables the verify step for an editable Draft that reconciles", () => {
    expect(canValidateOpening(migration("Draft"), res({}))).toBe(true);
  });

  it("enables re-verification for an already Validated migration", () => {
    expect(canValidateOpening(migration("Validated"), res({}))).toBe(true);
  });

  it("keeps the verify step disabled until the equations reconcile", () => {
    expect(canValidateOpening(migration("Draft"), res({ debit_equals_credit: false }))).toBe(false);
    expect(canValidateOpening(migration("Draft"), res({ all_reconciled: false }))).toBe(false);
  });

  it("keeps the verify step disabled when the migration is sealed or absent", () => {
    expect(canValidateOpening(null, res({}))).toBe(false);
    expect(canValidateOpening(migration("Posted"), res({}))).toBe(false);
    expect(canValidateOpening(migration("Locked"), res({}))).toBe(false);
    expect(canValidateOpening(migration("Cancelled"), res({}))).toBe(false);
  });
});

describe("selectLatestOpenMigration", () => {
  const m = (id: string, status: string, cutover: string) => ({ id, status, cutover_date: cutover });

  it("returns the most recent non-cancelled migration", () => {
    expect(selectLatestOpenMigration([m("a", "Draft", "2026-02-01"), m("b", "Validated", "2026-01-01")])?.id).toBe("a");
  });

  it("ignores cancelled migrations even when newest", () => {
    expect(selectLatestOpenMigration([m("c", "Cancelled", "2026-03-01"), m("b", "Posted", "2026-01-01")])?.id).toBe("b");
  });

  it("returns null when empty, all cancelled, or missing", () => {
    expect(selectLatestOpenMigration([])).toBeNull();
    expect(selectLatestOpenMigration([m("c", "Cancelled", "2026-03-01")])).toBeNull();
    expect(selectLatestOpenMigration(null)).toBeNull();
  });
});

describe("readinessLabel", () => {
  it("labels a lock-ready state", () => {
    const r = reconciliationReadiness(res({}));
    expect(readinessLabel(r)).toContain("جاهز للترحيل والقفل");
  });

  it("labels a post-ready but not control-zero state", () => {
    const r = reconciliationReadiness(res({ opening_control_balance: "1" }));
    expect(readinessLabel(r)).toContain("جاهز للترحيل");
  });
});