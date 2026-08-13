import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FiscalPeriodsPage from "@modules/accounting/fiscal-periods/pages/FiscalPeriodsPage";
import { CurrencyContext, type CurrencyContextValue } from "@app/providers/CurrencyContext";
import { SidePanelSettingsContext } from "@shared/context/SidePanelSettingsContext";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import type { FiscalPeriodDto } from "@erp/shared-types";

vi.mock("@modules/accounting/api/fiscalPeriodService", () => ({
  fiscalPeriodService: {
    listFiscalPeriods: vi.fn(),
    createFiscalPeriod: vi.fn(),
    closeFiscalPeriod: vi.fn(),
    lockFiscalPeriod: vi.fn(),
    reopenFiscalPeriod: vi.fn(),
    computePeriodNetProfit: vi.fn(),
    getDistributableProfit: vi.fn(),
  },
  periodWindowFromDateInput: (start: string, end: string) => ({
    start_date: new Date(`${start}T00:00:00Z`).toISOString(),
    end_date: new Date(`${end}T23:59:59Z`).toISOString(),
  }),
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

function renderPage() {
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
            <FiscalPeriodsPage />
          </QueryClientProvider>
        </CurrencyContext.Provider>
      </SidePanelSettingsContext.Provider>
    </MemoryRouter>,
  );
}

function period(overrides: Partial<FiscalPeriodDto> = {}): FiscalPeriodDto {
  return {
    id: "p1",
    company_id: null,
    start_date: "2026-01-01T00:00:00.000Z",
    end_date: "2026-12-31T23:59:59.000Z",
    status: "Open",
    closed_at: null,
    closed_by: null,
    locked_at: null,
    locked_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FiscalPeriodsPage", () => {
  beforeEach(() => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([period()]);
    vi.mocked(fiscalPeriodService.getDistributableProfit).mockResolvedValue({
      period_id: "p1",
      current_period_profit: "0",
      retained_earnings_balance: "0",
      allocated_to_date: "0",
      distributable: "0",
    });
    vi.mocked(fiscalPeriodService.lockFiscalPeriod).mockResolvedValue(period({ status: "Locked", locked_by: "user" }));
    vi.mocked(fiscalPeriodService.reopenFiscalPeriod).mockResolvedValue(period({ status: "Reopened", closed_at: null, closed_by: null }));
    vi.mocked(fiscalPeriodService.closeFiscalPeriod).mockResolvedValue(period({ status: "Closed", closed_by: "user" }));
    vi.mocked(fiscalPeriodService.createFiscalPeriod).mockResolvedValue(period({ id: "p2" }));
  });

  it("renders the page heading and create form", () => {
    renderPage();
    expect(screen.getByText("الفترات المالية")).toBeInTheDocument();
    expect(screen.getByText("إنشاء فترة مالية")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء الفترة" })).toBeInTheDocument();
  });

  it("lists the open fiscal period with current marker and lock action", async () => {
    renderPage();
    expect(await screen.findByText("2026-01-01")).toBeInTheDocument();
    expect((await screen.findAllByText("مفتوحة")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /قفل نهائي/ })).toBeInTheDocument();
  });

  it("shows an empty state when no periods exist", async () => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("لا توجد فترات بعد")).toBeInTheDocument();
  });

  it("locks a period after confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /قفل نهائي/ }));
    expect(await screen.findByText("قفل الفترة المالية نهائياً")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "قفل نهائي" }));
    await waitFor(() => {
      expect(fiscalPeriodService.lockFiscalPeriod).toHaveBeenCalledWith({
        period_id: "p1",
        locked_by: "user",
      });
    });
  });

  it("reopens a closed period", async () => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([
      period({ status: "Closed", closed_at: "2026-06-01T00:00:00Z", closed_by: "user" }),
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /إعادة فتح/ }));
    expect(await screen.findByText("إعادة فتح الفترة المالية")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إعادة الفتح" }));
    await waitFor(() => {
      expect(fiscalPeriodService.reopenFiscalPeriod).toHaveBeenCalledWith({ period_id: "p1" });
    });
  });

  it("shows no actions for a locked period", async () => {
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([
      period({ status: "Locked", locked_by: "user" }),
    ]);
    renderPage();
    expect(await screen.findByText("مقفول")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /قفل نهائي/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "إغلاق" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /إعادة فتح/ })).not.toBeInTheDocument();
  });
});
