import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useChartOfAccounts } from "@shared/hooks/queries/useAccountQueries";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { useAccountMovementsReport } from "../hooks/useAccountMovementsReport";
import { AccountMovementView } from "../components/AccountMovementView";
import type { AccountDto } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ReportPageContext } from "@widgets/reports/ReportPageHeader";

function getDescendantIds(accountId: string, accounts: AccountDto[]): string[] {
  const children = accounts.filter(a => a.parent_id === accountId);
  return [accountId, ...children.flatMap(c => getDescendantIds(c.id, accounts))];
}

export default function AccountMovementsReport() {
  const { filters, setFilters, baseCurrency } = useReportFilters();
  const { t, language } = useLocalization();
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
      title={t("accountMovements.title", { namespace: "reports",  })}
      badge={
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-lg border-border bg-card text-xs font-bold">
            <SelectValue placeholder={t("accountMovements.selectAccountPlaceholder", { namespace: "reports",  })} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id} className="font-bold">
                {a.code} - {language === "ar" ? a.name_ar : a.name_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      pageContextInline
      pageContextSide="end"
      pageHeaderSingleRow
      pageContext={
        <ReportPageContext
          filters={filters}
          onFiltersChange={setFilters}
        />
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
