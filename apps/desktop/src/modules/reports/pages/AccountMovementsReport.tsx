import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useChartOfAccounts } from "@shared/hooks/queries/useAccountQueries";
import { DateRangePicker } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { useAccountMovementsReport } from "../hooks/useAccountMovementsReport";
import { AccountMovementView } from "../components/AccountMovementView";
import type { AccountDto } from "@erp/shared-types";

function getDescendantIds(accountId: string, accounts: AccountDto[]): string[] {
  const children = accounts.filter(a => a.parent_id === accountId);
  return [accountId, ...children.flatMap(c => getDescendantIds(c.id, accounts))];
}

export default function AccountMovementsReport() {
  const { filters, setFilters, baseCurrency } = useReportFilters();
  const [searchParams] = useSearchParams();
  const { data: accounts = [] } = useChartOfAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('accountId') || '');
  const [search, setSearch] = useState("");

  const accountIds = useMemo(() => {
    if (!selectedAccountId) return undefined;
    return getDescendantIds(selectedAccountId, accounts);
  }, [selectedAccountId, accounts]);

  const { loading, reportData } = useAccountMovementsReport(accountIds, filters);

  const symbol = baseCurrency?.symbol || baseCurrency?.code || "";

  return (
    <OperationalTableTemplate
      title="حركة الحساب"
      badge={
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-lg border-slate-200 bg-white text-xs font-bold">
            <SelectValue placeholder="اختر الحساب..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id} className="font-bold">
                {a.code} - {a.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
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
      tableContent={
        <AccountMovementView
          data={reportData}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          symbol={symbol}
        />
      }
    />
  );
}
