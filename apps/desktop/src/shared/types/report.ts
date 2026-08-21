export type { ReportFilters } from "@shared/types/filters";
import type { ReportFilters } from "@shared/types/filters";

export type ReportConfig<TData, TFilters = ReportFilters> = {
  queryKey: readonly unknown[];
  emptyData: TData;
  initialData?: TData;
  fetchData: (filters?: TFilters) => Promise<TData>;
  computeData?: (data: TData, filters?: TFilters) => TData;
  errorMessage?: string;
};

export type ReportState<TData> = {
  loading: boolean;
  refreshing: boolean;
  lastLoadedAt: Date | null;
  reportData: TData;
  loadReportData: () => Promise<void>;
  error?: boolean;
};

export type ReportFilterBarProps = {
  filters: ReportFilters;
  onFiltersChange: (filters: Partial<ReportFilters>) => void;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  selectedCurrencyLabel?: string;
  lastLoadedAt?: Date | null;
};
