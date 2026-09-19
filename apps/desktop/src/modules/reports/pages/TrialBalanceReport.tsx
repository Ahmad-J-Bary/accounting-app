import { useReportFilters } from "@shared/hooks/useReportFilters";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { useTrialBalanceReport } from "../hooks/useTrialBalanceReport";
import { TrialBalanceView } from "../components/TrialBalanceView";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function TrialBalanceReport() {
  const { filters, setFilters } = useReportFilters();
  const { loading, refreshing, lastLoadedAt, reportData, loadReportData } = useTrialBalanceReport(filters);
  const { t } = useLocalization();

  return (
    <OperationalTableTemplate
      title={t("trialBalance.title", { namespace: "reports",  })}
      filterBar={
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
