import { useMemo, useCallback } from "react";
import { cn } from '@shared/lib/utils';
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useExportSetup, useUnifiedColumns, useSortable, useBaseCurrencyColumns } from "@shared/hooks";
import { formatDateTime, formatNumber, toLocalString } from '@shared/lib/format';
import { dateCol, executeExport, currencyAmountCols } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { getMovementType } from '../constants/movementTypes';
import { Download } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveWarehouseDisplayName } from "@shared/lib/system-labels";

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
  filterBar?: React.ReactNode;
  selectedId?: string | null;
  onRowClick?: (movement: StockMovement) => void;
  onRowDoubleClick?: (movement: StockMovement) => void;
  transferRefs: Set<string>;
  className?: string;
}

type SortField = "date" | "type" | "product_name" | "quantity" | "reference" | "notes" | `total_cost_${string}`;

export function InventoryMovementsTable({
  movements, loading, warehouses, search, onSearchChange,
  filterBar,
  selectedId, onRowClick, onRowDoubleClick, transferRefs, className,
}: InventoryMovementsTableProps) {
  const { t } = useLocalization();
  const { isBaseCurrency, currencySuffix: cs, hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { exportData, rateMap, formatAmount, baseCode, currencies, ratesSheet, currencyMode } = useExportSetup();
  const defaultWh = useMemo(() => warehouses.find(wh => wh.is_default), [warehouses]);

  const warehouseName = useMemo(() => (m: StockMovement) => {
    if (!m.warehouse_id) {
      return defaultWh ? resolveWarehouseDisplayName(defaultWh, t) : t("movements.noWarehouse", { namespace: "inventory" });
    }
    const w = warehouses.find(wh => wh.id === m.warehouse_id);
    if (w) {
      return resolveWarehouseDisplayName(w, t);
    }
    return defaultWh ? resolveWarehouseDisplayName(defaultWh, t) : t("movements.noWarehouse", { namespace: "inventory" });
  }, [warehouses, defaultWh, t]);

  const warehouseClass = useMemo(() => (m: StockMovement) => {
    const w = warehouses.find(wh => wh.id === m.warehouse_id);
    return w?.is_default ? "bg-success/10 text-success border-success/10" : "bg-primary/10 text-primary border-primary/20";
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
        id: 'reference',
        header: t("movements.columns.reference", { namespace: "inventory" }),
        label: t("movements.columns.reference", { namespace: "inventory" }),
        accessor: (m) => m.reference ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-primary/10 text-primary border border-primary/20">
            {formatNumber(parseInt(m.reference) || 0)}
          </span>
        ) : '—',
      },
      {
        id: 'product_name',
        header: t("movements.columns.material", { namespace: "inventory" }),
        label: t("movements.columns.material", { namespace: "inventory" }),
        accessor: (m) => m.material_name || '—',
        className: 'font-bold text-foreground'
      },
      {
        id: 'type',
        header: t("movements.columns.type", { namespace: "inventory" }),
        label: t("movements.columns.type", { namespace: "inventory" }),
        accessor: (m) => {
          const clean = m.movement_type.replace('MovementType::', '');
          const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
          let cfg = getMovementType(m.movement_type);
          if (isTransfer && (clean === 'In' || clean === 'Out')) {
            cfg = clean === 'Out'
              ? { label: t("movementTypes.TransferFrom", { namespace: "inventory" }), inflow: false, group: 'outflow' }
              : { label: t("movementTypes.TransferTo", { namespace: "inventory" }), inflow: true, group: 'inflow' };
          }
          return (
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
              cfg.inflow ? 'bg-success/10 text-success ring-success/20' :
              'bg-destructive/10 text-destructive ring-destructive/20'
            )}>
              {cfg.label}
            </span>
          );
        },
        align: 'center'
      },
      {
        id: 'warehouse',
        header: t("movements.columns.warehouse", { namespace: "inventory" }),
        label: t("movements.columns.warehouse", { namespace: "inventory" }),
        accessor: (m) => {
          const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
          const clean = m.movement_type.replace('MovementType::', '');
          const prefix = isTransfer && clean === 'In' ? t("movements.toPrefix", { namespace: "inventory" }) :
                         isTransfer && clean === 'Out' ? t("movements.fromPrefix", { namespace: "inventory" }) : '';
          return (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
              m.warehouse_id ? warehouseClass(m) : "bg-muted text-muted-foreground border-muted"
            )}>
              {prefix}{warehouseName(m)}
            </span>
          );
        },
      },
      {
        id: 'quantity',
        header: t("movements.columns.quantity", { namespace: "inventory" }),
        label: t("movements.columns.quantity", { namespace: "inventory" }),
        accessor: (m) => {
          if (m.signed_quantity != null) {
            const sq = parseFloat(m.signed_quantity);
            return (
              <span className={cn("tabular-nums font-black text-base", sq >= 0 ? "text-success" : "text-destructive")}>
                {sq >= 0 ? "+" : ""}{toLocalString(sq)}
              </span>
            );
          }
          const cfg = getMovementType(m.movement_type);
          return (
            <span className={cn("tabular-nums font-black text-base", cfg.inflow ? "text-success" : "text-destructive")}>
              {cfg.inflow ? "+" : "-"}{toLocalString(parseFloat(m.quantity))}
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
        header: `${t("movements.columns.cost", { namespace: "inventory" })}${cs(sym)}`,
        label: `${t("movements.columns.cost", { namespace: "inventory" })}${cs(sym)}`,
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
                <span className="tabular-nums text-[10px] text-muted-foreground font-medium">
                  {toLocalString(parseFloat(info.original ?? "0"))} {info.currency}
                </span>
              )}
            </div>
          );
        },
        className: isBase
          ? "tabular-nums font-black text-foreground"
          : "tabular-nums font-medium text-muted-foreground"
      });
    });

    cols.push(
      {
        id: 'notes',
        header: t("movements.columns.notes", { namespace: "inventory" }),
        label: t("movements.columns.notes", { namespace: "inventory" }),
        accessor: (m) => (
          <span className="w-full text-center truncate">
            {getCleanNotes(m)}
          </span>
        ),
        className: 'text-foreground text-xs max-w-[240px]',
        align: 'center',
      },
      {
        id: 'date',
        header: t("movements.columns.date", { namespace: "inventory" }),
        label: t("movements.columns.date", { namespace: "inventory" }),
        accessor: (m) => formatDateTime(m.movement_date),
        className: 'tabular-nums text-muted-foreground font-medium'
      },
    );
    return cols;
  }, [warehouseName, warehouseClass, currencies, formatAmount, isBaseCurrency, baseCost, transferRefs, costInfo, cs, t]);

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

  const handleExport = useCallback(async () => {
    const summary: Record<string, string | null> = { quantity: 'subtotal' };

    const costColumns = currencyAmountCols("total_cost", t("movements.columns.cost", { namespace: "inventory" }), (row) => baseCost(row as unknown as StockMovement), currencies, formatAmount, "", true, hasSecondaryCurrencies, currencyMode, baseCode, rateMap);
    const costColMap = new Map(costColumns.map(c => [c.id, c]));

    const exportColumns: ExcelExportColumn[] = enrichedColumns.map((col) => {
      const isCostCol = /^total_cost_/.test(col.id);

      if (isCostCol) {
        const currCode = col.id.replace('total_cost_', '');
        summary[col.id] = `SUMPRODUCT(SIGN({col('quantity')}{firstRow}:{col('quantity')}{lastRow}), {col('total_cost_${currCode}')}{firstRow}:{col('total_cost_${currCode}')}{lastRow})`;
      }

      if (col.id === "date") {
        return dateCol("date", col.label || String(col.header || ""), (row) => {
          const m = row as unknown as StockMovement;
          return m.movement_date;
        });
      }

      if (col.id.startsWith("total_cost_")) {
        const costCol = costColMap.get(col.id);
        return {
          ...costCol,
          label: col.label || String(col.header || ""),
          hidden: col.visible === false,
        };
      }

      return {
        id: col.id,
        label: col.label || String(col.header || ""),
        hidden: col.visible === false,
        width: 15,
        accessor: (row) => {
          const m = row as unknown as StockMovement;
          if (col.id === "reference") return parseInt(m.reference ?? "0", 10) || 0;
          if (col.id === "product_name") return String(m.material_name ?? "");
          if (col.id === "type") {
            const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
            const clean = m.movement_type.replace('MovementType::', '');
            if (isTransfer && clean === 'Out') return t("movementTypes.TransferFrom", { namespace: "inventory" });
            if (isTransfer && clean === 'In') return t("movementTypes.TransferTo", { namespace: "inventory" });
            return getMovementType(m.movement_type).label;
          }
          if (col.id === "warehouse") {
            const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
            const clean = m.movement_type.replace('MovementType::', '');
            const prefix = isTransfer && clean === 'In' ? t("movements.toPrefix", { namespace: "inventory" }) : isTransfer && clean === 'Out' ? t("movements.fromPrefix", { namespace: "inventory" }) : '';
            return prefix + warehouseName(m);
          }
          if (col.id === "quantity") {
            if (m.signed_quantity != null) return parseFloat(m.signed_quantity) || 0;
            const qty = parseFloat(m.quantity) || 0;
            const cfg = getMovementType(m.movement_type);
            return cfg.inflow ? qty : -qty;
          }
          if (col.id === "notes") return getCleanNotes(m);
          return "";
        },
        ...(col.id === "quantity" ? { numeric: true, decimalPlaces: 2 } : {}),
      };
    });

    await executeExport(exportData, {
      sheetName: t("movements.sheetName", { namespace: "inventory" }),
      filename: t("movements.sheetName", { namespace: "inventory" }),
      data: sortedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary,
      summaryLabel: t("labels.summary", { namespace: "inventory" }),
      currencyRatesSheet: ratesSheet,
    });
  }, [enrichedColumns, sortedData, warehouseName, baseCost, transferRefs, exportData, baseCode, rateMap, ratesSheet, currencies, formatAmount, hasSecondaryCurrencies, currencyMode, t]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "product_name") {
        return { id: "count", columnId: id, label: "", value: `${sortedData.length} ${t("labels.movement", { namespace: "inventory", count: sortedData.length })}`, className: "text-muted-foreground font-medium" };
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
          const cost = baseCost(m);
          let sign = 0;
          if (m.signed_quantity != null) {
            sign = parseFloat(m.signed_quantity) >= 0 ? 1 : -1;
          } else {
            sign = getMovementType(m.movement_type).inflow ? 1 : -1;
          }
          return s + sign * cost;
        }, 0);
        const isBase = isBaseCurrency(currCode);
        return {
          id: `${id}_summary`, columnId: id, label: t("labels.total", { namespace: "inventory" }),
          value: totalCost !== 0 ? formatAmount(totalCost, { currencyCode: currCode }) : "—",
          className: isBase ? "text-foreground font-black" : "text-muted-foreground font-extrabold"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, formatAmount, isBaseCurrency, baseCost, t]);

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("movements.searchPlaceholder", { namespace: "inventory" })}
      filterBar={filterBar}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      className={className}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-muted bg-white text-foreground hover:bg-muted"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 ml-1.5 text-muted-foreground" />
          {t("movements.columns.exportToExcel", { namespace: "inventory" })}
        </Button>
      }
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
        emptyMessage={search ? t("movements.emptySearch", { namespace: "inventory" }) : t("movements.empty", { namespace: "inventory" })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}
