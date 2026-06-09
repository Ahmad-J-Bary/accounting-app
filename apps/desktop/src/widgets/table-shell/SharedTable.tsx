import { useMemo, ReactNode } from "react";
import type { UnifiedColumn } from './UnifiedTable';
import { UnifiedTable } from './UnifiedTable';
import { TableShell } from './TableShell';
import type { SummaryColumn } from './TableSummary';
import { useUnifiedColumns, useSortable } from '@shared/hooks';

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  field: string;
  direction: SortDirection;
  sortFn: (a: T, b: T, field: string, direction: SortDirection) => number;
}

interface SharedTableProps<T> {
  data: T[];
  columns: UnifiedColumn<T>[];
  defaultVisible?: string[];
  loading?: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  tableId: string;
  sortConfig?: SortConfig<T>;
  selectedId?: string | null;
  onRowClick?: (row: T) => void;
  sortableFields?: string[];
  emptyMessage?: string;
  summary?: SummaryColumn[];
  enableResize?: boolean;
  title?: string;
}

export function SharedTable<T>({
  data,
  columns,
  defaultVisible,
  loading = false,
  search,
  onSearchChange,
  searchPlaceholder = "بحث...",
  tableId,
  sortConfig,
  selectedId,
  onRowClick,
  sortableFields,
  emptyMessage = "لا توجد بيانات متاحة",
  summary,
  enableResize = true,
  title,
}: SharedTableProps<T>) {
  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: `${tableId}-unified`,
    columns,
    defaultVisible: defaultVisible || columns.map(c => c.id),
  });

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data,
    defaultField: (sortConfig?.field || '') as any,
    defaultDirection: sortConfig?.direction || 'asc',
    sortFn: sortConfig?.sortFn || ((a: any, b: any) => 0),
  });

  return (
    <TableShell
      title={title}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
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
        enableResize={enableResize}
        tableId={tableId}
        sortField={sortField}
        sortDirection={sortDirection}
        selectedId={selectedId}
        onRowClick={onRowClick}
        onHeaderClick={(col) => {
          if (sortableFields && sortableFields.includes(col.id)) {
            handleSort(col.id as any);
          }
        }}
        emptyMessage={search ? "لا توجد نتائج تطابق معايير البحث" : emptyMessage}
        summary={summary}
      />
    </TableShell>
  );
}
