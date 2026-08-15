import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@modules/core/api/settingsService";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import {
  companyTypeOf,
  companyCapabilitiesOf,
  deriveCompanyInitState,
  type CompanyLifecycleSettingsLike,
  type CompanyCapabilities,
  type CompanyInitState,
} from "@modules/opening-balance/lib/company-lifecycle";

// Persisted company type read by the shell (sidebar/navbar) to gate the
// opening-balance entry. Unknown while loading — consumers should default to
// EXISTING so nothing flashes as "new company" during startup.
export function useCompanyTypeSettings(): CompanyLifecycleSettingsLike | undefined {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: () => settingsService.getSettings(),
  });
  return data;
}

export function useCompanyType(): ReturnType<typeof companyTypeOf> {
  return companyTypeOf(useCompanyTypeSettings());
}

export function useCompanyCapabilities(): CompanyCapabilities {
  return companyCapabilitiesOf(useCompanyTypeSettings());
}

export interface CompanyInitStateResult {
  initState: CompanyInitState;
  // True once settings + migrations + fiscal periods have all resolved; consumers
  // should fall back to the permissive "ACTIVE" state until then so nothing
  // flashes as blocked during startup.
  isReady: boolean;
}

// Derived (never stored) initialization state of the company lifecycle: company
// type plus opening-migration progress plus first-fiscal-period existence.
export function useCompanyInitState(): CompanyInitStateResult {
  const settings = useCompanyTypeSettings();
  const { data: migrations, isSuccess: migrationsLoaded } = useQuery({
    queryKey: QUERY_KEYS.openingBalanceMigrations,
    queryFn: () => openingBalanceService.listMigrations(),
  });
  const { data: periods, isSuccess: periodsLoaded } = useQuery({
    queryKey: QUERY_KEYS.fiscalPeriods,
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  return {
    initState: deriveCompanyInitState({ settings, migrations, periods }),
    isReady: Boolean(settings) && migrationsLoaded && periodsLoaded,
  };
}