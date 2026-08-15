import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@modules/core/api/settingsService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import {
  companyTypeOf,
  type CompanyLifecycleSettingsLike,
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