import { useMemo } from "react";
import { cn } from '@shared/lib/utils';
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { SharedTable } from '@widgets/table-shell/SharedTable';
import type { UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useBaseCurrencyColumns } from "@shared/hooks";
import { getMovementType } from '../constants/movementTypes';

interface InventoryMovementsTableProps {
  movements: StockMovement[];
  loading: boolean;
  warehouses: WarehouseDto[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onRowClick?: (movement: StockMovement) => void;
}

type SortField = "date" | "type" | "product_name" | "quantity" | "reference";

export function InventoryMovementsTable({
  movements, loading, warehouses, search, onSearchChange,
  selectedId, onRowClick,
}: InventoryMovementsTableProps) {
  const { formatAmount, currencies } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();
  const defaultWh = useMemo(() => warehouses.find(wh => wh.is_default), [warehouses]);

  const warehouseName = useMemo(() => (m: StockMovement) => {
    if (!m.warehouse_id) return defaultWh?.name || 'بدون مستودع';
    const w = warehouses.find(wh => wh.id === m.warehouse_id);
    return w?.name || defaultWh?.name || 'بدون مستودع';
  }, [warehouses, defaultWh]);

  const warehouseClass = useMemo(() => (m: StockMovement) => {
    const w = warehouses.find(wh => wh.id === m.warehouse_id);
    return w?.is_default ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100";
  }, [warehouses]);

  const baseCost = useMemo(() => (m: StockMovement) => parseFloat(m.total_cost_base || "0"), []);

  const allColumns = useMemo<UnifiedColumn<StockMovement>[]>(() => {
    const cols: UnifiedColumn<StockMovement>[] = [
      {
        id: 'product_name',
        header: 'المادة',
        label: 'المادة',
        accessor: (m) => m.material_name || '—',
        className: 'font-bold text-slate-900'
      },
      {
        id: 'type',
        header: 'النوع',
        label: 'النوع',
        accessor: (m) => {
          const cfg = getMovementType(m.movement_type);
          return (
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
              cfg.inflow ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
              'bg-rose-50 text-rose-700 ring-rose-100'
            )}>
              {cfg.label}
            </span>
          );
        },
        align: 'center'
      },
      {
        id: 'warehouse',
        header: 'المستودع',
        label: 'المستودع',
        accessor: (m) => (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
            m.warehouse_id ? warehouseClass(m) : "bg-slate-50 text-slate-500 border-slate-200"
          )}>
            {warehouseName(m)}
          </span>
        ),
      },
      {
        id: 'quantity',
        header: 'الكمية',
        label: 'الكمية',
        accessor: (m) => {
          const cfg = getMovementType(m.movement_type);
          return (
            <span className={cn("tabular-nums font-black text-base", cfg.inflow ? "text-emerald-600" : "text-rose-600")}>
              {cfg.inflow ? "+" : "-"}{parseFloat(m.quantity).toLocaleString()}
            </span>
          );
        },
      },
    ];

    currencies.forEach(curr => {
      const sym = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `total_cost_${curr.code}`,
        header: `التكلفة (${sym})`,
        label: `التكلفة (${sym})`,
        accessor: (m) => {
          const base = baseCost(m);
          if (base === 0) return '—';
          return (
            <div className="flex flex-col gap-0.5">
              <span className="tabular-nums font-medium">
                {formatAmount(base, { currencyCode: curr.code })}
              </span>
              {isBase && m.original_currency && m.total_cost && baseCost(m) !== parseFloat(m.total_cost) && (
                <span className="tabular-nums text-[10px] text-slate-400 font-medium">
                  {parseFloat(m.total_cost).toLocaleString()} {m.original_currency}
                </span>
              )}
            </div>
          );
        },
        className: isBase
          ? "tabular-nums font-black text-slate-900"
          : "tabular-nums font-medium text-slate-400"
      });
    });

    cols.push(
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
      {
        id: 'date',
        header: 'التاريخ',
        label: 'التاريخ',
        accessor: (m) => formatDateTime(m.movement_date),
        className: 'tabular-nums text-slate-500 font-medium'
      },
    );
    return cols;
  }, [warehouseName, warehouseClass, currencies, formatAmount, isBaseCurrency, baseCost]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["product_name", "type", "warehouse", "quantity"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`total_cost_${curr.code}`);
      }
    });
    ids.push("reference", "date");
    return ids;
  }, [currencies, isBaseCurrency]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const colIds = allColumns.map(c => c.id);
    return colIds.map(id => {
      if (id === "product_name") {
        return { id: "count", columnId: id, label: "", value: `${movements.length} حركة`, className: "text-slate-500 font-medium" };
      }
      if (id === "quantity") {
        return { id: "qty_spacer", columnId: id, label: "", value: "" };
      }
      const costMatch = id.match(/^total_cost_(.+)$/);
      if (costMatch) {
        const currCode = costMatch[1];
        const totalCost = movements.reduce((s, m) => s + parseFloat(m.total_cost_base || "0"), 0);
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`, columnId: id, label: "الإجمالي",
          value: totalCost > 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: isBase ? "text-slate-900 font-black" : "text-slate-500 font-extrabold"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [movements, allColumns, formatAmount, isBaseCurrency]);

  const sortFn = (a: StockMovement, b: StockMovement, field: string, direction: 'asc' | 'desc') => {
    let comparison = 0;
    switch (field) {
      case "date": comparison = new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime(); break;
      case "type": comparison = (a.movement_type || "").localeCompare(b.movement_type || "", "ar"); break;
      case "product_name": comparison = (a.material_name || "").localeCompare(b.material_name || "", "ar"); break;
      case "quantity": comparison = parseFloat(a.quantity) - parseFloat(b.quantity); break;
      case "reference": comparison = (a.reference || "").localeCompare(b.reference || "", "ar"); break;
      default: {
        if (field.startsWith("total_cost_")) {
          comparison = parseFloat(a.total_cost_base || "0") - parseFloat(b.total_cost_base || "0");
        }
        break;
      }
    }
    return direction === "asc" ? comparison : -comparison;
  };

  return (
    <SharedTable
      data={movements}
      columns={allColumns}
      defaultVisible={defaultVisible}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالصنف أو المرجع..."
      tableId="inventory-movements"
      title="سجل الحركات"
      sortConfig={{ field: "date", direction: "desc", sortFn }}
      sortableFields={["date", "type", "product_name", "quantity", "reference"]}
      selectedId={selectedId}
      onRowClick={onRowClick}
      emptyMessage={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مخزنية مسجلة"}
      summary={summaryColumns}
    />
  );
}
