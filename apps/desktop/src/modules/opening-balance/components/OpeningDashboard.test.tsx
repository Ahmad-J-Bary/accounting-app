import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpeningDashboard } from "@modules/opening-balance/components/OpeningDashboard";
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
    obe_pending_reclassification: false,
    difference_message: null,
    unreconciled_items: [],
    validation_errors: [],
    asset_detail: [
      line("122", "الصندوق", "Other", "300"),
      line("112", "العملاء", "Receivable", "1200"),
      line("141", "المواد", "Inventory", "800"),
      line("181", "أصول ثابتة", "FixedAsset", "200"),
    ],
    liability_detail: [line("221", "الموردون", "Payable", "1300")],
    equity_detail: [
      line("5199", "رأس مال الشريك", "PartnerCapital", "800"),
      line("5399", "حساب جاري الشريك", "PartnerCurrent", "100"),
      line("5211", "أرباح مبقاة", "RetainedEarnings", "100"),
    ],
    partner_rows: [],
  };
}

describe("OpeningDashboard", () => {
  it("renders the accounting-equation totals and the 8 sections", () => {
    const snapshot = deriveOpeningSnapshot({ status: "Posted", position: samplePosition() });
    render(<OpeningDashboard snapshot={snapshot} />);
    expect(screen.getByText("إجمالي الأصول")).toBeInTheDocument();
    expect(screen.getByText("إجمالي الخصوم")).toBeInTheDocument();
    expect(screen.getByText("إجمالي حقوق الملكية")).toBeInTheDocument();
    expect(screen.getByText("متوازن ✓")).toBeInTheDocument();
    expect(screen.getByText("جاهز للترحيل والقفل ✓")).toBeInTheDocument();
    for (const label of ["النقد والبنوك", "الذمم المدينة (العملاء)", "المخزون", "الأصول الثابتة", "الذمم الدائنة (الموردون)", "الالتزامات الأخرى", "رؤوس أموال الشركاء", "حقوق الملكية الأخرى"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows blockers and no ready-to-lock badge when not ready", () => {
    const pos = samplePosition();
    pos.is_balanced = false;
    pos.unreconciled_items = [
      { key: "AR", label: "الذمم المدينة (العملاء)", subledger: "1100", general_ledger: "1200" },
    ];
    const snapshot = deriveOpeningSnapshot({ status: "Draft", position: pos });
    const { container } = render(<OpeningDashboard snapshot={snapshot} />);
    expect(screen.getByText("غير متوازن")).toBeInTheDocument();
    expect(screen.queryByText("جاهز للترحيل والقفل ✓")).not.toBeInTheDocument();
    expect(container.textContent).toContain("الذمم المدينة (العملاء)");
  });

  it("renders the empty placeholder when no position data exists yet", () => {
    const snapshot = deriveOpeningSnapshot({ status: null, position: null });
    render(<OpeningDashboard snapshot={snapshot} />);
    expect(screen.getByText("لا توجد أرصدة مفتوحة بعد")).toBeInTheDocument();
  });

  it("fires onOpenSection when a section card is clicked", () => {
    const onOpen = vi.fn();
    const snapshot = deriveOpeningSnapshot({ status: "Posted", position: samplePosition() });
    render(<OpeningDashboard snapshot={snapshot} onOpenSection={onOpen} />);
    fireEvent.click(screen.getByText("المخزون"));
    expect(onOpen).toHaveBeenCalledWith("inventory");
  });
});