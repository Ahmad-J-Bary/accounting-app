import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LoadedPartnerProfitShareData } from "@modules/reports/hooks/usePartnerProfitShareReport";
import PartnerStatementReport from "./PartnerStatementReport";

const { hookState } = vi.hoisted(() => ({
  hookState: {
    loading: false,
    error: false,
    reportData: {
      partners: [],
      netProfit: 0,
      inventoryValue: 0,
      fixedAssetsValue: 0,
      partnerDrawings: {},
      customerDebts: 0,
      partnerLedgers: {},
    } as LoadedPartnerProfitShareData,
    loadReportData: vi.fn(),
  },
}));

vi.mock("@modules/reports/hooks/usePartnerProfitShareReport", () => ({
  usePartnerProfitShareReport: () => hookState,
}));

vi.mock("@modules/reports/components/PartnerStatementView", () => ({
  PartnerStatementView: () => <div data-testid="statement-view" />,
}));

vi.mock("@modules/reports/lib/partnerStatement", () => ({
  computePartnerStatement: () => ({
    rows: [
      {
        partnerId: "p1",
        partnerName: "أحمد",
        capitalAmount: 180,
        accumulatedProfits: 0,
        accumulatedDrawings: 0,
        currentAccount: 180,
        thisYearProfit: 0,
        thisYearDrawings: 0,
        finalAmount: 180,
      },
    ],
  }),
}));

vi.mock("@modules/reports/lib/partnerProfitShare", () => ({
  computePartnerProfitShare: () => ({
    totalCapital: 180,
    netProfit: 0,
    inventoryValue: 0,
    fixedAssetsValue: 0,
    totalOperationalAssets: 0,
    totalCustomerDebts: 0,
    rows: [],
  }),
}));

vi.mock("@widgets/templates/OperationalTableTemplate", () => ({
  OperationalTableTemplate: ({ tableContent }: { tableContent: React.ReactNode }) => (
    <div>{tableContent}</div>
  ),
}));

vi.mock("@widgets/reports/ReportFilterBar", () => ({
  ReportFilterBar: () => null,
}));

vi.mock("@app/providers/CurrencyContext", () => ({
  useCurrencyContext: () => ({
    baseCurrency: { code: "S" },
    currencies: [],
    formatAmount: (value: number) => String(value),
    hasMultipleCurrencies: false,
  }),
}));

vi.mock("@shared/hooks/useReportFilters", () => ({
  useReportFilters: () => ({
    filters: { from_date: "2026-01-01", to_date: "2026-08-04" },
    setFilters: vi.fn(),
    selectedCurrency: "S",
    setSelectedCurrency: vi.fn(),
  }),
}));

describe("PartnerStatementReport empty/error/data branching", () => {
  beforeEach(() => {
    hookState.loading = false;
    hookState.error = false;
    hookState.reportData = {
      partners: [],
      netProfit: 0,
      inventoryValue: 0,
      fixedAssetsValue: 0,
      partnerDrawings: {},
      customerDebts: 0,
      partnerLedgers: {},
    };
  });

  it("renders the detail view when real partners exist (even with empty-lines opening-only ledgers)", () => {
    hookState.reportData = {
      ...hookState.reportData,
      partners: [
        {
          id: "p1",
          code: "",
          name: "أحمد",
          phone: null,
          address: null,
          debit: "0",
          credit: "0",
          opening_balance: "0",
          balance: "0",
          currency: "S",
          notes: null,
          is_active: true,
          exchange_rate: "1",
          amount_local: "180",
          amount_original: "180",
          is_amount_in_original: false,
          profit_sharing_ratio: null,
          profit_sharing_type: "BasedOnCapitalLocal",
          linked_account_id: "c1",
          drawings_account_id: null,
          current_account_id: null,
        },
      ],
      partnerLedgers: {
        c1: {
          account_id: "c1",
          account_name: "رأس مال",
          opening_balance_base: "180",
          opening_balance_original: "0",
          opening_entry: null,
          opening_entries: [],
          lines: [],
          total_debit_base: "0",
          total_credit_base: "0",
          closing_balance_base: "0",
          total_debit_original: "0",
          total_credit_original: "0",
          closing_balance_original: "0",
        },
      },
    } as LoadedPartnerProfitShareData;

    render(<PartnerStatementReport />);

    expect(screen.getByTestId("statement-view")).toBeInTheDocument();
    expect(screen.queryByText("لا يوجد شركاء لعرض كشف الحساب")).not.toBeInTheDocument();
  });

  it("shows the real empty state only when the partner list is truly empty", () => {
    render(<PartnerStatementReport />);

    expect(screen.getByText("لا يوجد شركاء لعرض كشف الحساب")).toBeInTheDocument();
  });

  it("surfaces a query error instead of the empty-state message", () => {
    hookState.error = true;

    render(<PartnerStatementReport />);

    expect(screen.queryByText("لا يوجد شركاء لعرض كشف الحساب")).not.toBeInTheDocument();
    expect(screen.getByText("تعذر تحميل بيانات التقرير")).toBeInTheDocument();
  });
});