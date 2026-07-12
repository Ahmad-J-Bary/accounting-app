import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import {
  computeIncomeStatement,
  emptyIncomeStatementData,
  type IncomeStatementFilters,
  type LoadedIncomeStatementData,
} from "@modules/accounting/lib/incomeStatement";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import type { AccountDto, AccountLedgerDto, MaterialDto, StockMovementDetailDto } from "@erp/shared-types";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import { QUERY_KEYS } from "@shared/hooks/queryClient";

export type LoadedBalanceSheetData = {
  accounts: AccountDto[];
  netProfit: number;
  totalDrawings: number;
  ledgerTotals: Map<string, { debit: number; credit: number }>;
  closingInventory: number;
};

const emptyData: LoadedBalanceSheetData = {
  accounts: [],
  netProfit: 0,
  totalDrawings: 0,
  ledgerTotals: new Map(),
  closingInventory: 0,
};

export async function computeLedgerTotals(
  accounts: AccountDto[],
  entries: { description?: string; journal_type?: string; source_id?: string; lines: Array<{ account_id: string; debit_base?: string; debit?: string; credit_base?: string; credit?: string }> }[],
  incomeStatementResult: { netProfit: number; closingInventory: number },
  purchaseInvoices: Array<{ status?: string; extra_costs?: string }>,
): Promise<Omit<LoadedBalanceSheetData, "accounts" | "netProfit" | "closingInventory">> {
  let totalDrawings = 0;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const ledgerTotals = new Map<string, { debit: number; credit: number }>();

  for (const account of accounts) {
    const openingBalance = parseFloat(account.opening_balance || "0");
    if (openingBalance !== 0) {
      const existing = ledgerTotals.get(account.id) || { debit: 0, credit: 0 };
      if (["Liabilities", "Equity", "Revenue"].includes(account.account_type)) {
        existing.credit += Math.abs(openingBalance);
      } else {
        existing.debit += Math.abs(openingBalance);
      }
      ledgerTotals.set(account.id, existing);
    }
  }

  const partnerAccounts = accounts.filter(
    (a) => a.code !== "51" && a.code.startsWith("51") && ["Liabilities", "Equity", "Revenue"].includes(a.account_type),
  );
  const totalPartnerCapital = partnerAccounts.reduce(
    (sum, a) => sum + Math.abs(parseFloat(a.opening_balance || "0")),
    0,
  );

  let capitalCreditsFromInKind = 0;
  for (const entry of entries) {
    const desc = entry.description || "";
    const isMaterialOpening = entry.journal_type === "MaterialOpeningBalance" || desc.includes("بضاعة أول المدة");
    const isFixedAssetOpening = desc.includes("إضافة أصل سابق") || desc.includes("رصيد افتتاحي للأصول الثابتة");

    if (!isMaterialOpening && !isFixedAssetOpening) continue;

    for (const line of entry.lines) {
      const account = accountMap.get(line.account_id);
      if (account?.code === "51" || account?.code?.startsWith("51")) {
        capitalCreditsFromInKind += parseFloat(line.credit_base || line.credit || "0");
      }
    }
  }

  if (capitalCreditsFromInKind > 0) {
    if (partnerAccounts.length > 0 && totalPartnerCapital > 0) {
      for (const partnerAcc of partnerAccounts) {
        const ratio = Math.abs(parseFloat(partnerAcc.opening_balance || "0")) / totalPartnerCapital;
        const share = capitalCreditsFromInKind * ratio;
        const cur = ledgerTotals.get(partnerAcc.id) || { debit: 0, credit: 0 };
        cur.credit += share;
        ledgerTotals.set(partnerAcc.id, cur);
      }
    } else {
      const capitalParent = accounts.find((a) => a.code === "51");
      if (capitalParent) {
        const cur = ledgerTotals.get(capitalParent.id) || { debit: 0, credit: 0 };
        cur.credit += capitalCreditsFromInKind;
        ledgerTotals.set(capitalParent.id, cur);
      }
    }
  }

  for (const entry of entries) {
    const desc = entry.description || "";
    const isMaterialOpening = entry.journal_type === "MaterialOpeningBalance" || desc.includes("بضاعة أول المدة");
    const isFixedAssetOpening = desc.includes("إضافة أصل سابق") || desc.includes("رصيد افتتاحي للأصول الثابتة");

    for (const line of entry.lines) {
      const amt = parseFloat(line.debit_base || line.debit || "0") - parseFloat(line.credit_base || line.credit || "0");
      if (line.account_id === SYSTEM_ACCOUNT_IDS.DRAWINGS) {
        totalDrawings += Math.abs(amt);
      }

      const account = accountMap.get(line.account_id);

      if ((isMaterialOpening || isFixedAssetOpening) && (account?.code === "51" || account?.code?.startsWith("51"))) {
        continue;
      }

      const isConsolidatedCapitalEntry = entry.source_id === "consolidated_capital";
      if (isConsolidatedCapitalEntry && account?.code !== "122") {
        continue;
      }

      const cur = ledgerTotals.get(line.account_id) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(line.debit_base || line.debit || "0");
      cur.credit += parseFloat(line.credit_base || line.credit || "0");
      ledgerTotals.set(line.account_id, cur);
    }
  }

  let netPurchaseCost = 0;
  for (const inv of purchaseInvoices) {
    if (inv.status !== "Posted" && inv.status !== "Paid") continue;
    netPurchaseCost += parseFloat(inv.extra_costs || "0");
  }

  for (const account of accounts) {
    if (account.name_ar === "تكاليف إضافية على المشتريات") {
      const debit = Math.abs(netPurchaseCost);
      const credit = Math.abs(netPurchaseCost);
      ledgerTotals.set(account.id, { debit, credit });
    }
  }

  return { ledgerTotals, totalDrawings };
}

export function useBalanceSheetReport(filters: IncomeStatementFilters) {
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();

  const fetchReportData = useCallback(async (): Promise<LoadedBalanceSheetData> => {
    const [
      accounts,
      entries,
      salesInvoices,
      purchaseInvoices,
      purchaseReturns,
      salesReturns,
      expenseAccounts,
      materials,
    ] = await Promise.all([
      accountingService.getChartOfAccounts(),
      journalEntryService.listJournalEntries({
        from_date: filters.from_date,
        to_date: filters.to_date,
      }),
      invoiceService.listInvoicesByType("Sales"),
      invoiceService.listInvoicesByType("Purchase"),
      returnService.listPurchaseReturns(),
      returnService.listSalesReturns(),
      accountingService.getExpenseItems(),
      materialService.listMaterials(),
    ]);

    const { stockMovementsByMaterial, expenseLedgers } = await loadMaterialExpenseLedgers(materials, expenseAccounts);

    const incomeStatementData: LoadedIncomeStatementData = {
      ...emptyIncomeStatementData,
      salesInvoices,
      purchaseInvoices,
      purchaseReturns,
      salesReturns,
      expenseAccounts,
      expenseLedgers,
      stockMovementsByMaterial,
      materials,
      accounts,
      entries,
    };

    const incomeStatementResult = computeIncomeStatement(filters, incomeStatementData);

    const { ledgerTotals, totalDrawings } = await computeLedgerTotals(
      accounts,
      entries,
      incomeStatementResult,
      purchaseInvoices,
    );

    return {
      accounts,
      netProfit: incomeStatementResult.netProfit,
      totalDrawings,
      ledgerTotals,
      closingInventory: incomeStatementResult.closingInventory,
    };
  }, [filters, loadMaterialExpenseLedgers]);

  const { data: reportData, isLoading, isFetching, refetch } = useQuery({
    queryKey: QUERY_KEYS.balanceSheet,
    queryFn: fetchReportData,
    initialData: emptyData,
  });

  const loadReportData = useCallback(async () => {
    try {
      await refetch();
      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات الميزانية العمومية");
    }
  }, [refetch]);

  const refreshing = isFetching && hasLoadedOnceRef.current;
  const loading = isLoading && !hasLoadedOnceRef.current;

  return {
    loading,
    refreshing,
    lastLoadedAt,
    reportData: reportData ?? emptyData,
    loadReportData,
  };
}
