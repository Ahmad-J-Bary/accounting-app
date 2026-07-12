import { useQuery } from "@tanstack/react-query";
import { accountingService } from "@modules/accounting/api/accountingService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { AccountDto, AccountLedgerDto } from "@erp/shared-types";

export function useChartOfAccounts() {
  return useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
  });
}

export function useAccountLedger(accountId: string | undefined) {
  return useQuery<AccountLedgerDto>({
    queryKey: QUERY_KEYS.accountLedger(accountId ?? ""),
    queryFn: () => accountingService.getAccountLedger(accountId!),
    enabled: !!accountId,
  });
}

export function useExpenseItems() {
  return useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.expenseItems,
    queryFn: () => accountingService.getExpenseItems(),
  });
}
