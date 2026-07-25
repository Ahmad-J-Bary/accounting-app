import { useCallback, useMemo } from "react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { Users } from "lucide-react";
import { computePartnerProfitShare } from "@modules/reports/lib/partnerProfitShare";
import { computePartnerStatement } from "@modules/reports/lib/partnerStatement";
import { usePartnerProfitShareReport } from "@modules/reports/hooks/usePartnerProfitShareReport";
import { PartnerStatementView } from "@modules/reports/components/PartnerStatementView";
import { ReportFilterBar } from "@widgets/reports/ReportFilterBar";
import { ReportLoadingSkeleton } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";

export default function PartnerStatementReport() {
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
  const { loading, reportData } = usePartnerProfitShareReport(filters);

  const fromTs = useMemo(() => new Date(`${filters.from_date}T00:00:00`).getTime(), [filters.from_date]);

  const profitShare = useMemo(() => {
    return computePartnerProfitShare(
      reportData.partners,
      reportData.netProfit,
      reportData.inventoryValue,
      reportData.fixedAssetsValue,
      reportData.partnerDrawings,
      reportData.customerDebts,
      reportData.partnerLedgers,
      filters.to_date,
    );
  }, [reportData, filters.to_date]);

  const thisYearProfitShare: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of profitShare.rows) {
      map[row.partnerId] = row.profitShareAmount;
    }
    return map;
  }, [profitShare]);

  const computed = useMemo(() => {
    return computePartnerStatement(
      reportData.partners,
      fromTs,
      reportData.partnerLedgers,
      thisYearProfitShare,
      reportData.partnerDrawings,
      filters.to_date,
    );
  }, [reportData, fromTs, thisYearProfitShare, filters.to_date]);

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
      title="كشف حساب الشريك"
      toolbar={
        <ReportFilterBar
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
        ) : !loading && computed.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="mb-3 h-12 w-12" />
            <p className="text-sm font-bold">لا يوجد شركاء لعرض كشف الحساب</p>
          </div>
        ) : (
          <PartnerStatementView
            computed={computed}
            formatValue={formatValue}
          />
        )
      }
    />
  );
}
