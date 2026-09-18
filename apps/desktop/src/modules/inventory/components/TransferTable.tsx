import { useMemo, useState, useEffect, useCallback } from "react";
import { Eye, Edit, Trash2 } from "lucide-react";
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { formatDateTime, formatNumber, toLocalString } from '@shared/lib/format';
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { RowActionDescriptor } from "@shared/types/row-actions";

export interface TransferRow {
  reference: string;
  material_id: string;
  material_name: string;
  source_warehouse_id: string;
  source_warehouse_name: string;
  dest_warehouse_id: string;
  dest_warehouse_name: string;
  quantity: string;
  notes: string;
  transfer_date: string;
}

interface TransferTableProps {
  movements: StockMovement[];
  warehouses: WarehouseDto[];
  className?: string;
  onView?: (row: TransferRow) => void;
  onEdit?: (row: TransferRow) => void;
  onDelete?: (reference: string) => void;
  onExportExcel?: () => void;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

type TransferSortField = "date" | "material_name" | "reference" | "quantity" | "notes";

const sortFn = (a: TransferRow, b: TransferRow, field: TransferSortField, direction: 'asc' | 'desc') => {
  const cmp = field === "date"
    ? new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime()
    : String(a[field as keyof TransferRow] ?? "").localeCompare(String(b[field as keyof TransferRow] ?? ""), "ar");
  return direction === "asc" ? cmp : -cmp;
};

export function TransferTable({ movements, warehouses, className, onView, onEdit, onDelete, onExportExcel, onVisibleColumnsChange }: TransferTableProps) {
  const { t } = useLocalization();
  const [search, setSearch] = useState("");
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  const rows = useMemo<TransferRow[]>(() => {
    const groups = new Map<string, { out?: StockMovement; in?: StockMovement }>();
    for (const m of movements) {
      if (!m.reference) continue;
      let g = groups.get(m.reference);
      if (!g) { g = {}; groups.set(m.reference, g); }
      const clean = m.movement_type.replace('MovementType::', '');
      if (clean === 'Out') g.out = m;
      else if (clean === 'In') g.in = m;
    }
    const result: TransferRow[] = [];
    for (const [ref, pair] of groups) {
      const out = pair.out;
      const inn = pair.in;
      if (!out || !inn) continue;
      const sourceName = warehouses.find(w => w.id === out.warehouse_id)?.name || out.warehouse_id || '';
      const destName = warehouses.find(w => w.id === inn.warehouse_id)?.name || inn.warehouse_id || '';
      result.push({
        reference: ref,
        material_id: out.material_id,
        material_name: out.material_name || inn.material_name || '',
        source_warehouse_id: out.warehouse_id || '',
        source_warehouse_name: sourceName,
        dest_warehouse_id: inn.warehouse_id || '',
        dest_warehouse_name: destName,
        quantity: out.quantity,
        notes: out.reason || inn.reason || '',
        transfer_date: out.movement_date,
      });
    }
    result.sort((a, b) => new Date(b.transfer_date).getTime() - new Date(a.transfer_date).getTime());
    return result;
  }, [movements, warehouses]);

  const handleRowClick = useMemo(() => {
    if (!onView) return undefined;
    return (row: TransferRow) => {
      setSelectedRef(row.reference === selectedRef ? null : row.reference);
      onView(row);
    };
  }, [onView, selectedRef]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.material_name.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable<TransferRow, TransferSortField>({
    data: filteredRows,
    defaultField: "date",
    defaultDirection: "desc",
    sortFn,
  });

  const getRowActions = useCallback((r: TransferRow): RowActionDescriptor<TransferRow>[] => {
    const actions: RowActionDescriptor<TransferRow>[] = [];
    if (onView) {
      actions.push({
        id: "view",
        label: t("actions.view", { namespace: "common" }),
        icon: Eye,
        priority: "primary",
        onClick: () => onView(r),
      });
    }
    if (onEdit) {
      actions.push({
        id: "edit",
        label: t("actions.edit", { namespace: "common" }),
        icon: Edit,
        priority: "secondary",
        onClick: () => onEdit(r),
      });
    }
    if (onDelete) {
      actions.push({
        id: "delete",
        label: t("actions.delete", { namespace: "common" }),
        icon: Trash2,
        priority: "overflow",
        destructive: true,
        separator: "before",
        onClick: () => onDelete(r.reference),
      });
    }
    return actions;
  }, [onView, onEdit, onDelete, t]);

  const columns = useMemo<UnifiedColumn<TransferRow>[]>(() => {
    const cols: UnifiedColumn<TransferRow>[] = [
    {
      id: 'material_name', header: t('labels.material', { namespace: 'inventory',  }), label: t('labels.material', { namespace: 'inventory',  }),
      accessor: (r) => r.material_name || '—',
      align: 'left',
      className: 'font-bold text-foreground'
    },
    {
      id: 'source', header: t('transfers.fromWarehouse', { namespace: 'inventory',  }), label: t('transfers.fromWarehouse', { namespace: 'inventory',  }),
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
          {r.source_warehouse_name}
        </span>
      ),
    },
    {
      id: 'dest', header: t('transfers.toWarehouse', { namespace: 'inventory',  }), label: t('transfers.toWarehouse', { namespace: 'inventory',  }),
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success border-success/20">
          {r.dest_warehouse_name}
        </span>
      ),
    },
    {
      id: 'quantity', header: t('labels.quantity', { namespace: 'inventory',  }), label: t('labels.quantity', { namespace: 'inventory',  }),
      accessor: (r) => (
        <span className="tabular-nums font-black text-base text-amber-600">
          {toLocalString(parseFloat(r.quantity))}
        </span>
      ),
      align: 'right',
    },
    {
      id: 'reference', header: t('labels.reference', { namespace: 'inventory',  }), label: t('labels.reference', { namespace: 'inventory',  }),
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-muted text-foreground border-muted">
          {formatNumber(parseInt(r.reference) || 0)}
        </span>
      ),
      align: 'center',
    },
    {
      id: 'notes', header: t('labels.note', { namespace: 'inventory',  }), label: t('labels.note', { namespace: 'inventory',  }),
      accessor: (r) => r.notes || '—',
      align: 'left',
      className: 'text-foreground text-xs max-w-[200px] truncate',
    },
    {
      id: 'date', header: t('labels.date', { namespace: 'inventory',  }), label: t('labels.date', { namespace: 'inventory',  }),
      accessor: (r) => formatDateTime(r.transfer_date),
      align: 'right',
      className: 'tabular-nums text-muted-foreground font-medium'
    },
    ];
    if (onView || onEdit || onDelete) {
      cols.push({
        id: 'actions',
        header: t('labels.actions', { namespace: 'inventory',  }),
        label: t('labels.actions', { namespace: 'inventory',  }),
        accessor: (r) => (
          <TableActions
            actions={getRowActions(r)}
          />
        ),
      });
    }
    return cols;
  }, [onView, onEdit, onDelete, t, getRowActions]);

  const defaultVisible = useMemo(() => {
    const ids = ["material_name", "source", "dest", "quantity", "reference", "notes", "date"];
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [onView, onEdit, onDelete]);

  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "transfers-unified",
    columns,
    defaultVisible,
  });

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalQty = sortedData.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "material_name") {
        return { id: "count", columnId: id, label: "", value: t("transfers.table.countSummary", { namespace: "inventory", count: sortedData.length }), className: "text-muted-foreground font-medium" };
      }
      if (id === "quantity") {
        return {
          id: "total_qty",
          columnId: id,
          label: t("labels.total", { namespace: "inventory" }),
          value: totalQty > 0 ? toLocalString(totalQty) : "—",
          className: "text-amber-600 font-black tabular-nums"
        };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns, t]);

  return (
    <TableShell
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={t("transfers.table.searchPlaceholder", { namespace: "inventory",  })}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      onExportExcel={onExportExcel}
      className={className}
    >
      <UnifiedTable
        data={sortedData}
        columns={enrichedColumns}
        loading={false}
        enableResize
        tableId="transfers"
        sortField={sortField}
        sortDirection={sortDirection}
        rowActions={getRowActions}
        onHeaderClick={(col) => {
          if (["date", "material_name", "reference", "quantity", "notes"].includes(col.id)) {
            handleSort(col.id as TransferSortField);
          }
        }}
        onRowClick={handleRowClick}
        selectedId={selectedRef}
        emptyMessage={search ? t("movements.emptySearch", { namespace: "inventory",  }) : t("transfers.table.empty", { namespace: "inventory",  })}
        summary={summaryColumns}
      />
    </TableShell>
  );
}