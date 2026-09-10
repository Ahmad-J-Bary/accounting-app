import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTrialBalance } from "./useReportQueries";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountDto, TrialBalanceDto } from "@erp/shared-types";

vi.mock("@modules/accounting/api/accountingService", () => ({
  accountingService: {
    getChartOfAccounts: vi.fn(),
    getTrialBalance: vi.fn(),
  },
}));

function acc(overrides: Partial<AccountDto> & { id: string; code: string; name_ar: string }): AccountDto {
  return {
    name_en: "",
    account_type: "Assets",
    parent_id: null,
    category: "Detail",
    level: 0,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    ...overrides,
  };
}

const accounts: AccountDto[] = [
  acc({ id: "cash1", code: "1910", name_ar: "النقد والصندوق" }),
  acc({ id: "fa1", code: "1114", name_ar: "الأصول الثابتة", purpose: "fixed_asset" }),
  acc({ id: "cap1", code: "3910", name_ar: "رأس المال", account_type: "Equity" }),
];

const trialBalanceResponse: TrialBalanceDto = {
  lines: [
    { account_id: "cash1", account_code: "1910", account_name: "النقد والصندوق", account_type: "Assets", debit_total: "25", credit_total: "0", balance: "25", opening_debit: "25", opening_credit: "0", period_debit: "0", period_credit: "0" },
    { account_id: "fa1", account_code: "1114", account_name: "الأصول الثابتة", account_type: "Assets", debit_total: "200", credit_total: "0", balance: "200", opening_debit: "200", opening_credit: "0", period_debit: "0", period_credit: "0" },
    { account_id: "cap1", account_code: "3910", account_name: "رأس المال", account_type: "Equity", debit_total: "0", credit_total: "225", balance: "-225", opening_debit: "0", opening_credit: "225", period_debit: "0", period_credit: "0" },
  ],
  total_debit: "225",
  total_credit: "225",
  generated_at: "2026-01-01T00:00:00Z",
  total_opening_debit: "225",
  total_opening_credit: "225",
  total_period_debit: "0",
  total_period_credit: "0",
};

describe("useTrialBalance — backend aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches trial balance from backend with date filters and returns accounts + trialBalance", async () => {
    vi.mocked(accountingService.getChartOfAccounts).mockResolvedValue(accounts);
    vi.mocked(accountingService.getTrialBalance).mockResolvedValue(trialBalanceResponse);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useTrialBalance({ from_date: "2026-02-01", to_date: "2026-08-16" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(accountingService.getTrialBalance).toHaveBeenCalledTimes(1);
    expect(accountingService.getTrialBalance).toHaveBeenCalledWith("2026-02-01", "2026-08-16");

    const { accounts: accts, trialBalance } = result.current.data!;
    expect(accts).toHaveLength(3);
    expect(trialBalance.lines).toHaveLength(3);
    expect(trialBalance.total_debit).toBe("225");
    expect(trialBalance.total_credit).toBe("225");
    expect(trialBalance.lines.find(l => l.account_id === "fa1")?.opening_debit).toBe("200");
    expect(trialBalance.lines.find(l => l.account_id === "cap1")?.opening_credit).toBe("225");
  });
});