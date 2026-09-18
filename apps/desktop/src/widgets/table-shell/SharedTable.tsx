import { useEffect } from 'react';
import type { UnifiedColumn } from './UnifiedTable';
import { UnifiedTable } from './UnifiedTable';
import { TableShell } from './TableShell';
import type { SummaryColumn } from './TableSummary';
import { useUnifiedColumns, useSortable } from '@shared/hooks';
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { RowActionDescriptor } from '@shared/types/row-actions';

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
  rowActions?: (row: T) => RowActionDescriptor<T>[];
  sortableFields?: string[];
  emptyMessage?: string;
  summary?: SummaryColumn[];
  enableResize?: boolean;
  title?: string;
  className?: string;
  filterBar?: React.ReactNode;
  onExportExcel?: () => void;
  exportLoading?: boolean;
  exportDisabled?: boolean;
  onVisibleColumnsChange?: (ids: string[]) => void;
}

export function SharedTable<T>({
  data,
  columns,
  defaultVisible,
  loading = false,
  search,
  onSearchChange,
  searchPlaceholder,
  tableId,
  sortConfig,
  selectedId,
  onRowClick,
  rowActions,
  sortableFields,
  emptyMessage,
  summary,
  enableResize = true,
  title,
  className,
  filterBar,
  onExportExcel,
  exportLoading,
  exportDisabled,
  onVisibleColumnsChange,
}: SharedTableProps<T>) {
  const { enrichedColumns, visibleColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: `${tableId}-unified`,
    columns,
    defaultVisible: defaultVisible || columns.map(c => c.id),
  });

  const { t } = useLocalization();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('labels.placeholder', );
  const resolvedEmptyMessage = emptyMessage ?? t('states.noDataAvailable', );

  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable<T, string>({
    data,
    defaultField: sortConfig?.field || '',
    defaultDirection: sortConfig?.direction || 'asc',
    sortFn: sortConfig?.sortFn || ((_a: T, _b: T, _field: string, _dir: "asc" | "desc") => 0),
  });

  return (
    <TableShell
      title={title}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={resolvedSearchPlaceholder}
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      className={className}
      filterBar={filterBar}
      onExportExcel={onExportExcel}
      exportLoading={exportLoading}
      exportDisabled={exportDisabled}
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
        rowActions={rowActions}
        onHeaderClick={(col) => {
          if (sortableFields && sortableFields.includes(col.id)) {
            handleSort(col.id);
          }
        }}
        emptyMessage={search ? t('states.noMatchingResults', ) : resolvedEmptyMessage}
        summary={summary}
      />
    </TableShell>
  );
}
