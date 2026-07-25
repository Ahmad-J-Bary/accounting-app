import { useReportFilters } from "@shared/hooks/useReportFilters";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DateRangePicker } from "@widgets/reports";
import { useTrialBalanceReport } from "../hooks/useTrialBalanceReport";
import { TrialBalanceView } from "../components/TrialBalanceView";

export default function TrialBalanceReport() {
  const { filters, setFilters } = useReportFilters();
  const { loading, reportData } = useTrialBalanceReport(filters);

  return (
    <OperationalTableTemplate
      title="ميزان المراجعة"
      toolbar={
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            from={filters.from_date}
            to={filters.to_date}
            onFromChange={(v) => setFilters({ from_date: v })}
            onToChange={(v) => setFilters({ to_date: v })}
          />
        </div>
      }
      tableContent={<TrialBalanceView data={reportData} loading={loading} />}
    />
  );
}
