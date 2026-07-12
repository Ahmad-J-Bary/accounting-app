export type ReportFilters = {
  from_date: string;
  to_date: string;
};

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

export type IncomeStatementFilters = ReportFilters;

export type BalanceSheetFilters = ReportFilters;

export type PartnerProfitShareFilters = ReportFilters;

export type TrialBalanceFilters = ReportFilters;
