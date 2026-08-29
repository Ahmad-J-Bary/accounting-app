import { useMemo, useState } from "react";
import type { PartnerStatementComputed, PartnerStatementRow } from "@modules/reports/lib/partnerStatement";
import { Users, TrendingUp, Wallet, Percent } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { ReportMeta } from "@widgets/reports";
import { createSummarySpacer } from "../lib/table-meta";
import { StatCard } from "@widgets/stats/StatCard";

type PartnerStatementViewProps = {
  computed: PartnerStatementComputed;
  formatValue: (value: number) => string;
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

  return (
    <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
      <StatCard label="إجمالي رأس المال" value={formatValue(totals.capital)} icon={Users} />
      <StatCard label="إجمالي الأرباح" value={formatValue(totals.profits)} icon={TrendingUp} />
      <StatCard label="إجمالي المسحوبات" value={formatValue(totals.drawings)} icon={Wallet} />
      <StatCard label="المبلغ النهائي" value={formatValue(totals.finalAmount)} icon={Percent} />
    </div>
  );
}

function usePartnerStatementColumns(formatValue: (value: number) => string) {
  return useMemo<UnifiedColumn<PartnerStatementRow>[]>(() => [
    {
      id: "partnerName",
      header: "اسم الشريك",
      label: "اسم الشريك",
      accessor: (row) => <span className="font-bold text-slate-800">{row.partnerName}</span>,
      align: "right",
      className: "justify-start",
    },
    {
      id: "capitalAmount",
      header: "رأس المال",
      label: "رأس المال",
      accessor: (row) => formatValue(row.capitalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-slate-900",
    },
    {
      id: "accumulatedProfits",
      header: "أرباح مبقاة (فترات سابقة)",
      label: "أرباح مبقاة (فترات سابقة)",
      accessor: (row) => formatValue(row.accumulatedProfits),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "accumulatedDrawings",
      header: "مسحوبات (فترات سابقة)",
      label: "مسحوبات (فترات سابقة)",
      accessor: (row) => formatValue(row.accumulatedDrawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "currentAccount",
      header: "الحساب الجاري (الأرباح المتراكمة)",
      label: "الحساب الجاري (الأرباح المتراكمة)",
      accessor: (row) => formatValue(row.currentAccount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "thisYearProfit",
      header: "أرباح السنة الحالية",
      label: "أرباح السنة الحالية",
      accessor: (row) => formatValue(row.thisYearProfit),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "thisYearDrawings",
      header: "مسحوبات السنة الحالية",
      label: "مسحوبات السنة الحالية",
      accessor: (row) => formatValue(row.thisYearDrawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "finalAmount",
      header: "إجمالي حقوق الشريك",
      label: "إجمالي حقوق الشريك",
      accessor: (row) => formatValue(row.finalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
  ], [formatValue]);
}

export function PartnerStatementView({ computed, formatValue }: PartnerStatementViewProps) {
  const [search, setSearch] = useState("");

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
        return { id: "count", columnId: "partnerName", align: "right", label: "", value: `${totals.count} شريك`, className: "text-slate-500 font-medium" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", align: "left", label: "إجمالي رأس المال", value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "accumulatedProfits") {
        return { id: "accumulatedProfits_summary", columnId: "accumulatedProfits", align: "left", label: "إجمالي أرباح مبقاة", value: formatValue(totals.accumulatedProfits), className: "text-emerald-700 font-black" };
      }
      if (col.id === "accumulatedDrawings") {
        return { id: "accumulatedDrawings_summary", columnId: "accumulatedDrawings", align: "left", label: "إجمالي مسحوبات سابقة", value: formatValue(totals.accumulatedDrawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "currentAccount") {
        return { id: "currentAccount_summary", columnId: "currentAccount", align: "left", label: "الحساب الجاري", value: formatValue(totals.currentAccount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "thisYearProfit") {
        return { id: "thisYearProfit_summary", columnId: "thisYearProfit", align: "left", label: "أرباح السنة الحالية", value: formatValue(totals.thisYearProfit), className: "text-emerald-700 font-black" };
      }
      if (col.id === "thisYearDrawings") {
        return { id: "thisYearDrawings_summary", columnId: "thisYearDrawings", align: "left", label: "مسحوبات السنة الحالية", value: formatValue(totals.thisYearDrawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", align: "left", label: "إجمالي حقوق الشريك", value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, formatValue]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="كشف حساب الشريك" description="تقرير شامل يوضح رأس المال والحساب الجاري والأرباح المبقاة والمسحوبات وإجمالي حقوق كل شريك" />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-hidden pb-4">
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث باسم الشريك..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          onColumnsReset={resetToDefault}
          columnsModified={isModified}
        >
          <UnifiedTable
            data={filteredRows}
            columns={enrichedColumns}
            tableId="partner-statement"
            emptyMessage="لا يوجد شركاء لعرض كشف الحساب"
            summary={summaryColumns}
            enableResize
          />
        </TableShell>
      </div>
    </div>
  );
}
