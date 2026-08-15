import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import OpeningBalance from "@modules/opening-balance/pages/openingBalance";
import { CurrencyContext, type CurrencyContextValue } from "@app/providers/CurrencyContext";
import { SidePanelSettingsContext } from "@shared/context/SidePanelSettingsContext";
import { SidebarLayoutProvider } from "@app/providers/SidebarLayoutProvider";
import { TabContext } from "@app/providers/TabContext";
import { TableSettingsContext } from "@shared/context/TableSettingsContext";
import { settingsService } from "@modules/core/api/settingsService";
import { START_MODE_EXISTING, START_MODE_NEW } from "@modules/opening-balance/lib/wizard-types";

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" }),
  },
}));

vi.mock("@modules/inventory/api/materialService", () => ({
  materialService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@modules/inventory/api/warehouseService", () => ({
  warehouseService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@modules/inventory/api/categoryService", () => ({
  categoryService: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@modules/invoicing/api/invoiceService", () => ({
  invoiceService: {
    getNextInvoiceNumber: vi.fn().mockResolvedValue("1"),
    getInvoiceById: vi.fn(),
    createInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    postInvoice: vi.fn(),
    reopenInvoice: vi.fn(),
  },
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
  formatMonetaryAmount: (n) =>
    typeof n === "string" || typeof n === "number" ? n.toString() : "",
  hasTodayRate: () => false,
};

const sidePanelValue = {
  settings: {} as never,
  updateSetting: vi.fn(),
  resetSettings: vi.fn(),
  getFontSizeClass: () => "",
  getPaddingClass: () => "",
  getSpacingClass: () => "",
  getSidebarWidth: () => "",
};

const tabValue = {
  tabs: [],
  activeTabId: "",
  openTab: vi.fn(),
  updateMainTab: vi.fn(),
  closeTab: vi.fn(),
  switchTab: vi.fn(),
  nextTab: vi.fn(),
  prevTab: vi.fn(),
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={["/opening-balance"]}>
      <QueryClientProvider client={qc}>
        <CurrencyContext.Provider value={currencyValue}>
          <SidePanelSettingsContext.Provider value={sidePanelValue}>
            <SidebarLayoutProvider>
              <TabContext.Provider value={tabValue}>
                <TableSettingsContext.Provider
                  value={{
                    settings: {} as never,
                    updateSetting: vi.fn(),
                    resetSettings: vi.fn(),
                    getDensityPadding: () => "",
                    getRowHeight: () => "",
                  }}
                >
                  <Routes>
                    <Route path="/opening-balance" element={<OpeningBalance />} />
                    <Route path="/dashboard" element={<div>DASHBOARD_ROOT</div>} />
                  </Routes>
                </TableSettingsContext.Provider>
              </TabContext.Provider>
            </SidebarLayoutProvider>
          </SidePanelSettingsContext.Provider>
        </CurrencyContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("openingBalance (فاتورة أول المدة) company-type gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a NEW company to /dashboard (no opening invoice page at all)", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_NEW,
    } as never);
    renderPage();
    expect(await screen.findByText("DASHBOARD_ROOT")).toBeInTheDocument();
    expect(screen.queryByText("بضاعة أول المدة")).not.toBeInTheDocument();
  });

  it("keeps the opening invoice page for an EXISTING company", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    renderPage();
    expect(await screen.findByText("بضاعة أول المدة")).toBeInTheDocument();
  });
});