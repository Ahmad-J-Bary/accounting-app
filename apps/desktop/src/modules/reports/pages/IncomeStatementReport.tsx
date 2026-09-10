import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { useIncomeStatement } from "@shared/hooks/queries/useReportQueries";
import { IncomeStatementView } from "@modules/reports/components/IncomeStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton } from "@widgets/reports";
import type { IncomeStatementComputed, IncomeStatementSection, IncomeStatementRow } from "@modules/reports/lib/incomeStatement";

export default function IncomeStatementReport() {
  const { baseCurrency, currencies, formatAmount, hasMultipleCurrencies } = useCurrencyContext();
  const {
    filters,
    setFilters,
    selectedCurrency,
    setSelectedCurrency,
  } = useReportFilters(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    new Date().toISOString().split("T")[0]
  );

  const { isLoading, isRefetching, data: backendData, dataUpdatedAt, refetch } = useIncomeStatement({
    from_date: filters.from_date,
    to_date: filters.to_date,
  });

  const lastLoadedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const computed: IncomeStatementComputed | null = useMemo(() => {
    if (!backendData) return null;

    const totalRevenue = parseFloat(backendData.total_revenue) || 0;
    const totalExpenses = parseFloat(backendData.total_expenses) || 0;
    const netProfit = parseFloat(backendData.net_profit) || 0;

    const revenueRows: IncomeStatementRow[] = backendData.revenue_lines.map((line) => ({
      label: `${line.account_code || ""} ${line.account_name}`.trim(),
      value: parseFloat(line.amount) || 0,
    }));

    const expenseRows: IncomeStatementRow[] = backendData.expense_lines.map((line) => ({
      label: `${line.account_code || ""} ${line.account_name}`.trim(),
      value: parseFloat(line.amount) || 0,
    }));

    const sections: IncomeStatementSection[] = [
      {
        id: "revenues",
        title: "الإيرادات",
        totalLabel: "إجمالي الإيرادات",
        totalValue: totalRevenue,
        rows: revenueRows,
      },
      {
        id: "liabilities",
        title: "التكاليف والمصروفات",
        totalLabel: "إجمالي التكاليف",
        totalValue: totalExpenses,
        rows: expenseRows,
      },
      {
        id: "profit-loss",
        title: "صافي الربح",
        totalLabel: "صافي الربح",
        totalValue: netProfit,
        rows: [
          { label: "الإيرادات", value: totalRevenue },
          { label: "التكاليف والمصروفات", value: totalExpenses },
        ],
      },
    ];

    return {
      salesTotal: totalRevenue,
      purchaseTotal: totalExpenses,
      purchaseReturnsTotal: 0,
      salesReturnsTotal: 0,
      discountsEarned: 0,
      discountsGranted: 0,
      openingInventory: 0,
      closingInventory: 0,
      totalExpenses,
      totalRevenue,
      totalLiabilities: totalExpenses,
      grossProfit: 0,
      netProfit,
      salesCount: backendData.revenue_lines.length,
      purchaseCount: backendData.expense_lines.length,
      expenseAccountsCount: backendData.expense_lines.length,
      expenseRows,
      sections,
    };
  }, [backendData]);

  const formatValue = useCallback(
    (value: number) =>
      formatAmount(value, {
        currencyCode: selectedCurrency || baseCurrency?.code,
        withCode: true,
      }),
    [formatAmount, selectedCurrency, baseCurrency],
  );

  const selectedCurrencyLabel = useMemo(() => {
    const activeCurrency = currencies.find((currency) => currency.code === (selectedCurrency || baseCurrency?.code));
    return activeCurrency
      ? `${activeCurrency.name} (${activeCurrency.symbol || activeCurrency.code})`
      : selectedCurrency || baseCurrency?.code || "—";
  }, [currencies, selectedCurrency, baseCurrency]);

  return (
    <OperationalTableTemplate
      title="قائمة الدخل"
      toolbar={
        <ReportFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          showCurrencySelect={hasMultipleCurrencies}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
          currencies={currencies}
          baseCurrencyCode={baseCurrency?.code}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          lastLoadedAt={lastLoadedAt}
        />
      }
      tableContent={
        isLoading ? (
          <ReportLoadingSkeleton />
        ) : computed ? (
          <IncomeStatementView
            computed={computed}
            filters={filters}
            selectedCurrencyLabel={selectedCurrencyLabel}
            lastLoadedAt={lastLoadedAt}
            formatValue={formatValue}
          />
        ) : null
      }
    />
  );
}
