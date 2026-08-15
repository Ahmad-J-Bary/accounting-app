import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import OpeningBalanceMigration from "@modules/opening-balance/pages/OpeningBalanceMigration";
import { SidePanelSettingsProvider } from "@app/providers/SidePanelSettingsProvider";
import { SidebarLayoutProvider } from "@app/providers/SidebarLayoutProvider";
import { settingsService } from "@modules/core/api/settingsService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { START_MODE_EXISTING, START_MODE_NEW } from "@modules/opening-balance/lib/wizard-types";

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" }),
    updateSettings: vi.fn(),
  },
}));

vi.mock("@modules/accounting/api/fiscalPeriodService", () => ({
  fiscalPeriodService: {
    listFiscalPeriods: vi.fn().mockResolvedValue([]),
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

vi.mock("@modules/accounting/api/openingBalanceService", () => ({
  openingBalanceService: {
    listMigrations: vi.fn().mockResolvedValue([]),
    getOpeningPositionControl: vi.fn().mockResolvedValue(null),
    getReconciliation: vi.fn().mockResolvedValue(null),
    getOpeningDraft: vi.fn().mockResolvedValue(null),
    clearOpeningDraft: vi.fn(),
    saveOpeningDraft: vi.fn(),
    lockMigration: vi.fn(),
    cancelMigration: vi.fn(),
    reopenMigration: vi.fn(),
    postMigration: vi.fn(),
    allocateNetProfit: vi.fn(),
    computeNetProfit: vi.fn(),
  },
}));

vi.mock("@modules/accounting/api/accountingService", () => ({
  accountingService: { getChartOfAccounts: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/partners/api/customerService", () => ({
  customerService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/partners/api/supplierService", () => ({
  supplierService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/partners/api/partnerService", () => ({
  partnerService: { listPartners: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/inventory/api/materialService", () => ({
  materialService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/inventory/api/warehouseService", () => ({
  warehouseService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/fixed-assets/api/fixedAssetService", () => ({
  fixedAssetService: { list: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@modules/invoicing/api/invoiceService", () => ({
  invoiceService: {
    createInvoice: vi.fn(),
    postInvoice: vi.fn(),
    getNextInvoiceNumber: vi.fn().mockResolvedValue("1"),
  },
}));

function renderPage(initialPath = "/opening-balance-migration") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={qc}>
        <SidePanelSettingsProvider>
          <SidebarLayoutProvider>
            <Routes>
              <Route path="/opening-balance-migration" element={<OpeningBalanceMigration />} />
              <Route path="/dashboard" element={<div>DASHBOARD_ROOT</div>} />
            </Routes>
          </SidebarLayoutProvider>
        </SidePanelSettingsProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { qc, ...ui };
}

describe("OpeningBalanceMigration company-type gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a NEW company to /dashboard (no opening-balance page at all)", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_NEW,
    } as never);
    const { qc } = renderPage();
    await waitFor(() => expect(qc.getQueryData(QUERY_KEYS.settings)).toBeTruthy());
    expect(await screen.findByText("DASHBOARD_ROOT")).toBeInTheDocument();
    expect(screen.queryByText("رصيد افتتاح الشركة")).not.toBeInTheDocument();
  });

  it("shows the full page for an EXISTING company with a NOT_STARTED badge", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    renderPage();
    expect(await screen.findByText("رصيد افتتاح الشركة")).toBeInTheDocument();
    expect(await screen.findByText("لم يبدأ بعد")).toBeInTheDocument();
    // The overview tab is the default landing: welcome for NOT_STARTED companies.
    expect(screen.getByText("نظرة عامة")).toBeInTheDocument();
    expect(screen.getByText("قائمة الترحيلات")).toBeInTheDocument();
    expect(screen.getByText("إعداد رصيد افتتاح الشركة القائمة")).toBeInTheDocument();
    expect(screen.getByText("ابدأ المعالج")).toBeInTheDocument();
  });

  it("redirects a fully ACTIVE EXISTING company away like a NEW one", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([
      {
        id: "m1",
        company_id: null,
        cutover_date: new Date().toISOString().slice(0, 10),
        source_system: null,
        source_reference: null,
        status: "Locked",
        notes: null,
        lines: [],
        validated_by: null,
        validated_at: null,
        approved_by: null,
        approved_at: null,
        posted_at: null,
        locked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as never);
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([
      { id: "p1", status: "Open", start_date: "2026-01-01", end_date: "2026-12-31" } as never,
    ]);
    const { qc } = renderPage();
    await waitFor(() => expect(qc.getQueryData(QUERY_KEYS.openingBalanceMigrations)).toBeTruthy());
    expect(await screen.findByText("DASHBOARD_ROOT")).toBeInTheDocument();
    expect(screen.queryByText("رصيد افتتاح الشركة")).not.toBeInTheDocument();
  });

  it("redirects away once Locked but the first fiscal period is still pending (OPENING_LOCKED)", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([
      {
        id: "m1",
        company_id: null,
        cutover_date: new Date().toISOString().slice(0, 10),
        source_system: null,
        source_reference: null,
        status: "Locked",
        notes: null,
        lines: [],
        validated_by: null,
        validated_at: null,
        approved_by: null,
        approved_at: null,
        posted_at: null,
        locked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as never);
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([] as never);
    const { qc } = renderPage();
    await waitFor(() => expect(qc.getQueryData(QUERY_KEYS.openingBalanceMigrations)).toBeTruthy());
    expect(await screen.findByText("DASHBOARD_ROOT")).toBeInTheDocument();
    expect(screen.queryByText("رصيد افتتاح الشركة")).not.toBeInTheDocument();
  });

  it("shows an OPENING_IN_PROGRESS badge once a draft migration exists", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([
      {
        id: "m1",
        company_id: null,
        cutover_date: new Date().toISOString().slice(0, 10),
        source_system: null,
        source_reference: null,
        status: "Draft",
        notes: null,
        lines: [],
        validated_by: null,
        validated_at: null,
        approved_by: null,
        approved_at: null,
        posted_at: null,
        locked_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as never);
    renderPage();
    expect(await screen.findByText("رصيد الافتتاح قيد الإعداد")).toBeInTheDocument();
  });
});