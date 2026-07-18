import { useMemo } from "react";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { formatDateTime, formatNumber } from "@shared/lib/format";

import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { TableActions } from "@widgets/table-shell/TableActions";

interface ReturnsTableProps {
  items: (SalesReturnDto | PurchaseReturnDto)[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  partnerLabel: string;
  emptyMessage?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onView?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onEdit?: (ret: SalesReturnDto | PurchaseReturnDto) => void;
  onDelete?: (id: string) => Promise<void>;
  toolbarTitle?: string;
}

export function ReturnsTable({
  items,
  loading,
  search,
  onSearchChange,
  partnerLabel,
  emptyMessage,
  selectedId,
  onSelect,
  onView,
  onEdit,
  onDelete,
}: ReturnsTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();

  // Type guards
  const isSalesReturn = (ret: SalesReturnDto | PurchaseReturnDto): ret is SalesReturnDto => {
    return 'customer_id' in ret;
  };
  const isPurchaseReturn = (ret: SalesReturnDto | PurchaseReturnDto): ret is PurchaseReturnDto => {
    return 'supplier_id' in ret;
  };

  const allColumns = useMemo<UnifiedColumn<SalesReturnDto | PurchaseReturnDto>[]>(() => {
    const cols: UnifiedColumn<SalesReturnDto | PurchaseReturnDto>[] = [
      {
        id: "return_number",
        header: "الرقم",
        label: "رقم المرتجع",
        accessor: (ret) => formatNumber(parseInt(ret.return_number) || 0),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "partner_name",
        header: partnerLabel,
        label: partnerLabel,
        accessor: (ret) => {
          if (isSalesReturn(ret)) return ret.customer_name || "";
          if (isPurchaseReturn(ret)) return ret.supplier_name || "";
          return "";
        },
        className: "font-bold text-slate-800"
      },
      ...currencies.map(curr => {
        const isBase = isBaseCurrency(curr.code);
        return {
          id: `total_amount_${curr.code}`,
          header: `الإجمالي (${curr.symbol || curr.code})`,
          label: `الإجمالي (${curr.symbol || curr.code})`,
          accessor: (ret: SalesReturnDto | PurchaseReturnDto) => {
            const val = parseFloat(ret.total_amount || "0");
            if (val === 0) return "";
            return formatAmount(val, { currencyCode: curr.code });
          },
          className: isBase
            ? "tabular-nums font-black text-slate-900"
            : "tabular-nums font-medium text-slate-400"
        };
      }),
      {
        id: "notes",
        header: "التوصيف",
        label: "التوصيف",
        accessor: (ret) => ret.notes || "",
        className: "text-slate-500 italic"
      },
      {
        id: "return_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (ret) => formatDateTime(ret.return_date),
        className: "text-slate-500 tabular-nums"
      },
      ...((onView || onEdit || onDelete) ? [{
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (ret: SalesReturnDto | PurchaseReturnDto) => {
          return (
            <TableActions
              onView={onView ? () => onView(ret) : undefined}
              onEdit={onEdit ? () => onEdit(ret) : undefined}
              onDelete={onDelete ? () => {
                if (window.confirm("هل أنت متأكد من حذف هذا المرتجع؟")) {
                  onDelete(ret.id);
                }
              } : undefined}
              align="start"
            />
          );
        }
      }] : []),
    ];
    return cols;
  }, [currencies, formatAmount, partnerLabel, onView, onEdit, onDelete, isBaseCurrency]);

  // Default visible: only base currency's total column shown
  const defaultVisible = useMemo(() => {
    const baseCode = baseCurrency?.code;
    const ids = [
      "return_number",
      "notes",
      "partner_name",
      ...(baseCode ? [`total_amount_${baseCode}`] : []),
      "return_date",
    ];
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [baseCurrency, onView, onEdit, onDelete]);

  type SortField = "return_number" | "notes" | "partner_name" | "total_amount" | "return_date";

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
        case "notes":
          comparison = (a.notes || "").localeCompare(b.notes || "", "ar");
          break;
        case "partner_name": {
          const aName = isSalesReturn(a) ? a.customer_name || "" : isPurchaseReturn(a) ? a.supplier_name || "" : "";
          const bName = isSalesReturn(b) ? b.customer_name || "" : isPurchaseReturn(b) ? b.supplier_name || "" : "";
          comparison = aName.localeCompare(bName, "ar");
          break;
        }
        case "total_amount": {
          comparison = parseFloat(a.total_amount || "0") - parseFloat(b.total_amount || "0");
          break;
        }
        case "return_date":
          comparison = new Date(a.return_date).getTime() - new Date(b.return_date).getTime();
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "returns-unified",
    columns: allColumns,
    defaultVisible,
  });

  const baseTotal = useMemo(() =>
    items.reduce((s, ret) => s + (parseFloat(ret.total_amount || "0") || 0), 0),
    [items]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const colIds = enrichedColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "return_number") {
        return { id: "count", columnId: "return_number", label: "", value: `${sortedData.length} مرتجع`, className: "text-slate-500 font-medium" };
      }
      const match = id.match(/^total_amount_(.+)$/);
      if (match) {
        const currCode = match[1];
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`,
          columnId: id,
          label: "الإجمالي",
          value: baseTotal > 0 ? formatAmount(baseTotal, { currencyCode: currCode }) : "—",
          className: isBase
            ? "font-black text-slate-900"
            : "font-extrabold text-slate-500"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, baseTotal, formatAmount, sortedData, isBaseCurrency]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم المرتجع أو الاسم..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
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
          else if (col.id === "return_date") handleSort("return_date");
          else if (col.id === "notes") handleSort("notes");
          else if (col.id === "partner_name") handleSort("partner_name");
          else if (col.id.startsWith("total_amount_")) handleSort("total_amount");
        }}
        onRowClick={(ret) => onSelect?.(ret.id)}
        selectedId={selectedId}
        summary={summaryColumns}
        emptyMessage={emptyMessage ?? "لا توجد بيانات"}
      />
    </TableShell>
  );
}

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
