import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GuidedTransitionWizard } from "@modules/opening-balance/components/GuidedTransitionWizard";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { settingsService } from "@modules/core/api/settingsService";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";

vi.mock("@modules/accounting/api/openingBalanceService", () => ({
  openingBalanceService: {
    listMigrations: vi.fn().mockResolvedValue([]),
    getOpeningDraft: vi.fn().mockResolvedValue(null),
    saveOpeningDraft: vi.fn().mockResolvedValue(true),
    clearOpeningDraft: vi.fn().mockResolvedValue(undefined),
    getReconciliation: vi.fn().mockResolvedValue(null),
    getResidualClassificationSpec: vi.fn().mockResolvedValue([]),
    createMigration: vi.fn(),
    updateMigrationLines: vi.fn(),
    saveMigrationItems: vi.fn(),
    setResidualClassification: vi.fn(),
    validateMigration: vi.fn(),
    approveMigration: vi.fn(),
    postMigration: vi.fn(),
    lockMigration: vi.fn(),
    applyResidual: vi.fn(),
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

const LOCKED_MIGRATION = {
  id: "m-locked",
  company_id: null,
  cutover_date: "2026-01-01",
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
  locked_at: "2026-01-02T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
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
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([] as never);
    vi.mocked(openingBalanceService.getReconciliation).mockResolvedValue(null as never);
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

  it("no longer exposes a start-mode toggle — company type is fixed from settings", async () => {
    renderWizard();
    expect(await screen.findByText("بدء محاسبة شركة جديدة")).toBeInTheDocument();
    expect(screen.queryByText("طريقة بدء المحاسبة")).not.toBeInTheDocument();
  });

  it("ExistingCompany resumes at the locked-completion onboarding once the migration is Locked", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" } as never);
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([LOCKED_MIGRATION as never]);
    vi.mocked(openingBalanceService.getReconciliation).mockResolvedValue({
      all_reconciled: true,
      rows: [],
      opening_control_balance: "0",
      debit_total: "0",
      credit_total: "0",
    } as never);
    const user = userEvent.setup();
    renderWizard();
    expect(await screen.findByText("تم التحويل بنجاح ✓")).toBeInTheDocument();
    expect(screen.getByText("الخطوة التالية: إعداد أول فترة تشغيلية")).toBeInTheDocument();
    expect(screen.getByText("الأرصدة الافتتاحية مُرحّلة إلى دفتر الأستاذ")).toBeInTheDocument();
    // The first-period form stays hidden until [بدء أول فترة تشغيلية] is pressed.
    expect(screen.queryByLabelText(/بداية الفترة/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "بدء أول فترة تشغيلية" }));
    expect(screen.getByLabelText(/بداية الفترة/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء أول فترة تشغيلية" })).toBeEnabled();
  });

  it("ExistingCompany with a Locked migration and an existing fiscal period resumes at ACTIVE completion", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({ accounting_start_mode: "ExistingCompanyMigration" } as never);
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([LOCKED_MIGRATION as never]);
    vi.mocked(fiscalPeriodService.listFiscalPeriods).mockResolvedValue([PERIOD as never]);
    renderWizard();
    expect(await screen.findByText("اكتمل إعداد الشركة ✓")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "الانتقال إلى لوحة التحكم" })).toBeInTheDocument();
    // The opening position summary is an opening control — hidden once locked.
    expect(screen.queryByText("المركز الافتتاحي")).not.toBeInTheDocument();
  });
});
