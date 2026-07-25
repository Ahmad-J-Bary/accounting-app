import { useMemo, useState } from "react";
import type { PartnerProfitShareComputed, PartnerProfitShareRow } from "@modules/reports/lib/partnerProfitShare";
import { cn } from "@shared/lib/utils";
import { Users, TrendingUp, Package, CreditCard, Building2, BarChart3 } from "lucide-react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { toFixed } from "@shared/lib/format";
import { ReportMeta } from "@widgets/reports";

type PartnerProfitShareViewProps = {
  computed: PartnerProfitShareComputed;
  formatValue: (value: number) => string;
};

const summaryCards = [
  { label: "رأس المال", key: "totalCapital" as const, icon: Users, cardBg: "bg-indigo-50 border-indigo-100", iconBg: "bg-indigo-600", labelColor: "text-indigo-400", valueColor: "text-indigo-900" },
  { label: "صافي الأرباح", key: "netProfit" as const, icon: TrendingUp, cardBg: "bg-emerald-50 border-emerald-100", iconBg: "bg-emerald-600", labelColor: "text-emerald-400", valueColor: "text-emerald-900" },
  { label: "قيمة البضاعة", key: "inventoryValue" as const, icon: Package, cardBg: "bg-amber-50 border-amber-100", iconBg: "bg-amber-600", labelColor: "text-amber-400", valueColor: "text-amber-900" },
  { label: "ديون العملاء", key: "totalCustomerDebts" as const, icon: CreditCard, cardBg: "bg-rose-50 border-rose-100", iconBg: "bg-rose-600", labelColor: "text-rose-400", valueColor: "text-rose-900" },
  { label: "الأصول الثابتة", key: "fixedAssetsValue" as const, icon: Building2, cardBg: "bg-violet-50 border-violet-100", iconBg: "bg-violet-600", labelColor: "text-violet-400", valueColor: "text-violet-900" },
  { label: "الأصول التشغيلية", key: "totalOperationalAssets" as const, icon: BarChart3, cardBg: "bg-slate-100 border-slate-200", iconBg: "bg-slate-600", labelColor: "text-slate-400", valueColor: "text-slate-900" },
];

function SummaryCards({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <div className="grid grid-cols-6 gap-2 px-4 pt-4 pb-2">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={cn("rounded-xl border p-3 flex items-center gap-3", card.cardBg)}>
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0", card.iconBg)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className={cn("text-[9px] font-black uppercase tracking-widest block", card.labelColor)}>{card.label}</span>
              <div className={cn("text-sm font-black tabular-nums leading-tight", card.valueColor)}>
                {formatValue(computed[card.key])}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function usePartnerProfitShareColumns(formatValue: (value: number) => string) {
  return useMemo<UnifiedColumn<PartnerProfitShareRow>[]>(() => [
    {
      id: "partnerName",
      header: "اسم الشريك",
      label: "اسم الشريك",
      accessor: (row) => <span className="font-bold text-slate-800">{row.partnerName}</span>,
      className: "justify-start",
    },
    {
      id: "capitalRatio",
      header: "نسبة المشاركة برأس المال",
      label: "نسبة المشاركة برأس المال",
      accessor: (row) => toFixed(row.capitalRatio, 2) + "%",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "capitalAmount",
      header: "المبلغ المشارك به",
      label: "المبلغ المشارك به",
      accessor: (row) => formatValue(row.capitalAmount),
      className: "justify-end tabular-nums font-black text-slate-900",
    },
    {
      id: "profitShareRatio",
      header: "نسبة تقاسم الأرباح",
      label: "نسبة تقاسم الأرباح",
      accessor: (row) => toFixed(row.profitShareRatio, 2) + "%",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "profitShareAmount",
      header: "حصته من الأرباح",
      label: "حصته من الأرباح",
      accessor: (row) => formatValue(row.profitShareAmount),
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "drawings",
      header: "المسحوبات",
      label: "المسحوبات",
      accessor: (row) => formatValue(row.drawings),
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "finalAmount",
      header: "المبلغ النهائي للشريك",
      label: "المبلغ النهائي للشريك",
      accessor: (row) => formatValue(row.finalAmount),
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "inventoryShare",
      header: "حصته من البضاعة",
      label: "حصته من البضاعة",
      accessor: (row) => formatValue(row.inventoryShare),
      className: "justify-end tabular-nums font-medium text-amber-700",
    },
    {
      id: "fixedAssetsShare",
      header: "حصته من الأصول الثابتة",
      label: "حصته من الأصول الثابتة",
      accessor: (row) => formatValue(row.fixedAssetsShare),
      className: "justify-end tabular-nums font-medium text-violet-700",
    },
    {
      id: "operationalAssetShare",
      header: "حصته من الأصول التشغيلية",
      label: "حصته من الأصول التشغيلية",
      accessor: (row) => formatValue(row.operationalAssetShare),
      className: "justify-end tabular-nums font-medium text-slate-700",
    },
  ], [formatValue]);
}

export function PartnerProfitShareView(props: PartnerProfitShareViewProps) {
  const { computed, formatValue } = props;
  const [search, setSearch] = useState("");

  const allColumns = usePartnerProfitShareColumns(formatValue);

  const defaultVisible = useMemo(() => [
    "partnerName", "capitalRatio", "capitalAmount", "profitShareRatio",
    "profitShareAmount", "drawings", "finalAmount",
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
    let profitShareAmount = 0, drawings = 0, finalAmount = 0;
    let inventoryShare = 0, fixedAssetsShare = 0, operationalAssetShare = 0;

    for (const row of computed.rows) {
      capitalRatio += row.capitalRatio;
      capitalAmount += row.capitalAmount;
      profitShareRatio += row.profitShareRatio;
      profitShareAmount += row.profitShareAmount;
      drawings += row.drawings;
      finalAmount += row.finalAmount;
      inventoryShare += row.inventoryShare;
      fixedAssetsShare += row.fixedAssetsShare;
      operationalAssetShare += row.operationalAssetShare;
    }

    return { capitalRatio, capitalAmount, profitShareRatio, profitShareAmount, drawings, finalAmount, inventoryShare, fixedAssetsShare, operationalAssetShare, count: computed.rows.length };
  }, [computed.rows]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map((col) => {
      if (col.id === "partnerName") {
        return { id: "count", columnId: "partnerName", label: "", value: `${totals.count} شريك`, className: "text-slate-500 font-medium" };
      }
      if (col.id === "capitalRatio") {
        return { id: "capitalRatio_summary", columnId: "capitalRatio", label: "نسبة المشاركة", value: toFixed(totals.capitalRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", label: "إجمالي رأس المال", value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "profitShareRatio") {
        return { id: "profitShareRatio_summary", columnId: "profitShareRatio", label: "نسبة الأرباح", value: toFixed(totals.profitShareRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "profitShareAmount") {
        return { id: "profitShareAmount_summary", columnId: "profitShareAmount", label: "إجمالي الأرباح", value: formatValue(totals.profitShareAmount), className: "text-emerald-700 font-black" };
      }
      if (col.id === "drawings") {
        return { id: "drawings_summary", columnId: "drawings", label: "إجمالي المسحوبات", value: formatValue(totals.drawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", label: "المبلغ النهائي", value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "inventoryShare") {
        return { id: "inventoryShare_summary", columnId: "inventoryShare", label: "حصص البضاعة", value: formatValue(totals.inventoryShare), className: "text-amber-700 font-bold" };
      }
      if (col.id === "fixedAssetsShare") {
        return { id: "fixedAssetsShare_summary", columnId: "fixedAssetsShare", label: "حصص الأصول الثابتة", value: formatValue(totals.fixedAssetsShare), className: "text-violet-700 font-bold" };
      }
      if (col.id === "operationalAssetShare") {
        return { id: "operationalAssetShare_summary", columnId: "operationalAssetShare", label: "حصص الأصول التشغيلية", value: formatValue(totals.operationalAssetShare), className: "text-slate-700 font-bold" };
      }
      return { id: `${col.id}_spacer`, columnId: col.id, label: "", value: "" };
    });
  }, [enrichedColumns, totals, formatValue]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="الشركاء وتقاسم الأرباح" description="تقرير مفصل يوضح نسب الشراكة وتوزيع الأرباح بين الشركاء بناءً على رؤوس أموالهم والأرباح التشغيلية" />
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
            tableId="partner-profit-share"
            emptyMessage="لا يوجد شركاء نشطون لعرض التقرير"
            summary={summaryColumns}
            enableResize
          />
        </TableShell>
      </div>
    </div>
  );
}
