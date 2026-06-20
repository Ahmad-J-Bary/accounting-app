import { useMemo, useState } from "react";
import { cn } from '@shared/lib/utils';
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { formatDateTime } from '@shared/lib/format';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getMovementType } from '../constants/movementTypes';

const getCleanNotes = (m: StockMovement): string => {
  const type = m.movement_type.replace('MovementType::', '');
  const rawReason = m.reason ? m.reason.trim() : '';

  if (!rawReason) return '—';

  // 1. Sales, Purchase, OpeningBalance, PurchaseCosts
  if (['Sale', 'Purchase', 'OpeningBalance', 'PurchaseCosts'].includes(type)) {
    const autoNotesRegex = /^(Sales|Purchase|OpeningBalance|PurchaseCosts)\s+بموجب\s+فاتورة\s+رقم/i;
    if (autoNotesRegex.test(rawReason)) {
      return '—';
    }
    return rawReason;
  }

  // 2. SalesReturn, PurchaseReturn
  if (['SalesReturn', 'PurchaseReturn'].includes(type)) {
    const returnRegex = /^مرتجع\s+(?:مبيعات|مشتريات)\s+رقم\s+\S+(?:\s*-\s*(.*))?$/;
    const match = rawReason.match(returnRegex);
    if (match) {
      const customNotes = match[1] ? match[1].trim() : '';
      return customNotes || '—';
    }
    return rawReason;
  }

  // 3. Adjustment
  if (type === 'Adjustment') {
    const adjRegex = /^تسوية:\s+(?:فائض|عجز)(?:\s*-\s*(.*))?$/;
    const match = rawReason.match(adjRegex);
    if (match) {
      const customNotes = match[1] ? match[1].trim() : '';
      return customNotes || '—';
    }
    return rawReason;
  }

  // 4. Damaged, Transfer, and other types
  return rawReason;
};

interface InventoryMovementsTableProps {
  movements: StockMovement[];
  loading: boolean;
  warehouses: WarehouseDto[];
  search: string;
  onSearchChange: (val: string) => void;
  selectedId?: string | null;
  onRowClick?: (movement: StockMovement) => void;
  onRowDoubleClick?: (movement: StockMovement) => void;
  transferRefs: Set<string>;
  className?: string;
}

type SortField = "date" | "type" | "product_name" | "quantity" | "reference" | "notes" | `total_cost_${string}`;

export function InventoryMovementsTable({
  movements, loading, warehouses, search, onSearchChange,
  selectedId, onRowClick, onRowDoubleClick, transferRefs, className,
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

  interface PairCostEntry {
    base: string;
    original: string;
    currency: string | null;
  }

  const materialAvgCost = useMemo(() => {
    const acc = new Map<string, { cost: number; qty: number }>();
    for (const m of movements) {
      const cfg = getMovementType(m.movement_type);
      if (!cfg.inflow) continue;
      const cost = parseFloat(m.total_cost_base || "0");
      const qty = parseFloat(m.quantity || "0");
      if (!(cost > 0) || !(qty > 0)) continue;
      const p = acc.get(m.material_id) || { cost: 0, qty: 0 };
      acc.set(m.material_id, { cost: p.cost + cost, qty: p.qty + qty });
    }
    const avg = new Map<string, number>();
    for (const [mid, { cost, qty }] of acc) avg.set(mid, cost / qty);
    return avg;
  }, [movements]);

  const pairCost = useMemo(() => {
    const map = new Map<string, PairCostEntry>();
    for (const m of movements) {
      if (!m.reference || !transferRefs.has(m.reference)) continue;
      let base = m.total_cost_base;
      let orig = m.total_cost;
      if ((!base || parseFloat(base) === 0) && (!orig || parseFloat(orig) === 0)) {
        const fromUnit = parseFloat(m.unit_cost_base || "0") * parseFloat(m.quantity || "0");
        if (fromUnit !== 0) {
          base = String(fromUnit);
          orig = m.total_cost || null;
        } else {
          const avg = materialAvgCost.get(m.material_id);
          if (avg !== undefined) {
            const qty = parseFloat(m.quantity || "0");
            if (qty > 0) { base = String(avg * qty); orig = null; }
          }
        }
      }
      const hasBase = base && parseFloat(base) !== 0;
      const hasOrig = orig && parseFloat(orig) !== 0;
      if (!hasBase && !hasOrig) continue;
      const existing = map.get(m.reference);
      if (!existing || (hasBase && !existing.base) || (hasOrig && !existing.original)) {
        map.set(m.reference, {
          base: base || existing?.base || "0",
          original: orig || existing?.original || "0",
          currency: m.original_currency || existing?.currency || null,
        });
      }
    }
    return map;
  }, [movements, transferRefs, materialAvgCost]);

  const baseCost = useMemo(() => (m: StockMovement) => {
    const own = parseFloat(m.total_cost_base || "0");
    if (own !== 0 || !m.reference || !transferRefs.has(m.reference)) return own;
    const pair = pairCost.get(m.reference);
    if (!pair) return own;
    const pb = parseFloat(pair.base);
    if (pb !== 0) return pb;
    const po = parseFloat(pair.original);
    return po !== 0 ? po : own;
  }, [pairCost, transferRefs]);

  const costInfo = useMemo(() => {
    return (m: StockMovement): { base: number; original: string | null; currency: string | null } => {
      const ownBase = parseFloat(m.total_cost_base || "0");
      const ownOrig = m.total_cost || null;
      const ownCurr = m.original_currency || null;
      if (ownBase !== 0 || !m.reference || !transferRefs.has(m.reference)) {
        return { base: ownBase, original: ownOrig, currency: ownCurr };
      }
      const pair = pairCost.get(m.reference);
      if (!pair) return { base: ownBase, original: ownOrig, currency: ownCurr };
      const pb = parseFloat(pair.base);
      if (pb !== 0) return { base: pb, original: pair.original, currency: pair.currency };
      const po = parseFloat(pair.original);
      if (po !== 0) return { base: po, original: pair.original, currency: pair.currency };
      return { base: ownBase, original: ownOrig, currency: ownCurr };
    };
  }, [pairCost, transferRefs]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: movements,
    defaultField: "date" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      if ((field as string).startsWith("total_cost_")) {
        const cmp = parseFloat(a.total_cost_base || "0") - parseFloat(b.total_cost_base || "0");
        return direction === "asc" ? cmp : -cmp;
      }
      let comparison = 0;
      switch (field) {
        case "date": comparison = new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime(); break;
        case "type": comparison = (a.movement_type || "").localeCompare(b.movement_type || "", "ar"); break;
        case "product_name": comparison = (a.material_name || "").localeCompare(b.material_name || "", "ar"); break;
        case "quantity": comparison = parseFloat(a.quantity) - parseFloat(b.quantity); break;
        case "reference": comparison = (a.reference || "").localeCompare(b.reference || "", "ar"); break;
        case "notes": comparison = getCleanNotes(a).localeCompare(getCleanNotes(b), "ar"); break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

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
          const clean = m.movement_type.replace('MovementType::', '');
          const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
          let cfg = getMovementType(m.movement_type);
          if (isTransfer && (clean === 'In' || clean === 'Out')) {
            cfg = clean === 'Out'
              ? { label: 'تحويل من', inflow: false, group: 'outflow' }
              : { label: 'تحويل إلى', inflow: true, group: 'inflow' };
          }
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
        accessor: (m) => {
          const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
          const clean = m.movement_type.replace('MovementType::', '');
          const prefix = isTransfer && clean === 'In' ? 'إلى ' :
                         isTransfer && clean === 'Out' ? 'من ' : '';
          return (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
              m.warehouse_id ? warehouseClass(m) : "bg-slate-50 text-slate-500 border-slate-200"
            )}>
              {prefix}{warehouseName(m)}
            </span>
          );
        },
      },
      {
        id: 'quantity',
        header: 'الكمية',
        label: 'الكمية',
        accessor: (m) => {
          if (m.signed_quantity != null) {
            const sq = parseFloat(m.signed_quantity);
            return (
              <span className={cn("tabular-nums font-black text-base", sq >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {sq >= 0 ? "+" : ""}{sq.toLocaleString()}
              </span>
            );
          }
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
          const info = costInfo(m);
          const showOrig = isBase && info.currency && info.original && parseFloat(info.original) !== 0 && base !== parseFloat(info.original);
          return (
            <div className="flex flex-col gap-0.5">
              <span className="tabular-nums font-medium">
                {formatAmount(base, { currencyCode: curr.code })}
              </span>
              {showOrig && (
                <span className="tabular-nums text-[10px] text-slate-400 font-medium">
                  {parseFloat(info.original).toLocaleString()} {info.currency}
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
        id: 'notes',
        header: 'ملاحظة / التوصيف / السبب',
        label: 'ملاحظة / التوصيف / السبب',
        accessor: (m) => (
          <span className="w-full text-center truncate">
            {getCleanNotes(m)}
          </span>
        ),
        className: 'text-slate-600 text-xs max-w-[240px]',
        align: 'center',
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
  }, [warehouseName, warehouseClass, currencies, formatAmount, isBaseCurrency, baseCost, transferRefs, costInfo]);

  const defaultVisible = useMemo(() => {
    const ids: string[] = ["product_name", "type", "warehouse", "quantity"];
    currencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        ids.push(`total_cost_${curr.code}`);
      }
    });
    ids.push("notes", "reference", "date");
    return ids;
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "inventory-movements-unified",
    columns: allColumns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "product_name") {
        return { id: "count", columnId: id, label: "", value: `${sortedData.length} حركة`, className: "text-slate-500 font-medium" };
      }
      if (id === "quantity") {
        return { id: "qty_spacer", columnId: id, label: "", value: "" };
      }
      if (id === "notes") {
        return { id: "notes_spacer", columnId: id, label: "", value: "" };
      }
      const costMatch = id.match(/^total_cost_(.+)$/);
      if (costMatch) {
        const currCode = costMatch[1];
        const totalCost = sortedData.reduce((s, m) => {
          const cfg = getMovementType(m.movement_type);
          const cost = baseCost(m);
          return s + (cfg.inflow ? cost : -cost);
        }, 0);
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`, columnId: id, label: "الإجمالي",
          value: totalCost !== 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: isBase ? "text-slate-900 font-black" : "text-slate-500 font-extrabold"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount, isBaseCurrency, baseCost]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث بالصنف أو المرجع..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      className={className}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={loading}
        enableResize
        tableId="inventory-movements"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (["date", "type", "product_name", "quantity", "reference", "notes"].includes(col.id) || col.id.startsWith("total_cost_")) {
            handleSort(col.id as SortField);
          }
        }}
        selectedId={selectedId}
        onRowClick={onRowClick}
        onRowDoubleClick={onRowDoubleClick}
        emptyMessage={search ? "لا توجد نتائج تطابق معايير البحث" : "لا توجد حركات مخزنية مسجلة"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
