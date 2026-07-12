import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@modules/core/api/settingsService";
import { currencyService } from "@modules/core/api/currencyService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import type { CompanySettings, CurrencyContextDto } from "@erp/shared-types";

export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: QUERY_KEYS.settings,
    queryFn: () => settingsService.getSettings(),
  });
}

export function useCurrencyContext() {
  return useQuery<CurrencyContextDto>({
    queryKey: QUERY_KEYS.currencyContext,
    queryFn: () => currencyService.getCurrencyContext(),
  });
}
