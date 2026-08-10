import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FiscalPeriodReport from "@modules/reports/pages/FiscalPeriodReport";
import { CurrencyContext, type CurrencyContextValue } from "@app/providers/CurrencyContext";
import { SidePanelSettingsContext } from "@shared/context/SidePanelSettingsContext";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import type { FiscalPeriodDto } from "@erp/shared-types";

vi.mock("@modules/accounting/api/fiscalPeriodService", () => ({
  fiscalPeriodService: {
    listFiscalPeriods: vi.fn(),
    createFiscalPeriod: vi.fn(),
    closeFiscalPeriod: vi.fn(),
    computePeriodNetProfit: vi.fn(),
    getDistributableProfit: vi.fn(),
  },
}));

vi.mock("@shared/components/SidebarAddAction", () => ({
  SidebarAddAction: () => null,
}));

const currencyValue: CurrencyContextValue = {
  loading: false,
  baseCurrency: null,
  displayCurrencyCode: null,
  displayMode: "base",
  currencies: [],
  hasMultipleCurrencies: false,
  todayStatus: [],
  rateMap: new Map(),
  setDisplayCurrencyCode: vi.fn(),
  setDisplayMode: vi.fn(),
  refresh: vi.fn(async () => {}),
  updateRate: vi.fn(),
  setRateForToday: vi.fn(async () => {}),
  getLatestRate: vi.fn(async () => null),
  toBase: (a) => a,
  convertFromBase: (a) => a,
  convertBetween: (a) => a,
  formatAmount: (n) => (n ?? 0).toString(),
  formatMonetaryAmount: (n) => (typeof n === "string" || typeof n === "number" ? n.toString() : ""),
  hasTodayRate: () => false,
};

function renderReport() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <SidePanelSettingsContext.Provider
      value={{
        settings: {} as never,
        updateSetting: vi.fn(),
        resetSettings: vi.fn(),
        getFontSizeClass: () => "",
        getPaddingClass: () => "",
        getSpacingClass: () => "",
        getSidebarWidth: () => "",
      }}
    >
      <CurrencyContext.Provider value={currencyValue}>
        <QueryClientProvider client={qc}>
          <FiscalPeriodReport />
        </QueryClientProvider>
      </CurrencyContext.Provider>
    </SidePanelSettingsContext.Provider>
    </MemoryRouter>,
  );
}

const OPEN_PERIOD: FiscalPeriodDto = {
  id: "p1",
  company_id: null,
  start_date: "2026-01-01T00:00:00.000Z",
  end_date: "2026-12-31T00:00:00.000Z",
  status: "Open",
  closed_at: null,
  closed_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("FiscalPeriodReport", () => {
  beforeEach(() => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([OPEN_PERIOD]);
    vi.mocked(fiscalPeriodService.getDistributableProfit).mockResolvedValue({
      period_id: "p1",
      current_period_profit: "0",
      retained_earnings_balance: "0",
      allocated_to_date: "0",
      distributable: "0",
    });
  });

  it("renders the page heading and create form", () => {
    renderReport();
    expect(screen.getByText("الفترات المالية")).toBeInTheDocument();
    expect(screen.getByText("إنشاء فترة مالية")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء الفترة" })).toBeInTheDocument();
  });

  it("lists the open fiscal period row with a status badge", async () => {
    renderReport();
    expect(await screen.findByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getByText("مفتوحة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
  });

  it("shows an empty state when no periods exist", async () => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([]);
    renderReport();
    expect(await screen.findByText("لا توجد فترات بعد")).toBeInTheDocument();
  });

  it("renders the distributable profit card for the active period", async () => {
    renderReport();
    expect(await screen.findByText("الربح القابل للتوزيع (الفترة النشطة)")).toBeInTheDocument();
    expect(await screen.findByText(/الربح القابل للتوزيع:/)).toBeInTheDocument();
  });
});