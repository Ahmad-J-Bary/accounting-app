import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import OpeningBalanceMigration from "@modules/opening-balance/pages/openingBalanceMigration";
import { SidePanelSettingsProvider } from "@app/providers/SidePanelSettingsProvider";
import { SidebarLayoutProvider } from "@app/providers/SidebarLayoutProvider";
import { TabProvider } from "@app/providers/TabProvider";
import { LocalizationProvider } from "@app/providers/LocalizationProvider";
import { settingsService } from "@modules/core/api/settingsService";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { START_MODE_EXISTING, START_MODE_NEW } from "@modules/opening-balance/lib/wizard-types";

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" }),
    updateSettings: vi.fn(),
  },
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
  localStorage.setItem("erp_language", "ar");
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={qc}>
        <LocalizationProvider>
          <TabProvider>
            <SidePanelSettingsProvider>
              <SidebarLayoutProvider>
                <Routes>
                  <Route path="/opening-balance-migration" element={<OpeningBalanceMigration />} />
                  <Route path="/dashboard" element={<div>DASHBOARD_ROOT</div>} />
                </Routes>
              </SidebarLayoutProvider>
            </SidePanelSettingsProvider>
          </TabProvider>
        </LocalizationProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { qc, ...ui };
}

describe("OpeningBalanceMigration company-type gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("erp_language");
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

  it("shows the wizard directly for an EXISTING company with a NOT_STARTED badge", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      accounting_start_mode: START_MODE_EXISTING,
    } as never);
    renderPage();
    expect(await screen.findByText("لم يبدأ بعد")).toBeInTheDocument();
    // The wizard is shown directly — no tabs, no welcome card.
    expect(screen.queryByText("نظرة عامة")).not.toBeInTheDocument();
    expect(screen.queryByText("قائمة الترحيلات")).not.toBeInTheDocument();
  });

  it("keeps a fully ACTIVE EXISTING company on the post-transition completion step (no redirect)", { timeout: 15000 }, async () => {
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
    const user = userEvent.setup();
    const { qc } = renderPage();
    await waitFor(() => expect(qc.getQueryData(QUERY_KEYS.openingBalanceMigrations)).toBeTruthy());
    // The opening page stays and the wizard resumes on the ACTIVE completion step.
    expect(await screen.findByText("اكتمل إعداد الشركة ✓")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الانتقال إلى لوحة التحكم" })).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD_ROOT")).not.toBeInTheDocument();
    // The dashboard button moves through the tab system (not just the URL).
    await user.click(screen.getByRole("button", { name: "الانتقال إلى لوحة التحكم" }));
    expect(await screen.findByText("DASHBOARD_ROOT")).toBeInTheDocument();
  });

  it("keeps a Locked EXISTING company on the done step (no redirect)", async () => {
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
    const { qc } = renderPage();
    await waitFor(() => expect(qc.getQueryData(QUERY_KEYS.openingBalanceMigrations)).toBeTruthy());
    // The wizard shows the done/completion step directly; opening management controls vanish.
    expect(await screen.findByText("اكتمل إعداد الشركة ✓")).toBeInTheDocument();
    expect(screen.queryByText("قائمة الترحيلات")).not.toBeInTheDocument();
    expect(screen.queryByText("المركز والتسوية")).not.toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD_ROOT")).not.toBeInTheDocument();
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