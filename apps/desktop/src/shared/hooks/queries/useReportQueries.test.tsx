import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTrialBalance } from "./useReportQueries";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountDto, JournalEntryDto } from "@erp/shared-types";

vi.mock("@modules/accounting/api/journalEntryService", () => ({
  journalEntryService: {
    listPostedJournalEntries: vi.fn(),
    listJournalEntries: vi.fn(),
  },
}));

vi.mock("@modules/accounting/api/accountingService", () => ({
  accountingService: {
    getChartOfAccounts: vi.fn(),
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

function line(account_id: string, debit: string, credit: string): JournalEntryDto["lines"][number] {
  return {
    account_id,
    currency: "S",
    fx_rate: "1",
    debit,
    credit,
    debit_base: debit,
    credit_base: credit,
    description: "",
  };
}

const accounts: AccountDto[] = [
  acc({ id: "cash1", code: "1910", name_ar: "النقد والصندوق" }),
  acc({ id: "fa1", code: "1114", name_ar: "الأصول الثابتة", purpose: "fixed_asset" }),
  acc({ id: "cap1", code: "3910", name_ar: "رأس المال", account_type: "Equity" }),
];

const opening: JournalEntryDto = {
  id: "op1",
  entry_number: "op1",
  journal_type: "AccountOpeningBalance",
  journal_type_display: "",
  lines: [
    line("cash1", "25", "0"),
    line("fa1", "200", "0"),
    line("cap1", "0", "225"),
  ],
  entry_date: "2026-01-01",
  description: "قيد ترحيل رصيد افتتاح الشركة",
  status: "Posted",
  total_base_debit: "225",
  total_base_credit: "225",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useTrialBalance — authoritative full posted GL feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the full posted feed (no date args) and partitions by the requested range client-side", async () => {
    vi.mocked(journalEntryService.listPostedJournalEntries).mockResolvedValue([opening]);
    vi.mocked(accountingService.getChartOfAccounts).mockResolvedValue(accounts);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useTrialBalance({ from_date: "2026-02-01", to_date: "2026-08-16" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(journalEntryService.listPostedJournalEntries).toHaveBeenCalledTimes(1);
    expect(journalEntryService.listPostedJournalEntries).toHaveBeenCalledWith();

    const ledgerTotals = result.current.data!.ledgerTotals;
    expect(ledgerTotals.get("fa1")?.openingDebit).toBe(200);
    expect(ledgerTotals.get("cash1")?.openingDebit).toBe(25);
    expect(ledgerTotals.get("cap1")?.openingCredit).toBe(225);
    expect(ledgerTotals.get("fa1")?.periodDebit).toBe(0);
    expect(ledgerTotals.get("cap1")?.periodCredit).toBe(0);
  });
});