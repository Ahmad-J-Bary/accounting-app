import { describe, it, expect } from "vitest";
import type { OpeningReconciliationDto } from "@modules/accounting/api/openingBalanceService";
import { reconciliationReadiness, readinessLabel } from "./migration-labels";

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