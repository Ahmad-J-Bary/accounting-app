import { useMemo, useState, type ReactNode } from "react";
import type { PartnerStatementComputed, PartnerStatementRow } from "@modules/reports/lib/partnerStatement";
import { Users, TrendingUp, Wallet, Percent } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { ReportMeta } from "@widgets/reports";
import { createSummarySpacer } from "../lib/table-meta";
import { StatCard } from "@widgets/stats/StatCard";
import { useLocalization } from "@app/providers/LocalizationProvider";

type PartnerStatementViewProps = {
  computed: PartnerStatementComputed;
  formatValue: (value: number) => string;
  filterBar?: ReactNode;
};

function SummaryCards({ computed, formatValue }: { computed: PartnerStatementComputed; formatValue: (value: number) => string }) {
  const totals = useMemo(() => {
    let capital = 0, profits = 0, drawings = 0, finalAmount = 0;
    for (const row of computed.rows) {
      capital += row.capitalAmount;
      profits += row.currentAccount;
      drawings += row.drawingsTotal;
      finalAmount += row.finalAmount;
    }
    return { capital, profits, drawings, finalAmount };
  }, [computed.rows]);
  const { t } = useLocalization();

  return (
    <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
      <StatCard label={t("partnerRights.statement.statTotalCapital", { namespace: "reports",  })} value={formatValue(totals.capital)} icon={Users} />
      <StatCard label={t("partnerRights.statement.statTotalProfit", { namespace: "reports",  })} value={formatValue(totals.profits)} icon={TrendingUp} />
      <StatCard label={t("partnerRights.statement.statTotalDrawings", { namespace: "reports",  })} value={formatValue(totals.drawings)} icon={Wallet} />
      <StatCard label={t("partnerRights.statement.statFinalAmount", { namespace: "reports",  })} value={formatValue(totals.finalAmount)} icon={Percent} />
    </div>
  );
}

function usePartnerStatementColumns(formatValue: (value: number) => string) {
  const { t } = useLocalization();
  return useMemo<UnifiedColumn<PartnerStatementRow>[]>(() => [
    {
      id: "partnerName",
      header: t("partnerRights.statement.colPartnerName", { namespace: "reports",  }),
      label: t("partnerRights.statement.colPartnerName", { namespace: "reports",  }),
      accessor: (row) => <span className="font-bold text-foreground">{row.partnerName}</span>,
      align: "right",
      className: "justify-start",
    },
    {
      id: "capitalAmount",
      header: t("partnerRights.statement.colCapital", { namespace: "reports",  }),
      label: t("partnerRights.statement.colCapital", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.capitalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-foreground",
    },
    {
      id: "accumulatedProfits",
      header: t("partnerRights.statement.colAccumulatedProfits", { namespace: "reports",  }),
      label: t("partnerRights.statement.colAccumulatedProfits", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.accumulatedProfits),
      align: "left",
      className: "justify-end tabular-nums font-black text-success",
    },
    {
      id: "accumulatedDrawings",
      header: t("partnerRights.statement.colAccumulatedDrawings", { namespace: "reports",  }),
      label: t("partnerRights.statement.colAccumulatedDrawings", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.accumulatedDrawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-destructive",
    },
    {
      id: "currentAccount",
      header: t("partnerRights.statement.colCurrentAccount", { namespace: "reports",  }),
      label: t("partnerRights.statement.colCurrentAccount", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.currentAccount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "thisYearProfit",
      header: t("partnerRights.statement.colThisYearProfit", { namespace: "reports",  }),
      label: t("partnerRights.statement.colThisYearProfit", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.thisYearProfit),
      align: "left",
      className: "justify-end tabular-nums font-black text-success",
    },
    {
      id: "thisYearDrawings",
      header: t("partnerRights.statement.colThisYearDrawings", { namespace: "reports",  }),
      label: t("partnerRights.statement.colThisYearDrawings", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.thisYearDrawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-destructive",
    },
    {
      id: "finalAmount",
      header: t("partnerRights.statement.colFinalAmount", { namespace: "reports",  }),
      label: t("partnerRights.statement.colFinalAmount", { namespace: "reports",  }),
      accessor: (row) => formatValue(row.finalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
  ], [formatValue, t]);
}

export function PartnerStatementView({ computed, formatValue, filterBar }: PartnerStatementViewProps) {
  const [search, setSearch] = useState("");
  const { t } = useLocalization();

  const allColumns = usePartnerStatementColumns(formatValue);

  const defaultVisible = useMemo(() => [
    "partnerName", "capitalAmount", "accumulatedProfits", "accumulatedDrawings",
    "currentAccount", "thisYearProfit", "thisYearDrawings", "finalAmount",
  ], []);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "partner-statement",
    columns: allColumns,
    defaultVisible,
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return computed.rows;
    return computed.rows.filter(r => r.partnerName.toLowerCase().includes(q));
  }, [computed.rows, search]);

  const totals = useMemo(() => {
    let capitalAmount = 0, accumulatedProfits = 0, accumulatedDrawings = 0;
    let currentAccount = 0, thisYearProfit = 0, thisYearDrawings = 0, finalAmount = 0;

    for (const row of computed.rows) {
      capitalAmount += row.capitalAmount;
      accumulatedProfits += row.accumulatedProfits;
      accumulatedDrawings += row.accumulatedDrawings;
      currentAccount += row.currentAccount;
      thisYearProfit += row.thisYearProfit;
      thisYearDrawings += row.thisYearDrawings;
      finalAmount += row.finalAmount;
    }

    return { capitalAmount, accumulatedProfits, accumulatedDrawings, currentAccount, thisYearProfit, thisYearDrawings, finalAmount, count: computed.rows.length };
  }, [computed.rows]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map((col) => {
      if (col.id === "partnerName") {
        return { id: "count", columnId: "partnerName", align: "right", label: "", value: t("partnerRights.statement.countPartners", { namespace: "reports", vars: { count: totals.count } }), className: "text-muted-foreground font-medium" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", align: "left", label: t("partnerRights.statement.summaryCapital", { namespace: "reports",  }), value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "accumulatedProfits") {
        return { id: "accumulatedProfits_summary", columnId: "accumulatedProfits", align: "left", label: t("partnerRights.statement.summaryAccumulatedProfits", { namespace: "reports",  }), value: formatValue(totals.accumulatedProfits), className: "text-success font-black" };
      }
      if (col.id === "accumulatedDrawings") {
        return { id: "accumulatedDrawings_summary", columnId: "accumulatedDrawings", align: "left", label: t("partnerRights.statement.summaryAccumulatedDrawings", { namespace: "reports",  }), value: formatValue(totals.accumulatedDrawings), className: "text-destructive font-black" };
      }
      if (col.id === "currentAccount") {
        return { id: "currentAccount_summary", columnId: "currentAccount", align: "left", label: t("partnerRights.statement.summaryCurrentAccount", { namespace: "reports",  }), value: formatValue(totals.currentAccount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "thisYearProfit") {
        return { id: "thisYearProfit_summary", columnId: "thisYearProfit", align: "left", label: t("partnerRights.statement.summaryThisYearProfit", { namespace: "reports",  }), value: formatValue(totals.thisYearProfit), className: "text-success font-black" };
      }
      if (col.id === "thisYearDrawings") {
        return { id: "thisYearDrawings_summary", columnId: "thisYearDrawings", align: "left", label: t("partnerRights.statement.summaryThisYearDrawings", { namespace: "reports",  }), value: formatValue(totals.thisYearDrawings), className: "text-destructive font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", align: "left", label: t("partnerRights.statement.summaryFinalAmount", { namespace: "reports",  }), value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, formatValue, t]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title={t("partnerRights.statement.metaTitle", { namespace: "reports",  })} description={t("partnerRights.statement.metaDescription", { namespace: "reports",  })} />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-hidden pb-4">
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("partnerRights.statement.searchPlaceholder", { namespace: "reports",  })}
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          onColumnsReset={resetToDefault}
          columnsModified={isModified}
          filterBar={filterBar}
        >
          <UnifiedTable
            data={filteredRows}
            columns={enrichedColumns}
            tableId="partner-statement"
            emptyMessage={t("partnerRights.statement.empty", { namespace: "reports",  })}
            summary={summaryColumns}
            enableResize
          />
        </TableShell>
      </div>
    </div>
  );
}
