import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { TableActions } from "@widgets/table-shell/TableActions";
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns } from "@shared/hooks";
import type { MaterialDto } from "@erp/shared-types";

export type ReturnLineRow = {
  return_id?: string;
  return_number: string;
  material_name?: string;
  material_id?: string;
  partner_name?: string;
  unit_id?: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  return_date: string;
  notes?: string;
};

interface ReturnsTableProps {
  items: ReturnLineRow[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  materials: MaterialDto[];
  partnerLabel: string;
  emptyMessage?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onView?: (returnId: string) => void;
  onEdit?: (returnId: string) => void;
  onDelete?: (returnId: string) => void;
}

export function ReturnsTable({ items, loading, search, onSearchChange, materials, partnerLabel, emptyMessage, selectedId, onSelect, onView, onEdit, onDelete }: ReturnsTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();

  const allColumns = useMemo<UnifiedColumn<ReturnLineRow>[]>(() => {
    const cols: UnifiedColumn<ReturnLineRow>[] = [
      {
        id: "return_number",
        header: "الرقم",
        label: "الرقم",
        accessor: (i) => <span className="font-bold text-slate-500 font-mono">{i.return_number}</span>,
        className: "text-center",
      },
      {
        id: "material_name",
        header: "المادة",
        label: "المادة",
        accessor: (i) => <span className="font-medium text-slate-800">{i.material_name ?? "—"}</span>,
        className: "",
      },
      {
        id: "partner_name",
        header: partnerLabel,
        label: partnerLabel,
        accessor: (i) => <span className="font-medium text-slate-700">{i.partner_name || "—"}</span>,
        className: "",
      },
      ...currencies.map(curr => ({
        id: `unit_price_${curr.code}`,
        header: `السعر (${curr.symbol || curr.code})`,
        label: `السعر الفردي (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.unit_price || "0");
          if (val === 0) return "—";
          return formatAmount(val, { currencyCode: curr.code });
        },
        className: "tabular-nums",
      })),
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية المرتجعة",
        accessor: (i) => <span className="tabular-nums font-bold">{Math.round(parseFloat(i.quantity))}</span>,
        className: "",
      },
      {
        id: "unit_id",
        header: "الوحدة",
        label: "الوحدة",
        accessor: (i) => {
          const unitName = materials.find(m => m.id === i.material_id)?.units.find(u => u.id === i.unit_id)?.name;
          return <span className="text-slate-500">{unitName || "—"}</span>;
        },
        className: "",
      },
      ...currencies.map(curr => ({
        id: `line_total_${curr.code}`,
        header: `المجموع (${curr.symbol || curr.code})`,
        label: `المجموع (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.line_total || "0");
          if (val === 0) return "—";
          return formatAmount(val, { currencyCode: curr.code });
        },
        className: "tabular-nums font-bold",
      })),
      {
        id: "return_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (i) => formatDateTime(i.return_date),
        className: "",
      },
      {
        id: "notes",
        header: "ملاحظة",
        label: "ملاحظة",
        accessor: (i) => <span className="text-slate-400 text-xs">{i.notes || "-"}</span>,
        className: "",
      },
      {
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (i) => i.return_id ? (
          <TableActions
            onView={onView ? () => onView(i.return_id!) : undefined}
            onEdit={onEdit ? () => onEdit(i.return_id!) : undefined}
            onDelete={onDelete ? () => onDelete(i.return_id!) : undefined}
          />
        ) : null,
        className: "w-[80px]",
      },
    ];
    return cols;
  }, [currencies, formatAmount, partnerLabel, materials, onView, onEdit, onDelete]);

  const defaultVisible = useMemo(() => {
    const baseCode = baseCurrency?.code;
    return [
      "return_number",
      "material_name",
      "partner_name",
      ...(baseCode ? [`unit_price_${baseCode}`] : []),
      "quantity",
      "unit_id",
      ...(baseCode ? [`line_total_${baseCode}`] : []),
      "return_date",
      "notes",
    ];
  }, [baseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "returns-unified",
    columns: allColumns,
    defaultVisible,
  });

  const baseTotal = useMemo(() =>
    items.reduce((s, i) => s + (parseFloat(i.line_total || "0") || 0), 0),
  [items]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      const match = id.match(/^line_total_(.+)$/);
      if (match) {
        const currCode = match[1];
        return { id: `${id}_summary`, columnId: id, label: "الإجمالي", value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—", className: "font-black text-slate-900" };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, baseTotal, formatAmount]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالرقم أو المادة..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      showToolbar={true}
    >
      <UnifiedTable
        data={items}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="returns"
        onRowClick={(i) => onSelect?.(i.return_id || null)}
        selectedId={selectedId}
        summary={summaryColumns}
        emptyMessage={emptyMessage ?? "لا توجد بيانات"}
      />
    </TableShell>
  );
}
