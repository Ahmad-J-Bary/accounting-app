import { useMemo } from "react";
import { computePartnerProfitShare } from "@modules/reports/lib/partnerProfitShare";
import { computePartnerStatement } from "@modules/reports/lib/partnerStatement";
import { usePartnerProfitShareReport } from "@modules/reports/hooks/usePartnerProfitShareReport";
import type { LoadedPartnerProfitShareData } from "@modules/reports/hooks/usePartnerProfitShareReport";
import type { IncomeStatementFilters } from "@modules/reports/lib/incomeStatement";
import type { PartnerProfitShareComputed } from "@modules/reports/lib/partnerProfitShare";
import type { PartnerStatementComputed } from "@modules/reports/lib/partnerStatement";
import type { ReportState } from "@shared/types/report";

export type PartnerRightsReportData = {
  profitShare: PartnerProfitShareComputed;
  statement: PartnerStatementComputed;
  thisYearProfitShare: Record<string, number>;
};

const emptyData: PartnerRightsReportData = {
  profitShare: { rows: [], totalCapital: 0, netProfit: 0, inventoryValue: 0, fixedAssetsValue: 0, totalCustomerDebts: 0, totalOperationalAssets: 0 },
  statement: { rows: [] },
  thisYearProfitShare: {},
};

export function usePartnerRightsReport(filters: IncomeStatementFilters): ReportState<LoadedPartnerProfitShareData> & { computed: PartnerRightsReportData } {
  const reportState = usePartnerProfitShareReport(filters);

  const computed = useMemo(() => {
    if (!reportState.reportData.partners.length) {
      return emptyData;
    }

    const profitShare = computePartnerProfitShare(
      reportState.reportData.partners,
      reportState.reportData.netProfit,
      reportState.reportData.inventoryValue,
      reportState.reportData.fixedAssetsValue,
      reportState.reportData.partnerDrawings,
      reportState.reportData.customerDebts,
      reportState.reportData.partnerLedgers,
      filters.to_date,
    );

    const thisYearProfitShare: Record<string, number> = {};
    for (const row of profitShare.rows) {
      thisYearProfitShare[row.partnerId] = row.profitShareAmount;
    }

    const fromTs = new Date(`${filters.from_date}T00:00:00`).getTime();

    const statement = computePartnerStatement(
      reportState.reportData.partners,
      fromTs,
      reportState.reportData.partnerLedgers,
      thisYearProfitShare,
      reportState.reportData.partnerDrawings,
      filters.to_date,
    );

    return { profitShare, statement, thisYearProfitShare };
  }, [reportState.reportData, filters]);

  return {
    ...reportState,
    computed,
  };
}
