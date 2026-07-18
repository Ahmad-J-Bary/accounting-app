import { useMemo, useState } from "react";
import type { StockMovement, WarehouseDto } from "@erp/shared-types";
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { TableActions } from '@widgets/table-shell/TableActions';
import type { SummaryColumn } from '@widgets/table-shell/TableSummary';
import { useUnifiedColumns, useSortable } from "@shared/hooks";
import { formatDateTime, formatNumber, toLocalString } from '@shared/lib/format';

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
}

type TransferSortField = "date" | "material_name" | "reference" | "quantity" | "notes";

const sortFn = (a: TransferRow, b: TransferRow, field: TransferSortField, direction: 'asc' | 'desc') => {
  const cmp = field === "date"
    ? new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime()
    : String(a[field as keyof TransferRow] ?? "").localeCompare(String(b[field as keyof TransferRow] ?? ""), "ar");
  return direction === "asc" ? cmp : -cmp;
};

export function TransferTable({ movements, warehouses, className, onView, onEdit, onDelete }: TransferTableProps) {
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

  const columns = useMemo<UnifiedColumn<TransferRow>[]>(() => {
    const cols: UnifiedColumn<TransferRow>[] = [
    {
      id: 'material_name', header: 'المادة', label: 'المادة',
      accessor: (r) => r.material_name || '—',
      className: 'font-bold text-slate-900'
    },
    {
      id: 'source', header: 'من مستودع', label: 'من مستودع',
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
          {r.source_warehouse_name}
        </span>
      ),
    },
    {
      id: 'dest', header: 'إلى مستودع', label: 'إلى مستودع',
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
          {r.dest_warehouse_name}
        </span>
      ),
    },
    {
      id: 'quantity', header: 'الكمية', label: 'الكمية',
      accessor: (r) => (
        <span className="tabular-nums font-black text-base text-amber-600">
          {toLocalString(parseFloat(r.quantity))}
        </span>
      ),
    },
    {
      id: 'reference', header: 'المرجع', label: 'المرجع',
      accessor: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
          {formatNumber(parseInt(r.reference) || 0)}
        </span>
      ),
    },
    {
      id: 'notes', header: 'ملاحظة', label: 'ملاحظة',
      accessor: (r) => r.notes || '—',
      className: 'text-slate-600 text-xs max-w-[200px] truncate',
    },
    {
      id: 'date', header: 'التاريخ', label: 'التاريخ',
      accessor: (r) => formatDateTime(r.transfer_date),
      className: 'tabular-nums text-slate-500 font-medium'
    },
    ];
    if (onView || onEdit || onDelete) {
      cols.push({
        id: 'actions',
        header: 'إجراءات',
        label: 'إجراءات',
        accessor: (r) => (
          <TableActions
            onView={onView ? () => onView(r) : undefined}
            onEdit={onEdit ? () => onEdit(r) : undefined}
            onDelete={onDelete ? () => onDelete(r.reference) : undefined}
          />
        ),
      });
    }
    return cols;
  }, [onView, onEdit, onDelete]);

  const defaultVisible = useMemo(() => {
    const ids = ["material_name", "source", "dest", "quantity", "reference", "notes", "date"];
    if (onView || onEdit || onDelete) ids.push("actions");
    return ids;
  }, [onView, onEdit, onDelete]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "transfers-unified",
    columns,
    defaultVisible,
  });

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map(col => {
      const id = col.id;
      if (id === "material_name") {
        return { id: "count", columnId: id, label: "", value: `${sortedData.length} تحويل`, className: "text-slate-500 font-medium" };
      }
      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [sortedData, enrichedColumns]);

  return (
    <TableShell
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="بحث بالمادة أو المرجع..."
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
        loading={false}
        enableResize
        tableId="transfers"
        sortField={sortField}
        sortDirection={sortDirection}
        onHeaderClick={(col) => {
          if (["date", "material_name", "reference", "quantity", "notes"].includes(col.id)) {
            handleSort(col.id as TransferSortField);
          }
        }}
        onRowClick={handleRowClick}
        selectedId={selectedRef}
        emptyMessage={search ? "لا توجد نتائج تطابق معايير البحث" : "لا توجد تحويلات مسجلة"}
        summary={summaryColumns}
      />
    </TableShell>
  );
}