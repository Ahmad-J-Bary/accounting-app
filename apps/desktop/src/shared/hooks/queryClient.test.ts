import { describe, it, expect } from "vitest";
import { QUERY_KEYS, ALL_REPORT_KEYS, ALL_ACCOUNTING_MUTATION_KEYS } from "./queryClient";

describe("QUERY_KEYS — report key discipline", () => {
  it("مفتاح ميزان المراجعة يتغير مع الفترة (لا يبقى ثابتاً مخبأً)", () => {
    const q1 = QUERY_KEYS.trialBalance("2026-01-01", "2026-06-30");
    const q2 = QUERY_KEYS.trialBalance("2026-07-01", "2026-12-31");
    expect(q1).not.toEqual(q2);
    expect(q1).toEqual(["reports", "trial-balance", "2026-01-01", "2026-06-30"]);
    expect(ALL_REPORT_KEYS.some((k) => k[0] === "reports" && k[1] === "trial-balance")).toBe(true);
  });

  it("مفتاح لوحة التحكم ضمن مفاتيح الإبطال بعد أي طفرة محاسبية", () => {
    expect(ALL_REPORT_KEYS).toContain(QUERY_KEYS.dashboard);
    expect(ALL_ACCOUNTING_MUTATION_KEYS).toContain(QUERY_KEYS.dashboard);
  });

  it("كل خصم/دائن يُبطِل مفاتيح المفردات والشجرة بالبادئة (expense-items لم تعد مصدراً)", () => {
    expect(ALL_REPORT_KEYS.some((k) => k[0] === "journal-entries")).toBe(true);
    expect(ALL_REPORT_KEYS.some((k) => k[0] === "account-ledger")).toBe(true);
    expect(ALL_ACCOUNTING_MUTATION_KEYS).toContain(QUERY_KEYS.chartOfAccounts);
  });
});