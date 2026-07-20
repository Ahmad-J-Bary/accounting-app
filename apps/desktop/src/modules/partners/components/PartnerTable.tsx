import { useMemo, type ReactNode } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { toFixed } from "@shared/lib/format";
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
  filterBar?: ReactNode;
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
  onRowClick,
  filterBar
}: PartnerTableProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
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
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `amount_${curr.code}`,
        header: `رأس المال ${cs(symbol)}`,
        label: `رأس المال ${cs(symbol)}`,
        accessor: (p: PartnerWithRatios) => {
          if (p.displayAmountBase === 0) return "";
          return formatAmount(p.displayAmountBase, { currencyCode: curr.code });
        },
        className: isBase
          ? "tabular-nums font-black text-slate-900"
          : "tabular-nums font-medium text-slate-400"
      });
    });

    cols.push(
      {
        id: "capital_ratio",
        header: "نسبة رأس المال",
        label: "نسبة المساهمة في رأس المال",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black tabular-nums">
            {toFixed(p.calculatedCapitalRatio, 2)}%
          </span>
        ),
      },
      {
        id: "ratio",
        header: "نسبة الأرباح",
        label: "نسبة توزيع الأرباح",
        accessor: (p: PartnerWithRatios) => (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black tabular-nums">
            {toFixed(p.calculatedRatio, 2)}%
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
  }, [currencies, formatAmount, onView, onEdit, onDelete, onJournal, onDocument, isBaseCurrency, cs]);

  // Default visible: only base currency's amount column is shown; secondary amounts are hidden.
  const defaultVisible = useMemo(() => {
    const ids: string[] = ["name"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`amount_${curr.code}`);
      }
    });
    ids.push("capital_ratio", "ratio", "actions");
    return ids;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "partners-unified",
    columns: allColumns,
    defaultVisible,
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
          return { id: "total_capital_ratio", columnId: "capital_ratio", label: "المجموع", value: `${toFixed(totalCapitalRatio, 2)}%`, className: "text-blue-700 font-black" };
        case "ratio":
          return { id: "total_ratio", columnId: "ratio", label: "المجموع", value: `${toFixed(totalRatio, 2)}%`, className: "text-emerald-700 font-black" };
        default: {
          const match = id.match(/^amount_(.+)$/);
          if (match) {
            const currCode = match[1];
            const isBase = isBaseCurrency(currCode);
            return {
              id: `total_${id}`,
              columnId: id,
              label: "الإجمالي",
              value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
              className: isBase
                ? "text-slate-900 font-black"
                : "text-slate-500 font-extrabold"
            };
          }
          return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
        }
      }
    });
  }, [sortedPartners, formatAmount, enrichedColumns, isBaseCurrency]);

  return (
    <TableShell
      title="سجل الشركاء"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث باسم الشريك..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      filterBar={filterBar}
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