import { useMemo, useState } from "react";
import type { PartnerStatementComputed, PartnerStatementRow } from "@modules/reports/lib/partnerStatement";
import { Users, TrendingUp, Wallet, Percent } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { ReportMeta } from "@widgets/reports";
import { createSummarySpacer } from "../lib/table-meta";

type PartnerStatementViewProps = {
  computed: PartnerStatementComputed;
  formatValue: (value: number) => string;
};

function SummaryCards({ computed, formatValue }: { computed: PartnerStatementComputed; formatValue: (value: number) => string }) {
  const totals = useMemo(() => {
    let capital = 0, profits = 0, drawings = 0, finalAmount = 0;
    for (const row of computed.rows) {
      capital += row.capitalAmount;
      profits += row.accumulatedProfits + row.thisYearProfit;
      drawings += row.accumulatedDrawings + row.thisYearDrawings;
      finalAmount += row.finalAmount;
    }
    return { capital, profits, drawings, finalAmount };
  }, [computed.rows]);

  return (
    <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">إجمالي رأس المال</span>
          <div className="text-sm font-black text-indigo-900 tabular-nums leading-tight">{formatValue(totals.capital)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">إجمالي الأرباح</span>
          <div className="text-sm font-black text-emerald-900 tabular-nums leading-tight">{formatValue(totals.profits)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest block">إجمالي المسحوبات</span>
          <div className="text-sm font-black text-rose-900 tabular-nums leading-tight">{formatValue(totals.drawings)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-600 flex items-center justify-center text-white shrink-0">
          <Percent className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">المبلغ النهائي</span>
          <div className="text-sm font-black text-slate-900 tabular-nums leading-tight">{formatValue(totals.finalAmount)}</div>
        </div>
      </div>
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
      className: "justify-start",
    },
    {
      id: "capitalAmount",
      header: "رأس المال",
      label: "رأس المال",
      accessor: (row) => formatValue(row.capitalAmount),
      className: "justify-end tabular-nums font-black text-slate-900",
    },
    {
      id: "accumulatedProfits",
      header: "أرباح سنوات سابقة",
      label: "أرباح سنوات سابقة",
      accessor: (row) => formatValue(row.accumulatedProfits),
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "accumulatedDrawings",
      header: "مسحوبات سنوات سابقة",
      label: "مسحوبات سنوات سابقة",
      accessor: (row) => formatValue(row.accumulatedDrawings),
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "currentAccount",
      header: "الحساب الجاري",
      label: "الحساب الجاري",
      accessor: (row) => formatValue(row.currentAccount),
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "thisYearProfit",
      header: "أرباح هذه السنة",
      label: "أرباح هذه السنة",
      accessor: (row) => formatValue(row.thisYearProfit),
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "thisYearDrawings",
      header: "مسحوبات هذه السنة",
      label: "مسحوبات هذه السنة",
      accessor: (row) => formatValue(row.thisYearDrawings),
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "finalAmount",
      header: "المبلغ النهائي",
      label: "المبلغ النهائي",
      accessor: (row) => formatValue(row.finalAmount),
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
        return { id: "count", columnId: "partnerName", label: "", value: `${totals.count} شريك`, className: "text-slate-500 font-medium" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", label: "إجمالي رأس المال", value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "accumulatedProfits") {
        return { id: "accumulatedProfits_summary", columnId: "accumulatedProfits", label: "إجمالي أرباح سابقة", value: formatValue(totals.accumulatedProfits), className: "text-emerald-700 font-black" };
      }
      if (col.id === "accumulatedDrawings") {
        return { id: "accumulatedDrawings_summary", columnId: "accumulatedDrawings", label: "إجمالي مسحوبات سابقة", value: formatValue(totals.accumulatedDrawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "currentAccount") {
        return { id: "currentAccount_summary", columnId: "currentAccount", label: "الحساب الجاري", value: formatValue(totals.currentAccount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "thisYearProfit") {
        return { id: "thisYearProfit_summary", columnId: "thisYearProfit", label: "أرباح هذه السنة", value: formatValue(totals.thisYearProfit), className: "text-emerald-700 font-black" };
      }
      if (col.id === "thisYearDrawings") {
        return { id: "thisYearDrawings_summary", columnId: "thisYearDrawings", label: "مسحوبات هذه السنة", value: formatValue(totals.thisYearDrawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", label: "المبلغ النهائي", value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, formatValue]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="كشف حساب الشريك" description="تقرير شامل يوضح تفاصيل رأس المال والأرباح المتراكمة والمسحوبات والحسابات الجارية لكل شريك" />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
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
