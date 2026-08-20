import { useReportFilters } from "@shared/hooks/useReportFilters";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { useTrialBalanceReport } from "../hooks/useTrialBalanceReport";
import { TrialBalanceView } from "../components/TrialBalanceView";

export default function TrialBalanceReport() {
  const { filters, setFilters } = useReportFilters();
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useTrialBalanceReport(filters);

  return (
    <OperationalTableTemplate
      title="ميزان المراجعة"
      toolbar={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={false}
          refreshing={refreshing}
          onRefresh={() => void loadReportData()}
          lastLoadedAt={lastLoadedAt}
        />
      }
      tableContent={<TrialBalanceView data={reportData} loading={loading} />}
    />
  );
}
