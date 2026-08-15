import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { CurrencyContext, type CurrencyContextValue } from "@app/providers/CurrencyContext";
import { SidePanelSettingsContext } from "@shared/context/SidePanelSettingsContext";
import { TabContext } from "@app/providers/TabContext";
import type { TabContextType } from "@shared/types/tabs";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { CompanyType } from "@modules/opening-balance/lib/company-lifecycle";

export const currencyValue: CurrencyContextValue = {
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

export const tabValue: TabContextType = {
  tabs: [],
  activeTabId: "",
  openTab: vi.fn(),
  updateMainTab: vi.fn(),
  closeTab: vi.fn(),
  switchTab: vi.fn(),
  nextTab: vi.fn(),
  prevTab: vi.fn(),
};

export const sidePanelValue = {
  settings: {} as never,
  updateSetting: vi.fn(),
  resetSettings: vi.fn(),
  getFontSizeClass: () => "",
  getPaddingClass: () => "",
  getSpacingClass: () => "",
  getSidebarWidth: () => "",
};

/**
 * Renders a component with the persisted company type already available in the
 * query cache (so `useCompanyType`/`useCompanyCapabilities` read NEW/EXISTING
 * immediately without needing a settingsService mock).
 */
export function renderWithCompanyType(ui: ReactNode, companyType: CompanyType) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(QUERY_KEYS.settings, { accounting_start_mode: companyType });

  return {
    qc,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <CurrencyContext.Provider value={currencyValue}>
            <SidePanelSettingsContext.Provider value={sidePanelValue}>
              <TabContext.Provider value={tabValue}>{ui}</TabContext.Provider>
            </SidePanelSettingsContext.Provider>
          </CurrencyContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}