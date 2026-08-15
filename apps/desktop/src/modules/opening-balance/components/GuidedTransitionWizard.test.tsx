import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GuidedTransitionWizard } from "@modules/opening-balance/components/GuidedTransitionWizard";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { settingsService } from "@modules/core/api/settingsService";

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

vi.mock("@modules/core/api/settingsService", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue({ accounting_start_mode: "NewCompany" }),
    updateSettings: vi.fn(),
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

const PERIOD = {
  id: "fp-1",
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
};

function renderWizard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <GuidedTransitionWizard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("GuidedTransitionWizard", () => {
  beforeEach(() => {
    vi.mocked(fiscalPeriodService.createFiscalPeriod).mockResolvedValue(PERIOD as never);
    vi.mocked(settingsService.getSettings).mockResolvedValue({ accounting_start_mode: "NewCompany" } as never);
  });

  it("NewCompany mode renders only the two-step flow with first-period fields", async () => {
    renderWizard();
    expect(await screen.findByText("بدء محاسبة شركة جديدة")).toBeInTheDocument();
    expect(screen.getByText("بدء الحسابات")).toBeInTheDocument();
    expect(screen.getByText("اكتمال")).toBeInTheDocument();
    expect(screen.queryByText("الشركاء ورأس المال")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/بداية الفترة/)).toBeInTheDocument();
    expect(screen.getByLabelText(/نهاية الفترة/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء الفترة الأولى والبدء" })).toBeEnabled();
  });

  it("creates the first financial period and finishes for a new company", async () => {
    const user = userEvent.setup();
    renderWizard();
    await screen.findByText("بدء محاسبة شركة جديدة");
    await user.click(screen.getByRole("button", { name: "إنشاء الفترة الأولى والبدء" }));
    await waitFor(() => {
      expect(fiscalPeriodService.createFiscalPeriod).toHaveBeenCalledWith({
        start_date: expect.any(String),
        end_date: expect.any(String),
      });
    });
    expect(await screen.findByText("تم بدء المحاسبة بنجاح ✓")).toBeInTheDocument();
  });

  it("ExistingCompany mode runs the 15-step transition incl. the first-period step", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" } as never);
    renderWizard();
    expect(await screen.findByText("معالج التحويل الموجه (شركة قائمة)")).toBeInTheDocument();
    expect(screen.getByText("أول فترة تشغيلية")).toBeInTheDocument();
    expect(screen.getByText("النقد والبنوك")).toBeInTheDocument();
    expect(screen.getByText("المخزون")).toBeInTheDocument();
    expect(screen.getByText("الشركاء وحقوق الملكية")).toBeInTheDocument();
    expect(screen.queryByText("الشركاء ورأس المال")).not.toBeInTheDocument();
    expect(screen.getByText("القفل")).toBeInTheDocument();
    expect(screen.getByText("اكتمال")).toBeInTheDocument();
  });
});
