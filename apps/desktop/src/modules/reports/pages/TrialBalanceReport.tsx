import { useState } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DateRangePicker } from "@widgets/reports";
import { useTrialBalanceReport } from "../hooks/useTrialBalanceReport";
import { TrialBalanceView } from "../components/TrialBalanceView";

export default function TrialBalanceReport() {
  const [filters, setFilters] = useState({
    from_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    to_date: new Date().toISOString().split("T")[0],
  });

  const { loading, reportData } = useTrialBalanceReport(filters);

  return (
    <OperationalTableTemplate
      title="ميزان المراجعة"
      toolbar={
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            from={filters.from_date}
            to={filters.to_date}
            onChange={({ from_date, to_date }) => setFilters(f => ({ ...f, from_date, to_date }))}
          />
        </div>
      }
      tableContent={<TrialBalanceView data={reportData} loading={loading} />}
    />
  );
}
