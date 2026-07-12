import { useCallback } from "react";
import { materialService } from "@modules/inventory/api/materialService";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountDto, AccountLedgerDto, MaterialDto, StockMovementDetailDto } from "@erp/shared-types";

export interface MaterialExpenseLedgers {
  stockMovementsByMaterial: Map<string, StockMovementDetailDto[]>;
  expenseLedgers: Map<string, AccountLedgerDto>;
}

/**
 * Fetches stock movements for all materials and ledgers for the given expense
 * accounts. Used by all report hooks to build the income statement inputs.
 */
export function useMaterialExpenseLedgers() {
  const load = useCallback(
    async (
      materials: MaterialDto[],
      expenseAccounts: AccountDto[],
    ): Promise<MaterialExpenseLedgers> => {
      const movementResults = await Promise.allSettled(
        materials.map(async (material) => ({
          materialId: material.id,
          movements: await materialService.listMovementsByMaterial(material.id),
        })),
      );

      const stockMovementsByMaterial = new Map<string, StockMovementDetailDto[]>();
      movementResults.forEach((result) => {
        if (result.status === "fulfilled") {
          stockMovementsByMaterial.set(result.value.materialId, result.value.movements ?? []);
        }
      });

      const ledgerResults = await Promise.allSettled(
        expenseAccounts.map(async (account) => ({
          accountId: account.id,
          ledger: await accountingService.getAccountLedger(account.id),
        })),
      );

      const expenseLedgers = new Map<string, AccountLedgerDto>();
      ledgerResults.forEach((result) => {
        if (result.status === "fulfilled") {
          expenseLedgers.set(result.value.accountId, result.value.ledger);
        }
      });

      return { stockMovementsByMaterial, expenseLedgers };
    },
    [],
  );

  return { loadMaterialExpenseLedgers: load };
}
