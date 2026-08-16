import { describe, it, expect } from "vitest";
import { deriveOpeningSnapshot } from "@modules/opening-balance/lib/derive-opening-snapshot";
import type { OpeningPositionControlDto } from "@erp/shared-types";

const line = (code: string, name_ar: string, group_key: string, amount: string) => ({
  account_id: "id-" + code,
  code,
  name_ar,
  purpose: "general",
  group_key,
  amount,
});

function samplePosition(): OpeningPositionControlDto {
  return {
    opening_status: "Posted",
    cutover_date: "2026-01-01T00:00:00Z",
    total_assets: "2500",
    total_liabilities: "1500",
    net_assets: "1000",
    partner_capital: "800",
    partner_current_accounts: "100",
    retained_earnings: "100",
    opening_equity_adjustment: "0",
    other_equity: "0",
    drawings: "0",
    total_equity: "1000",
    equity_difference: "0",
    is_balanced: true,
    opening_historical_result: "0",
    classification: null,
    residual_applied: false,
    difference_message: null,
    unreconciled_items: [],
    validation_errors: [],
    asset_detail: [
      line("122", "الصندوق", "Other", "300"),
      line("112", "العملاء", "Receivable", "1200"),
      line("141", "المواد", "Inventory", "800"),
      line("181", "أصول ثابتة", "FixedAsset", "200"),
      line("113", "سلف", "Other", "0"),
    ],
    liability_detail: [
      line("221", "الموردون", "Payable", "1300"),
      line("241", "قرض بنكي", "Other", "200"),
    ],
    equity_detail: [
      line("5199", "رأس مال الشريك", "PartnerCapital", "800"),
      line("5399", "حساب جاري الشريك", "PartnerCurrent", "100"),
      line("5211", "أرباح مبقاة", "RetainedEarnings", "100"),
    ],
    partner_rows: [],
  };
}

describe("deriveOpeningSnapshot", () => {
  it("returns an empty no-data snapshot when there is no position", () => {
    const s = deriveOpeningSnapshot({ status: null, position: null });
    expect(s.hasData).toBe(false);
    expect(s.sections).toEqual([]);
    expect(s.blockers.length).toBeGreaterThan(0);
  });

  it("maps the 8 sections from the bucketed detail lines", () => {
    const s = deriveOpeningSnapshot({ status: "Posted", position: samplePosition() });
    expect(s.sections.map((x) => x.key)).toEqual([
      "cash-banks",
      "receivables",
      "inventory",
      "fixed-assets",
      "payables",
      "other-liabilities",
      "partner-equity",
      "other-equity",
    ]);
    expect(s.sections.find((x) => x.key === "cash-banks")?.amount).toBe(300);
    expect(s.sections.find((x) => x.key === "receivables")?.amount).toBe(1200);
    expect(s.sections.find((x) => x.key === "payables")?.amount).toBe(1300);
    expect(s.sections.find((x) => x.key === "partner-equity")?.amount).toBe(900); // 800 + 100
    expect(s.sections.find((x) => x.key === "other-equity")?.amount).toBe(100);
  });

  it("flags sections with only zeros/absent data as not done", () => {
    const s = deriveOpeningSnapshot({ status: "Posted", position: samplePosition() });
    expect(s.sections.find((x) => x.key === "cash-banks")?.done).toBe(true);
    const emptyOther = s.sections.find((x) => x.key === "other-liabilities");
    expect(emptyOther?.done).toBe(true); // 200 booked on the loan line
  });

  it("reports blockers for unreconciled items and unbalanced positions", () => {
    const pos = samplePosition();
    pos.is_balanced = false;
    pos.unreconciled_items = [
      { key: "AR", label: "الذمم المدينة (العملاء)", subledger: "1100", general_ledger: "1200" },
    ];
    const s = deriveOpeningSnapshot({ status: "Draft", position: pos });
    expect(s.balanced).toBe(false);
    expect(s.readyToLock).toBe(false);
    expect(s.blockers.some((b) => b.includes("غير متوازن"))).toBe(true);
    expect(s.blockers.some((b) => b.includes("رقم مطابقة"))).toBe(true);
  });

  it("is ready to lock only when balanced, reconciled and residual applied", () => {
    const ok = deriveOpeningSnapshot({ status: "Approved", position: samplePosition() });
    expect(ok.balanced).toBe(true);
    expect(ok.hasData).toBe(true);
    expect(ok.readyToLock).toBe(true);
    expect(ok.totalAssets).toBe(2500);
    expect(ok.totalLiabilities).toBe(1500);
    expect(ok.totalEquity).toBe(1000);
    expect(ok.status).toBe("Approved");
  });

  it("does not block a classified residual from verifying (residual_applied comes at lock)", () => {
    const pos = {
      ...samplePosition(),
      opening_equity_adjustment: "45",
      other_equity: "45",
      classification: "RetainedEarnings",
      residual_applied: false,
    };
    const s = deriveOpeningSnapshot({ status: "Validated", position: pos });
    expect(s.balanced).toBe(true);
    expect(s.blockers.length).toBe(0);
    expect(s.blockers.some((b) => b.includes("تصنيف الرصيد المتبقي"))).toBe(false);
    // verification-ready, but not lock-ready until the plug is moved into the ledger
    expect(s.readyToLock).toBe(false);
  });

  it("blocks an unclassified residual from verifying", () => {
    const pos = {
      ...samplePosition(),
      opening_equity_adjustment: "45",
      other_equity: "45",
      classification: null,
      residual_applied: false,
    };
    const s = deriveOpeningSnapshot({ status: "Draft", position: pos });
    expect(s.balanced).toBe(true);
    expect(s.blockers.some((b) => b.includes("غير مصنّف"))).toBe(true);
    expect(s.readyToLock).toBe(false);
  });

  it("is ready to lock once the classified residual is applied", () => {
    const pos = {
      ...samplePosition(),
      opening_equity_adjustment: "45",
      other_equity: "45",
      classification: "PartnerDrawings",
      residual_applied: true,
    };
    const s = deriveOpeningSnapshot({ status: "Approved", position: pos });
    expect(s.blockers.length).toBe(0);
    expect(s.readyToLock).toBe(true);
  });
});
