import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidePanelSettingsProvider } from "@app/providers/SidePanelSettingsProvider";
import { SidebarLayoutProvider } from "@app/providers/SidebarLayoutProvider";
import ProfitDistributionPage from "@modules/accounting/profit-distribution/pages/ProfitDistributionPage";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";

vi.mock("@modules/accounting/api/openingBalanceService", () => ({
  openingBalanceService: {
    listMigrations: vi.fn().mockResolvedValue([]),
    allocateNetProfit: vi.fn(),
    previewProfitDistribution: vi.fn(),
    computeNetProfit: vi.fn(),
    getOpeningDraft: vi.fn().mockResolvedValue(null),
    clearOpeningDraft: vi.fn(),
    saveOpeningDraft: vi.fn(),
    getReconciliation: vi.fn().mockResolvedValue(null),
    getResidualClassificationSpec: vi.fn().mockResolvedValue([]),
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
    getDistributableProfit: vi.fn().mockResolvedValue({
      period_id: null,
      current_period_profit: "0",
      retained_earnings_balance: "45",
      allocated_to_date: "0",
      distributable: "45",
    }),
  },
  periodWindowFromDateInput: (start: string, end: string) => ({
    start_date: new Date(`${start}T00:00:00Z`).toISOString(),
    end_date: new Date(`${end}T23:59:59Z`).toISOString(),
  }),
}));

const LOCKED = {
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

const PREVIEW_45 = {
  entry_number: "",
  net_profit: "45",
  allocated_total: "45",
  shares: [
    { partner_id: "p1", partner_name: "شريك أ", capital: "100", ratio_percent: "60", share: "27" },
    { partner_id: "p2", partner_name: "شريك ب", capital: "50", ratio_percent: "40", share: "18" },
  ],
  posted: false,
};

const PREVIEW_20 = {
  entry_number: "",
  net_profit: "20",
  allocated_total: "20",
  shares: [
    { partner_id: "p1", partner_name: "شريك أ", capital: "100", ratio_percent: "60", share: "12" },
    { partner_id: "p2", partner_name: "شريك ب", capital: "50", ratio_percent: "40", share: "8" },
  ],
  posted: false,
};

const POSTED_20 = {
  entry_number: "JE-20",
  net_profit: "20",
  allocated_total: "20",
  shares: [
    { partner_id: "p1", partner_name: "شريك أ", capital: "100", ratio_percent: "60", share: "12" },
    { partner_id: "p2", partner_name: "شريك ب", capital: "50", ratio_percent: "40", share: "8" },
  ],
  posted: true,
};

function renderPage(initialPath = "/accounting/profit-distribution") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={qc}>
        <SidePanelSettingsProvider>
          <SidebarLayoutProvider>
            <Routes>
              <Route path="/accounting/profit-distribution" element={<ProfitDistributionPage />} />
            </Routes>
          </SidebarLayoutProvider>
        </SidePanelSettingsProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ProfitDistributionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fiscalPeriodService.getDistributableProfit).mockResolvedValue({
      period_id: null,
      current_period_profit: "0",
      retained_earnings_balance: "45",
      allocated_to_date: "0",
      distributable: "45",
    });
    vi.mocked(openingBalanceService.listMigrations).mockResolvedValue([LOCKED as never]);
  });

  it("renders heading, source selector, and asks for a migration before showing the pool", async () => {
    renderPage();
    expect(screen.getByText("توزيع الأرباح")).toBeInTheDocument();
    expect(screen.getByText("مصدر الأرباح")).toBeInTheDocument();
    expect(screen.getByText("الترحيل الافتتاحي")).toBeInTheDocument();
    await waitFor(() => {
      expect(openingBalanceService.listMigrations).toHaveBeenCalled();
    });
    expect(await screen.findByText("اختر المصدر والترحيل لعرض الأرصدة المتاحة للتوزيع.")).toBeInTheDocument();
  });

  it("preselects the opening migration source from the query string and shows the pool", async () => {
    renderPage("/accounting/profit-distribution?source=opening&migration=m-locked");
    expect(await screen.findByText(/ترحيل بتاريخ/)).toBeInTheDocument();
    expect(await screen.findByText("تأكيد التوزيع")).toBeInTheDocument();
    expect((await screen.findAllByText("45.00")).length).toBeGreaterThan(0);
  });

  it("skips preview (no journal) and posts a full distribution of the available 45 via the same shares", async () => {
    vi.mocked(openingBalanceService.previewProfitDistribution).mockResolvedValue(PREVIEW_45 as never);
    vi.mocked(openingBalanceService.allocateNetProfit).mockResolvedValue({
      ...PREVIEW_45,
      entry_number: "JE-45",
      posted: true,
    } as never);
    renderPage("/accounting/profit-distribution?source=opening&migration=m-locked");
    await screen.findByText("تأكيد التوزيع");
    // [توزيع كامل المتبقي] pre-fills the amount with the available pool
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "توزيع كامل المتبقي" }));
    expect(await screen.findByText(/معاينة التوزيع/)).toBeInTheDocument();
    expect(screen.getByText("شريك أ")).toBeInTheDocument();
    expect(screen.getByText("شريك ب")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تأكيد التوزيع" }));
    await waitFor(() => {
      expect(openingBalanceService.allocateNetProfit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { OpeningMigration: { migration_id: "m-locked" } },
          net_profit: "45",
          idempotency_key: expect.any(String),
        }),
      );
    });
    expect(await screen.findByText(/تم الترحيل — قيد رقم JE-45/)).toBeInTheDocument();
  });

  it("previews a PARTIAL distribution of 20 → 12/8 without posting, then posts it", async () => {
    vi.mocked(openingBalanceService.previewProfitDistribution).mockResolvedValue(PREVIEW_20 as never);
    vi.mocked(openingBalanceService.allocateNetProfit).mockResolvedValue(POSTED_20 as never);
    const user = userEvent.setup();
    renderPage("/accounting/profit-distribution?source=opening&migration=m-locked");
    await screen.findByText("تأكيد التوزيع");
    await user.type(screen.getByLabelText("مبلغ التوزيع"), "20");
    expect(await screen.findByText(/معاينة التوزيع/)).toBeInTheDocument();
    const posted = vi.mocked(openingBalanceService.previewProfitDistribution);
    expect(posted).toHaveBeenCalledWith({ source: { OpeningMigration: { migration_id: "m-locked" } }, net_profit: "20" });
    await user.click(screen.getByRole("button", { name: "تأكيد التوزيع" }));
    await waitFor(() => {
      expect(openingBalanceService.allocateNetProfit).toHaveBeenCalledWith({
        source: { OpeningMigration: { migration_id: "m-locked" } },
        net_profit: "20",
        idempotency_key: expect.any(String),
      });
    });
    expect(await screen.findByText(/تم الترحيل — قيد رقم JE-20/)).toBeInTheDocument();
  });

  it("blocks over-distribution in the UI showing the difference and never calls the engine", async () => {
    const user = userEvent.setup();
    renderPage("/accounting/profit-distribution?source=opening&migration=m-locked");
    await screen.findByText("تأكيد التوزيع");
    // Clear the "توزيع كامل" prefill is manual — type beyond the 45 pool
    const input = screen.getByLabelText("مبلغ التوزيع");
    await user.clear(input);
    await user.type(input, "50");
    expect(await screen.findByText(/50.00.*يتجاوز الأرباح المتاحة للتوزيع بمقدار 5.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأكيد التوزيع" })).toBeDisabled();
    expect(openingBalanceService.previewProfitDistribution).not.toHaveBeenCalledWith(
      expect.objectContaining({ net_profit: "50" }),
    );
    expect(openingBalanceService.allocateNetProfit).not.toHaveBeenCalled();
  });

  it("zero amount creates no journal and disables the confirm button", async () => {
    const user = userEvent.setup();
    renderPage("/accounting/profit-distribution?source=opening&migration=m-locked");
    await screen.findByText("تأكيد التوزيع");
    const input = screen.getByLabelText("مبلغ التوزيع");
    await user.clear(input);
    await user.type(input, "0");
    expect(await screen.findByText(/مبلغ صفر لا يُنشئ قيداً/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تأكيد التوزيع" })).toBeDisabled();
    expect(openingBalanceService.previewProfitDistribution).not.toHaveBeenCalled();
    expect(openingBalanceService.allocateNetProfit).not.toHaveBeenCalled();
  });

  it("keeps the closed-period source disabled for this phase", async () => {
    renderPage("/accounting/profit-distribution");
    const user = userEvent.setup();
    const sourceCombo = screen.getAllByRole("combobox").find((el) =>
      (el.textContent ?? "").includes("الأرباح المبقاة الافتتاحية"),
    );
    expect(sourceCombo).toBeDefined();
    const openSelect = (target: Element) => {
      fireEvent.pointerDown(target, { pointerId: 1, pointerType: "mouse", isPrimary: true });
      fireEvent.pointerUp(target, { pointerId: 1, pointerType: "mouse", isPrimary: true });
      fireEvent.click(target);
    };
openSelect(sourceCombo!);
    const closed = (await screen.findAllByRole("option", {}, { timeout: 2000 })).find((el) =>
      (el.textContent ?? "").includes("فترة مالية مغلقة"),
    );
    expect(closed).toBeDefined();
    expect(closed).toHaveAttribute("data-disabled");
  });
});