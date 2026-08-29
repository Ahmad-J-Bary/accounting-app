import { useMemo, useState } from "react";
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

type PartnerProfitShareViewProps = {
  computed: PartnerProfitShareComputed;
  formatValue: (value: number) => string;
};

const summaryCards = [
  { label: "رأس المال", key: "totalCapital" as const, icon: Users },
  { label: "صافي الأرباح", key: "netProfit" as const, icon: TrendingUp },
  { label: "قيمة البضاعة", key: "inventoryValue" as const, icon: Package },
  { label: "ديون العملاء", key: "totalCustomerDebts" as const, icon: CreditCard },
  { label: "الأصول الثابتة", key: "fixedAssetsValue" as const, icon: Building2 },
  { label: "الأصول التشغيلية", key: "totalOperationalAssets" as const, icon: BarChart3 },
];

function SummaryCards({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <div className="grid grid-cols-6 gap-2 px-4 pt-4 pb-2">
      {summaryCards.map((card) => (
        <StatCard key={card.label} label={card.label} value={formatValue(computed[card.key])} icon={card.icon} />
      ))}
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
      align: "right",
      className: "justify-start",
    },
    {
      id: "capitalRatio",
      header: "نسبة المشاركة برأس المال",
      label: "نسبة المشاركة برأس المال",
      accessor: (row) => toFixed(row.capitalRatio, 2) + "%",
      align: "left",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "capitalAmount",
      header: "المبلغ المشارك به",
      label: "المبلغ المشارك به",
      accessor: (row) => formatValue(row.capitalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-slate-900",
    },
    {
      id: "profitShareRatio",
      header: "نسبة تقاسم الأرباح",
      label: "نسبة تقاسم الأرباح",
      accessor: (row) => toFixed(row.profitShareRatio, 2) + "%",
      align: "left",
      className: "justify-end tabular-nums text-slate-600 font-bold",
    },
    {
      id: "profitShareAmount",
      header: "الأرباح الموزعة (أرباح مبقاة)",
      label: "الأرباح الموزعة (أرباح مبقاة)",
      accessor: (row) => formatValue(row.profitShareAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-700",
    },
    {
      id: "currentYearProfitShare",
      header: "حصته من ربح السنة الحالية",
      label: "حصته من ربح السنة الحالية",
      accessor: (row) => formatValue(row.currentYearProfitShare),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-600",
    },
    {
      id: "totalProfitAllocated",
      header: "إجمالي الأرباح المخصصة",
      label: "إجمالي الأرباح المخصصة",
      accessor: (row) => formatValue(row.totalProfitAllocated),
      align: "left",
      className: "justify-end tabular-nums font-black text-emerald-800",
    },
    {
      id: "drawings",
      header: "المسحوبات",
      label: "المسحوبات",
      accessor: (row) => formatValue(row.drawings),
      align: "left",
      className: "justify-end tabular-nums font-black text-rose-700",
    },
    {
      id: "finalAmount",
      header: "المبلغ النهائي للشريك",
      label: "المبلغ النهائي للشريك",
      accessor: (row) => formatValue(row.finalAmount),
      align: "left",
      className: "justify-end tabular-nums font-black text-indigo-700",
    },
    {
      id: "inventoryShare",
      header: "حصته من البضاعة",
      label: "حصته من البضاعة",
      accessor: (row) => formatValue(row.inventoryShare),
      align: "left",
      className: "justify-end tabular-nums font-medium text-amber-700",
    },
    {
      id: "fixedAssetsShare",
      header: "حصته من الأصول الثابتة",
      label: "حصته من الأصول الثابتة",
      accessor: (row) => formatValue(row.fixedAssetsShare),
      align: "left",
      className: "justify-end tabular-nums font-medium text-violet-700",
    },
    {
      id: "operationalAssetShare",
      header: "حصته من الأصول التشغيلية",
      label: "حصته من الأصول التشغيلية",
      accessor: (row) => formatValue(row.operationalAssetShare),
      align: "left",
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
        return { id: "count", columnId: "partnerName", align: "right", label: "", value: `${totals.count} شريك`, className: "text-slate-500 font-medium" };
      }
      if (col.id === "capitalRatio") {
        return { id: "capitalRatio_summary", columnId: "capitalRatio", align: "left", label: "نسبة المشاركة", value: toFixed(totals.capitalRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "capitalAmount") {
        return { id: "capitalAmount_summary", columnId: "capitalAmount", align: "left", label: "إجمالي رأس المال", value: formatValue(totals.capitalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "profitShareRatio") {
        return { id: "profitShareRatio_summary", columnId: "profitShareRatio", align: "left", label: "نسبة الأرباح", value: toFixed(totals.profitShareRatio, 2) + "%", className: "text-slate-700 font-bold" };
      }
      if (col.id === "profitShareAmount") {
        return { id: "profitShareAmount_summary", columnId: "profitShareAmount", align: "left", label: "الأرباح الموزعة", value: formatValue(totals.profitShareAmount), className: "text-emerald-700 font-black" };
      }
      if (col.id === "currentYearProfitShare") {
        return { id: "currentYearProfitShare_summary", columnId: "currentYearProfitShare", align: "left", label: "ربح السنة الحالية", value: formatValue(totals.currentYearProfitShare), className: "text-emerald-600 font-black" };
      }
      if (col.id === "totalProfitAllocated") {
        return { id: "totalProfitAllocated_summary", columnId: "totalProfitAllocated", align: "left", label: "إجمالي الأرباح", value: formatValue(totals.totalProfitAllocated), className: "text-emerald-800 font-black" };
      }
      if (col.id === "drawings") {
        return { id: "drawings_summary", columnId: "drawings", align: "left", label: "إجمالي المسحوبات", value: formatValue(totals.drawings), className: "text-rose-700 font-black" };
      }
      if (col.id === "finalAmount") {
        return { id: "finalAmount_summary", columnId: "finalAmount", align: "left", label: "إجمالي حقوق الشركاء", value: formatValue(totals.finalAmount), className: "text-indigo-700 font-black" };
      }
      if (col.id === "inventoryShare") {
        return { id: "inventoryShare_summary", columnId: "inventoryShare", align: "left", label: "حصص البضاعة", value: formatValue(totals.inventoryShare), className: "text-amber-700 font-bold" };
      }
      if (col.id === "fixedAssetsShare") {
        return { id: "fixedAssetsShare_summary", columnId: "fixedAssetsShare", align: "left", label: "حصص الأصول الثابتة", value: formatValue(totals.fixedAssetsShare), className: "text-violet-700 font-bold" };
      }
      if (col.id === "operationalAssetShare") {
        return { id: "operationalAssetShare_summary", columnId: "operationalAssetShare", align: "left", label: "حصص الأصول التشغيلية", value: formatValue(totals.operationalAssetShare), className: "text-slate-700 font-bold" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, formatValue]);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="الشركاء وحقوقهم" description="تقرير مفصل يوضح نسب الشراكة والأرباح الموزعة وربح السنة الحالية وإجمالي حقوق كل شريك" />
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
