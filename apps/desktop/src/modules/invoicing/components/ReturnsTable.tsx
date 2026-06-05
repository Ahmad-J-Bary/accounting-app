import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { TableActions } from "@widgets/table-shell/TableActions";
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable } from "@shared/hooks";
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
        accessor: (i) => i.return_number,
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "material_name",
        header: "المادة",
        label: "المادة",
        accessor: (i) => i.material_name ?? "",
        className: "font-bold text-slate-800"
      },
      {
        id: "partner_name",
        header: partnerLabel,
        label: partnerLabel,
        accessor: (i) => i.partner_name || "",
        className: "font-bold text-slate-700"
      },
      ...currencies.map(curr => ({
        id: `unit_price_${curr.code}`,
        header: `السعر (${curr.symbol || curr.code})`,
        label: `السعر الفردي (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.unit_price || "0");
          if (val === 0) return "";
          return formatAmount(val, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      })),
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية المرتجعة",
        accessor: (i) => Math.round(parseFloat(i.quantity || "0")).toString(),
        className: "tabular-nums font-black text-slate-900"
      },
      {
        id: "unit_id",
        header: "الوحدة",
        label: "الوحدة",
        accessor: (i) => {
          const unitName = materials.find(m => m.id === i.material_id)?.units.find(u => u.id === i.unit_id)?.name;
          return unitName || "";
        },
        className: "text-slate-500"
      },
      ...currencies.map(curr => ({
        id: `line_total_${curr.code}`,
        header: `المجموع (${curr.symbol || curr.code})`,
        label: `المجموع (${curr.symbol || curr.code})`,
        accessor: (i: ReturnLineRow) => {
          const val = parseFloat(i.line_total || "0");
          if (val === 0) return "";
          return formatAmount(val, { currencyCode: curr.code });
        },
        className: "tabular-nums font-black text-slate-900"
      })),
      {
        id: "return_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (i) => formatDateTime(i.return_date),
        className: "text-slate-500 tabular-nums"
      },
      {
        id: "notes",
        header: "ملاحظة",
        label: "ملاحظة",
        accessor: (i) => i.notes || "",
        className: "text-slate-500 italic"
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
        ) : null
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

  type SortField = "return_number" | "material_name" | "partner_name" | "unit_price" | "quantity" | "line_total" | "return_date" | "notes";

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: items,
    defaultField: "return_date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "return_number":
          comparison = (a.return_number || "").localeCompare(b.return_number || "", "ar", { numeric: true });
          break;
        case "material_name":
          comparison = (a.material_name || "").localeCompare(b.material_name || "", "ar");
          break;
        case "partner_name":
          comparison = (a.partner_name || "").localeCompare(b.partner_name || "", "ar");
          break;
        case "unit_price":
          comparison = parseFloat(a.unit_price || "0") - parseFloat(b.unit_price || "0");
          break;
        case "quantity":
          comparison = parseFloat(a.quantity || "0") - parseFloat(b.quantity || "0");
          break;
        case "line_total":
          comparison = parseFloat(a.line_total || "0") - parseFloat(b.line_total || "0");
          break;
        case "return_date":
          comparison = new Date(a.return_date).getTime() - new Date(b.return_date).getTime();
          break;
        case "notes":
          comparison = (a.notes || "").localeCompare(b.notes || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

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
      if (id === "return_number") {
        return { id: "count", columnId: "return_number", label: "", value: `${sortedData.length} مرتجع`, className: "text-slate-500 font-medium" };
      }
      const match = id.match(/^line_total_(.+)$/);
      if (match) {
        const currCode = match[1];
        return { id: `${id}_summary`, columnId: id, label: "الإجمالي", value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—", className: "font-black text-slate-900" };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, baseTotal, formatAmount, sortedData]);

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
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="returns"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (col.id === "return_number") handleSort("return_number");
          else if (col.id === "material_name") handleSort("material_name");
          else if (col.id === "partner_name") handleSort("partner_name");
          else if (col.id === "quantity") handleSort("quantity");
          else if (col.id === "return_date") handleSort("return_date");
          else if (col.id === "notes") handleSort("notes");
          else if (col.id.startsWith("line_total_")) handleSort("line_total");
          else if (col.id.startsWith("unit_price_")) handleSort("unit_price");
        }}
        onRowClick={(i) => onSelect?.(i.return_id || null)}
        selectedId={selectedId}
        summary={summaryColumns}
        emptyMessage={emptyMessage ?? "لا توجد بيانات"}
      />
    </TableShell>
  );
}
