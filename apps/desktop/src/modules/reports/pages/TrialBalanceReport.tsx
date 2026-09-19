import { useReportFilters } from "@shared/hooks/useReportFilters";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useTrialBalanceReport } from "../hooks/useTrialBalanceReport";
import { TrialBalanceView } from "../components/TrialBalanceView";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ReportPageContext } from "@widgets/reports/ReportPageHeader";

export default function TrialBalanceReport() {
  const { filters, setFilters } = useReportFilters();
  const { loading, reportData } = useTrialBalanceReport(filters);
  const { t } = useLocalization();

  return (
    <OperationalTableTemplate
      title={t("trialBalance.title", { namespace: "reports",  })}
      pageContextInline
      pageContextSide="end"
      pageHeaderSingleRow
      pageContext={
        <ReportPageContext
          filters={filters}
          onFiltersChange={setFilters}
        />
      }
      tableContent={<TrialBalanceView data={reportData} loading={loading} />}
    />
  );
}
