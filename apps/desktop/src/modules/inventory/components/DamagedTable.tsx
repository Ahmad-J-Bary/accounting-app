import { useMemo } from "react";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime, formatNumber } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useBaseCurrencyColumns } from "@shared/hooks";
import type { DamagedItem } from "@erp/shared-types";

interface DamagedTableProps {
  items: DamagedItem[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onView?: (item: DamagedItem) => void;
  onEdit?: (item: DamagedItem) => void;
  onDelete?: (id: string) => void;
}

export function DamagedTable({
  items,
  loading,
  search,
  onSearchChange,
  selectedId,
  onView,
  onEdit,
  onDelete,
}: DamagedTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();

  const allColumns = useMemo<UnifiedColumn<DamagedItem>[]>(() => {
    const cols: UnifiedColumn<DamagedItem>[] = [
      {
        id: "id",
        header: "الرقم",
        label: "الرقم",
        accessor: (i, idx) => i.reference ? formatNumber(parseInt(i.reference) || 0) : (idx + 1).toString(),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "material_name",
        header: "المادة",
        label: "المادة",
        accessor: (i) => i.material_name || i.material_id || "",
        className: "font-bold text-slate-800"
      },
      {
        id: "quantity",
        header: "الكمية",
        label: "الكمية التالفة",
        accessor: (i) => Math.round(parseFloat(i.quantity || "0")).toString(),
        className: "tabular-nums font-black text-amber-600"
      },
    ];

    currencies.forEach(curr => {
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `cost_${curr.code}`,
        header: `الخسارة (${curr.symbol || curr.code})`,
        label: `مبلغ الخسارة (${curr.symbol || curr.code})`,
        accessor: (i) => {
          const val = parseFloat(i.cost_impact || "0");
          return val > 0 ? formatAmount(val, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-rose-600"
          : "tabular-nums font-medium text-rose-300"
      });
    });

    cols.push({
      id: "reason",
      header: "السبب",
      label: "سبب التلف",
      accessor: (i) => i.reason || "",
      className: "text-slate-500 italic"
    });
    cols.push({
      id: "damage_date",
      header: "التاريخ",
      label: "تاريخ التسجيل",
      accessor: (i) => formatDateTime(i.damage_date),
      className: "text-slate-500 tabular-nums"
    });

    if (onView || onEdit || onDelete) {
      cols.push({
        id: "actions",
        header: "إجراءات",
        label: "إجراءات",
        accessor: (i) => (
          <TableActions
            onView={onView ? () => onView(i) : undefined}
            onEdit={onEdit ? () => onEdit(i) : undefined}
            onDelete={onDelete ? () => onDelete(i.id) : undefined}
          />
        ),
      });
    }

    return cols;
  }, [formatAmount, currencies, isBaseCurrency, onView, onEdit, onDelete]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["id", "material_name", "quantity"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`cost_${curr.code}`);
      }
    });
    ids.push("reason", "damage_date");
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [currencies, isBaseCurrency, onView, onEdit, onDelete]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalCost = items.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0);
    const colIds = allColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "material_name") {
        return { id: 'count', columnId: id, label: '', value: `${items.length} سجل`, className: 'text-slate-500 font-medium' };
      }
      const costMatch = id.match(/^cost_(.+)$/);
      if (costMatch) {
        const currCode = costMatch[1];
        const isBase = isBaseCurrency(currCode);
        const sym = currencies.find(c => c.code === currCode)?.symbol || currCode;
        return {
          id: `${id}_summary`,
          columnId: id,
          label: `إجمالي الخسارة (${sym})`,
          value: totalCost > 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: isBase ? 'text-rose-600 font-black' as const : 'text-rose-300 font-bold' as const,
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: '', value: '' };
    });
  }, [items, allColumns, currencies, formatAmount, isBaseCurrency]);

  const sortFn = (a: DamagedItem, b: DamagedItem, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "material_name": comparison = (a.material_name || a.material_id || "").localeCompare(b.material_name || b.material_id || "", "ar"); break;
      case "quantity": comparison = parseFloat(a.quantity) - parseFloat(b.quantity); break;
      case "damage_date": comparison = new Date(a.damage_date).getTime() - new Date(b.damage_date).getTime(); break;
      case "cost_impact": comparison = parseFloat(a.cost_impact || "0") - parseFloat(b.cost_impact || "0"); break;
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={items}
      columns={allColumns}
      defaultVisible={defaultVisible}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالمنتج أو السبب..."
      tableId="damaged"
      sortConfig={{ field: "damage_date", direction: "desc", sortFn }}
      sortableFields={["material_name", "damage_date", "quantity", "cost_impact"]}
      selectedId={selectedId}
      onRowClick={onView}
      emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
      summary={summaryColumns}
    />
  );
}