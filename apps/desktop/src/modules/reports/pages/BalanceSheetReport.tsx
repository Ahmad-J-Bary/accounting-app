import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { computeBalanceSheet } from "@modules/reports/lib/balanceSheet";
import { useBalanceSheetReport } from "@modules/reports/hooks/useBalanceSheetReport";
import { useBalanceSheet } from "@shared/hooks/queries/useReportQueries";
import { BalanceSheetView } from "@modules/reports/components/BalanceSheetView";
import { ReportLoadingSkeleton } from "@widgets/reports";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ReportPageContext } from "@widgets/reports/ReportPageHeader";

export default function BalanceSheetReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const { t, language } = useLocalization();
  const {
    filters,
    setFilters,
    selectedCurrency,
    setSelectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );

  const { isLoading: bsLoading, data: bsData } = useBalanceSheet();
  const { loading: enrichmentLoading, reportData } = useBalanceSheetReport(filters);

  const loading = bsLoading || enrichmentLoading;

  const computed = useMemo(() => {
    if (!bsData) return null;

    // Convert backend BalanceSheetDto to the ledgerTotals format computeBalanceSheet expects
    const backendLedgerTotals = new Map<string, { debit: number; credit: number }>();
    const allBackendLines = [...bsData.assets, ...bsData.liabilities, ...bsData.equity];
    for (const line of allBackendLines) {
      const net = parseFloat(line.amount) || 0;
      if (net >= 0) {
        backendLedgerTotals.set(line.account_id, { debit: net, credit: 0 });
      } else {
        backendLedgerTotals.set(line.account_id, { debit: 0, credit: -net });
      }
    }

    // Use backend net_profit if available; totalDrawings is already included
    // in total_equity (DRAWINGS account is Equity type with negative balance)
    const netProfit = bsData.net_profit ? parseFloat(bsData.net_profit) || 0 : 0;

    return computeBalanceSheet(
      reportData.accounts,
      { netProfit, totalDrawings: 0 },
      backendLedgerTotals,
      { closingInventory: reportData.closingInventory },
      language,
      t,
    );
  }, [bsData, reportData.accounts, reportData.closingInventory, language, t]);

  const formatValue = useCallback(
    (value: number) =>
      formatAmount(value, {
        currencyCode: selectedCurrency || baseCurrency?.code,
        withCode: true,
      }),
    [formatAmount, selectedCurrency, baseCurrency],
  );

  return (
    <OperationalTableTemplate
      title={t("balanceSheet.title", { namespace: "reports",  })}
      pageContextInline
      pageContextSide="end"
      pageHeaderSingleRow
      pageContext={
        <ReportPageContext
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={hasMultipleCurrencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          currencies={currencies}
          baseCurrencyCode={baseCurrency?.code}
        />
      }
      tableContent={
        loading ? (
          <ReportLoadingSkeleton />
        ) : computed ? (
          <BalanceSheetView
            computed={computed}
            filters={filters}
            formatValue={formatValue}
          />
        ) : null
      }
    />
  );
}
