import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import type { PartnerDto } from "@erp/shared-types";
import { NotebookText, Receipt, Users } from "lucide-react";
import { TableActions } from "@widgets/table-shell/TableActions";

type PartnerWithRatios = PartnerDto & {
  calculatedRatio: number;
  calculatedCapitalRatio: number;
  displayAmountBase: number;
};

interface PartnerTableProps {
  partners: PartnerWithRatios[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  onView: (p: PartnerDto) => void;
  onEdit: (p: PartnerDto) => void;
  onDelete: (id: string) => void;
  onJournal: (p: PartnerDto) => void;
  onDocument: (p: PartnerDto) => void;
  selectedId?: string | null;
  onRowClick?: (p: PartnerDto) => void;
}

type SortField = string;

export function PartnerTable({
  partners,
  loading,
  search,
  onSearchChange,
  onView,
  onEdit,
  onDelete,
  onJournal,
  onDocument,
  selectedId,
  onRowClick
}: PartnerTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { sortedData: sortedPartners, sortField, sortDirection, handleSort } = useSortable({
    data: partners,
    defaultField: "name" as SortField,
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "name": comparison = (a.name || "").localeCompare(b.name || "", "ar"); break;
        case "capital_ratio": comparison = a.calculatedCapitalRatio - b.calculatedCapitalRatio; break;
        case "ratio": comparison = a.calculatedRatio - b.calculatedRatio; break;
        default: {
          comparison = a.displayAmountBase - b.displayAmountBase;
        }
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<PartnerWithRatios>[]>(() => {
    const cols: UnifiedColumn<PartnerWithRatios>[] = [
      {
        id: "name",
        header: "اسم الشريك",
        label: "اسم الشريك",
        accessor: (p: PartnerWithRatios) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-800">{p.name}</span>
          </div>
        )
      },
    ];

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      cols.push({
        id: `amount_${curr.code}`,
        header: `رأس المال (${symbol})`,
        label: `رأس المال (${symbol})`,
        accessor: (p: PartnerWithRatios) => {
          if (p.displayAmountBase === 0) return "—";
          return formatAmount(p.displayAmountBase, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      });
    });

    cols.push(
      {
        id: "capital_ratio",
        header: "نسبة رأس المال",
        label: "نسبة المساهمة في رأس المال",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black tabular-nums">
            {p.calculatedCapitalRatio.toFixed(2)}%
          </span>
        ),
      },
      {
        id: "ratio",
        header: "نسبة الأرباح",
        label: "نسبة توزيع الأرباح",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black tabular-nums">
            {p.calculatedRatio.toFixed(2)}%
          </span>
        ),
      },
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (p: PartnerWithRatios) => (
          <TableActions
            onView={() => onView(p)}
            onEdit={() => onEdit(p)}
            onDelete={() => onDelete(p.id)}
            extraActions={[
              { label: "اليومية", icon: NotebookText, onClick: () => onJournal(p) },
              { label: "سند مسحوبات", icon: Receipt, onClick: () => onDocument(p) },
            ]}
          />
        )
      }
    );

    return cols;
  }, [currencies, formatAmount, onView, onEdit, onDelete, onJournal, onDocument]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "partners-unified",
    columns: allColumns,
    defaultVisible: ["name", ...currencies.map(c => `amount_${c.code}`), "capital_ratio", "ratio", "actions"],
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCapitalRatio = sortedPartners.reduce((s, p) => s + p.calculatedCapitalRatio, 0);
    const totalRatio = sortedPartners.reduce((s, p) => s + p.calculatedRatio, 0);
    const baseTotal = sortedPartners.reduce((sum, p) => sum + p.displayAmountBase, 0);

    return enrichedColumns.map((col) => {
      const id = col.id;
      switch (id) {
        case "name":
          return { id: "count", columnId: "name", label: "", value: `${sortedPartners.length} شريك`, className: "text-slate-500 font-medium" };
        case "capital_ratio":
          return { id: "total_capital_ratio", columnId: "capital_ratio", label: "المجموع", value: `${totalCapitalRatio.toFixed(2)}%`, className: "text-blue-700 font-black" };
        case "ratio":
          return { id: "total_ratio", columnId: "ratio", label: "المجموع", value: `${totalRatio.toFixed(2)}%`, className: "text-emerald-700 font-black" };
        default: {
          const match = id.match(/^amount_(.+)$/);
          if (match) {
            const currCode = match[1];
            return {
              id: `total_${id}`,
              columnId: id,
              label: "الإجمالي",
              value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
              className: "text-slate-900 font-black"
            };
          }
          return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
        }
      }
    });
  }, [sortedPartners, formatAmount, enrichedColumns]);

  return (
    <TableShell
      title="سجل الشركاء"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث باسم الشريك..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable<PartnerWithRatios>
        data={sortedPartners}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="partners"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "name" || col.id === "capital_ratio" || col.id === "ratio" || col.id?.startsWith("amount_")) {
            handleSort(col.id);
          }
        }}
        onRowClick={onRowClick}
        selectedId={selectedId}
        emptyMessage={search ? "لا توجد نتائج بحث تطابق استعلامك" : "لا يوجد شركاء مسجلون حالياً"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}