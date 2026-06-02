import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { accountingService } from "@modules/accounting/api/accountingService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import type { MaterialDto } from "@erp/shared-types";
import {
  emptyIncomeStatementData,
  type LoadedIncomeStatementData,
} from "@modules/accounting/lib/incomeStatement";

export function useIncomeStatementReport() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [reportData, setReportData] = useState<LoadedIncomeStatementData>(emptyIncomeStatementData);
  const hasLoadedOnceRef = useRef(false);

  const loadReportData = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [
        salesInvoices,
        purchaseInvoices,
        purchaseReturns,
        salesReturns,
        expenseAccounts,
        materials,
      ] = await Promise.all([
        invoiceService.listInvoicesByType("Sales"),
        invoiceService.listInvoicesByType("Purchase"),
        returnService.listPurchaseReturns(),
        returnService.listSalesReturns(),
        accountingService.getExpenseItems(),
        materialService.listMaterials(),
      ]);

      const movementResults = await Promise.allSettled(
        materials.map(async (material: MaterialDto) => ({
          materialId: material.id,
          movements: await materialService.listMovementsByMaterial(material.id),
        })),
      );

      const ledgerResults = await Promise.allSettled(
        expenseAccounts.map(async (account) => ({
          accountId: account.id,
          ledger: await accountingService.getAccountLedger(account.id),
        })),
      );

      const stockMovementsByMaterial = new Map();
      movementResults.forEach((result) => {
        if (result.status === "fulfilled") {
          stockMovementsByMaterial.set(result.value.materialId, result.value.movements ?? []);
        }
      });

      const expenseLedgers = new Map();
      ledgerResults.forEach((result) => {
        if (result.status === "fulfilled") {
          expenseLedgers.set(result.value.accountId, result.value.ledger);
        }
      });

      setReportData({
        salesInvoices: salesInvoices ?? [],
        purchaseInvoices: purchaseInvoices ?? [],
        purchaseReturns: purchaseReturns ?? [],
        salesReturns: salesReturns ?? [],
        expenseAccounts: expenseAccounts ?? [],
        expenseLedgers,
        stockMovementsByMaterial,
      });

      hasLoadedOnceRef.current = true;
      setLastLoadedAt(new Date());
    } catch (error) {
      console.error(error);
      toast.error("تعذر تحميل بيانات قائمة الدخل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  return {
    loading,
    refreshing,
    lastLoadedAt,
    reportData,
    loadReportData,
  };
}
