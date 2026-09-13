import { useMemo, useState, type ReactNode } from "react";
import type { PartnerProfitShareComputed, PartnerProfitShareRow } from "@modules/reports/lib/partnerProfitShare";
import { Users, TrendingUp, Package, CreditCard, Building2, BarChart3 } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { toFixed } from "@shared/lib/format";
import { ReportMeta } from "@widgets/reports";
import { createSummarySpacer } from "../lib/table-meta";
import { StatCard } from "@widgets/stats/StatCard";
import { useLocalization } from "@app/providers/LocalizationProvider";

type PartnerProfitShareViewProps = {
  computed: PartnerProfitShareComputed;
  formatValue: (value: number) => string;
  filterBar?: ReactNode;
};

const summaryCards = [
  { labelPath: "statCapital", key: "totalCapital" as const, icon: Users },
  { labelPath: "statNetProfit", key: "netProfit" as const, icon: TrendingUp },
  { labelPath: "statInventoryValue", key: "inventoryValue" as const, icon: Package },
  { labelPath: "statCustomerDebts", key: "totalCustomerDebts" as const, icon: CreditCard },
  { labelPath: "statFixedAssets", key: "fixedAssetsValue" as const, icon: Building2 },
  { labelPath: "statOperationalAssets", key: "totalOperationalAssets" as const, icon: BarChart3 },
];

function SummaryCards({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  const { t } = useLocalization();
  const statLabels: Record<string, string> = {
    statCapital: t("partnerRights.profitShare.statCapital", { namespace: "reports",  }),
    statNetProfit: t("partnerRights.profitShare.statNetProfit", { namespace: "reports",  }),
    statInventoryValue: t("partnerRights.profitShare.statInventoryValue", { namespace: "reports",  }),
    statCustomerDebts: t("partnerRights.profitShare.statCustomerDebts", { namespace: "reports",  }),
    statFixedAssets: t("partnerRights.profitShare.statFixedAssets", { namespace: "reports",  }),
    statOperationalAssets: t("partnerRights.profitShare.statOperationalAssets", { namespace: "reports",  }),
  };
  return (
    <div className="grid grid-cols-6 gap-2 px-4 pt-4 pb-2">
      {summaryCards.map((card) => (
        <StatCard key={card.labelPath} label={statLabels[card.labelPath]} value={formatValue(computed[card.key])} icon={card.icon} />
      ))}
    </div>
  );
}

function usePartnerProfitShareColumns(formatValue: (value: number) => string) {
  const { t } = useLocalization();
  return useMemo<UnifiedColumn<PartnerProfitShareRow>[]>(() => [
    {
      id: "partnerName",
      header: t("partnerRights.profitShare.colPartnerName", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colPartnerName", { namespace: "reports",  }),
      accessor: (row) => <span className="font-bold text-slate-800">{row.partnerName}</span>,
      align: "right",
      className: "justify-start",
    },
    {
      id: "capitalRatio",
      header: t("partnerRights.profitShare.colCapitalRatio", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colCapitalRatio", { namespace: "reports",  }),
      accessor: (row) => toFixed(row.capitalRatio, 2) + "%",
      align: "left",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "capitalAmount",
      header: t("partnerRights.profitShare.colCapitalAmount", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colCapitalAmount", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.capitalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-slate-900",
    },
    {
      id: "profitShareRatio",
      header: t("partnerRights.profitShare.colProfitShareRatio", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colProfitShareRatio", { namespace: "reports",  }),
      accessor: (row) => toFixed(row.profitShareRatio, 2) + "%",
      align: "left",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "profitShareAmount",
      header: t("partnerRights.profitShare.colProfitShareAmount", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colProfitShareAmount", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.profitShareAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "currentYearProfitShare",
      header: t("partnerRights.profitShare.colCurrentYearShare", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colCurrentYearShare", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.currentYearProfitShare),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-600",
    },
    {
      id: "totalProfitAllocated",
      header: t("partnerRights.profitShare.colTotalAllocated", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colTotalAllocated", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.totalProfitAllocated),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-800",
    },
    {
      id: "drawings",
      header: t("partnerRights.profitShare.colDrawings", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colDrawings", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.drawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "finalAmount",
      header: t("partnerRights.profitShare.colFinalAmount", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colFinalAmount", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.finalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "inventoryShare",
      header: t("partnerRights.profitShare.colInventoryShare", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colInventoryShare", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.inventoryShare),
      align: "left",
      className: "justify-end tabular-nums font-medium text-amber-700",
    },
    {
      id: "fixedAssetsShare",
      header: t("partnerRights.profitShare.colFixedAssetsShare", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colFixedAssetsShare", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.fixedAssetsShare),
      align: "left",
      className: "justify-end tabular-nums font-medium text-violet-700",
    },
    {
      id: "operationalAssetShare",
      header: t("partnerRights.profitShare.colOperationalShare", { namespace: "reports",  }),
      label: t("partnerRights.profitShare.colOperationalShare", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.operationalAssetShare),
      align: "left",
      className: "justify-end tabular-nums font-medium text-slate-700",
    },
  ], [formatValue, t]);
}

export function PartnerProfitShareView(props: PartnerProfitShareViewProps) {
  const { computed, formatValue, filterBar } = props;
  const { t } = useLocalization();
  const [search, setSearch] = useState("");

  const allColumns = usePartnerProfitShareColumns(formatValue);

  const defaultVisible = useMemo(() => [
    "partnerName", "capitalRatio", "capitalAmount", "profitShareRatio",
    "profitShareAmount", "currentYearProfitShare", "totalProfitAllocated",
    "drawings", "finalAmount",
  ], []);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "partner-profit-share",
    columns: allColumns,
    defaultVisible,
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return computed.rows;
    return computed.rows.filter(r => r.partnerName.toLowerCase().includes(q));
  }, [computed.rows, search]);

  const totals = useMemo(() => {
    let capitalRatio = 0, capitalAmount = 0, profitShareRatio = 0;
    let profitShareAmount = 0, currentYearProfitShare = 0, totalProfitAllocated = 0;
    let drawings = 0, finalAmount = 0;
    let inventoryShare = 0, fixedAssetsShare = 0, operationalAssetShare = 0;

    for (const row of computed.rows) {
      capitalRatio += row.capitalRatio;
      capitalAmount += row.capitalAmount;
      profitShareRatio += row.profitShareRatio;
      profitShareAmount += row.profitShareAmount;
      currentYearProfitShare += row.currentYearProfitShare;
      totalProfitAllocated += row.totalProfitAllocated;
      drawings += row.drawings;
      finalAmount += row.finalAmount;
      inventoryShare += row.inventoryShare;
      fixedAssetsShare += row.fixedAssetsShare;
      operationalAssetShare += row.operationalAssetShare;
    }

    return { capitalRatio, capitalAmount, profitShareRatio, profitShareAmount, currentYearProfitShare, totalProfitAllocated, drawings, finalAmount, inventoryShare, fixedAssetsShare, operationalAssetShare, count: computed.rows.length };
  }, [computed.rows]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map((col) => {
      if (col.id === "partnerName") {
        return { id: "count", columnId: "partnerName", align: "right", label: "", value: t("partnerRights.profitShare.countPartners", { namespace: "reports", vars: { count: totals.count } }), className: "text-slate-500 font-medium" };
      }
      if (col.id === "capitalRatio") {
        return { id: "capitalRatio_summary", columnId: "capitalRatio", align: "left", label: t("partnerRights.profitShare.summaryCapitalRatio", { namespace: "reports",  }), value: toFixed(totals.capitalRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", align: "left", label: t("partnerRights.profitShare.summaryCapital", { namespace: "reports",  }), value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "profitShareRatio") {
        return { id: "profitShareRatio_summary", columnId: "profitShareRatio", align: "left", label: t("partnerRights.profitShare.summaryProfitRatio", { namespace: "reports",  }), value: toFixed(totals.profitShareRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "profitShareAmount") {
        return { id: "profitShareAmount_summary", columnId: "profitShareAmount", align: "left", label: t("partnerRights.profitShare.summaryDistributed", { namespace: "reports",  }), value: formatValue(totals.profitShareAmount), className: "text-emerald-700 font-black" };
      }
      if (col.id === "currentYearProfitShare") {
        return { id: "currentYearProfitShare_summary", columnId: "currentYearProfitShare", align: "left", label: t("partnerRights.profitShare.summaryCurrentYearShare", { namespace: "reports",  }), value: formatValue(totals.currentYearProfitShare), className: "text-emerald-600 font-black" };
      }
      if (col.id === "totalProfitAllocated") {
        return { id: "totalProfitAllocated_summary", columnId: "totalProfitAllocated", align: "left", label: t("partnerRights.profitShare.summaryTotalAllocated", { namespace: "reports",  }), value: formatValue(totals.totalProfitAllocated), className: "text-emerald-800 font-black" };
      }
      if (col.id === "drawings") {
        return { id: "drawings_summary", columnId: "drawings", align: "left", label: t("partnerRights.profitShare.summaryDrawings", { namespace: "reports",  }), value: formatValue(totals.drawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", align: "left", label: t("partnerRights.profitShare.summaryFinalAmount", { namespace: "reports",  }), value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "inventoryShare") {
        return { id: "inventoryShare_summary", columnId: "inventoryShare", align: "left", label: t("partnerRights.profitShare.summaryInventoryShare", { namespace: "reports",  }), value: formatValue(totals.inventoryShare), className: "text-amber-700 font-bold" };
      }
      if (col.id === "fixedAssetsShare") {
        return { id: "fixedAssetsShare_summary", columnId: "fixedAssetsShare", align: "left", label: t("partnerRights.profitShare.summaryFixedAssetsShare", { namespace: "reports",  }), value: formatValue(totals.fixedAssetsShare), className: "text-violet-700 font-bold" };
      }
      if (col.id === "operationalAssetShare") {
        return { id: "operationalAssetShare_summary", columnId: "operationalAssetShare", align: "left", label: t("partnerRights.profitShare.summaryOperationalShare", { namespace: "reports",  }), value: formatValue(totals.operationalAssetShare), className: "text-slate-700 font-bold" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, formatValue, t]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title={t("partnerRights.title", { namespace: "reports",  })} description={t("partnerRights.profitShare.metaDescription", { namespace: "reports",  })} />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-hidden pb-4">
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("partnerRights.profitShare.searchPlaceholder", { namespace: "reports",  })}
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          onColumnsReset={resetToDefault}
          columnsModified={isModified}
          filterBar={filterBar}
        >
          <UnifiedTable
            data={filteredRows}
            columns={enrichedColumns}
            tableId="partner-profit-share"
            emptyMessage={t("partnerRights.profitShare.empty", { namespace: "reports",  })}
            summary={summaryColumns}
            enableResize
          />
        </TableShell>
      </div>
    </div>
  );
}
