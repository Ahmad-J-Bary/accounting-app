import { useMemo } from "react";
import { cn } from '@shared/lib/utils';
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatNumber, formatDateTime } from '@shared/lib/format';

interface InventoryMovementsTableProps {
  movements: StockMovement[];
  loading: boolean;
  warehouses: WarehouseDto[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onRowClick?: (movement: StockMovement) => void;
}

type SortField = "date" | "type" | "product_name" | "quantity" | "total_cost" | "reference";

export function InventoryMovementsTable({
  movements, loading, warehouses, search, onSearchChange,
  selectedId, onRowClick,
}: InventoryMovementsTableProps) {
  const allColumns = useMemo<UnifiedColumn<StockMovement>[]>(() => {
    const cols: UnifiedColumn<StockMovement>[] = [
      {
        id: 'date',
        header: 'التاريخ',
        label: 'التاريخ',
        accessor: (m) => formatDateTime(m.date),
        className: 'tabular-nums text-slate-500 font-medium'
      },
      {
        id: 'type',
        header: 'النوع',
        label: 'النوع',
        accessor: (m) => {
          const typeMap: Record<string, string> = {
            'In': 'وارد',
            'Out': 'صادر',
            'Adjustment': 'تسوية',
            'Production': 'تصنيع',
            'Damaged': 'تالف'
          };
          const isInflow = m.movement_type === 'In';
          return (
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
              isInflow ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
              m.movement_type === 'Out' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
              'bg-blue-50 text-blue-700 ring-blue-100'
            )}>
              {typeMap[m.movement_type] || m.movement_type}
            </span>
          );
        },
        align: 'center'
      },
      {
        id: 'warehouse',
        header: 'المستودع',
        label: 'المستودع',
        accessor: (m) => {
          const defaultWh = warehouses.find(wh => wh.is_default);
          if (!m.warehouse_id) return defaultWh ? (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
              "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              {defaultWh.name}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-100">
              بدون مستودع
            </span>
          );
          const w = warehouses.find(wh => wh.id === m.warehouse_id);
          return w ? (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
              w.is_default ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100"
            )}>
              {w.name}
            </span>
          ) : defaultWh ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
              {defaultWh.name}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-100">
              بدون مستودع
            </span>
          );
        },
      },
      {
        id: 'product_name',
        header: 'الصنف / المنتج',
        label: 'الصنف / المنتج',
        accessor: 'product_name',
        className: 'font-bold text-slate-900'
      },
      {
        id: 'quantity',
        header: 'الكمية',
        label: 'الكمية',
        accessor: (m) => (
          <span className={cn("tabular-nums font-black text-base", parseFloat(m.quantity) < 0 ? "text-rose-600" : "text-emerald-600")}>
            {parseFloat(m.quantity) > 0 ? "+" : ""}{formatNumber(parseFloat(m.quantity))}
          </span>
        ),
      },
      {
        id: 'total_cost',
        header: 'التكلفة (إجمالي)',
        label: 'التكلفة (إجمالي)',
        accessor: (m) => m.total_cost ? `${formatNumber(parseFloat(m.total_cost))} ₴` : '—',
        className: 'tabular-nums text-slate-600 font-medium'
      },
      {
        id: 'reference',
        header: 'المرجع',
        label: 'المرجع',
        accessor: (m) => m.reference ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-100">
            {m.reference}
          </span>
        ) : '—',
      },
      ...(onRowClick ? [{
        id: 'actions' as const,
        header: 'إجراءات',
        label: 'إجراءات',
        accessor: (m: StockMovement) => (
          <TableActions onView={() => onRowClick(m)} />
        ),
      }] : []),
    ];
    return cols;
  }, [warehouses, onRowClick]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalQty = movements.reduce((s, m) => s + Math.abs(parseFloat(m.quantity)), 0);
    const totalCost = movements.reduce((s, m) => s + parseFloat(m.total_cost || "0"), 0);
    return [
      { id: "count", columnId: "product_name", label: "", value: `${movements.length} حركة`, className: "text-slate-500 font-medium" },
      { id: "qty_summary", columnId: "quantity", label: "الإجمالي", value: formatNumber(totalQty), className: "font-bold text-slate-700" },
      { id: "cost_summary", columnId: "total_cost", label: "", value: totalCost > 0 ? `${formatNumber(totalCost)} ₴` : "—", className: "font-bold text-slate-700" },
    ];
  }, [movements]);

  const sortFn = (a: StockMovement, b: StockMovement, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "date": comparison = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      case "type": comparison = (a.movement_type || "").localeCompare(b.movement_type || "", "ar"); break;
      case "product_name": comparison = (a.product_name || "").localeCompare(b.product_name || "", "ar"); break;
      case "quantity": comparison = parseFloat(a.quantity) - parseFloat(b.quantity); break;
      case "total_cost": comparison = parseFloat(a.total_cost || "0") - parseFloat(b.total_cost || "0"); break;
      case "reference": comparison = (a.reference || "").localeCompare(b.reference || "", "ar"); break;
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={movements}
      columns={allColumns}
      defaultVisible={["date", "type", "warehouse", "product_name", "quantity", "total_cost", "reference", "actions"]}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالصنف أو المرجع..."
      tableId="inventory-movements"
      title="سجل الحركات"
      sortConfig={{ field: "date", direction: "desc", sortFn }}
      sortableFields={["date", "type", "product_name", "quantity", "total_cost", "reference"]}
      selectedId={selectedId}
      onRowClick={onRowClick}
      emptyMessage={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مخزنية مسجلة"}
      summary={summaryColumns}
    />
  );
}
