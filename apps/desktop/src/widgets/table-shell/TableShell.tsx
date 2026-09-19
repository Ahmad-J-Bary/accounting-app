import React, { ReactNode } from 'react';
import { TableToolbar } from './TableToolbar';
import { useTableSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';

export interface TableShellColumn {
  id: string;
  label: string;
  visible: boolean;
}

export interface TableShellProps {
  title?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  columns: TableShellColumn[];
  onColumnToggle: (id: string) => void;
  onColumnsReset?: () => void;
  columnsModified?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showToolbar?: boolean;
  filterBar?: ReactNode;
  onExportExcel?: () => void;
  exportLoading?: boolean;
  exportDisabled?: boolean;
  className?: string;
}

export const TableShell: React.FC<TableShellProps> = ({
  title,
  search,
  onSearchChange,
  searchPlaceholder,
  columns,
  onColumnToggle,
  onColumnsReset,
  columnsModified = false,
  actions,
  children,
  footer,
  showToolbar = true,
  filterBar,
  onExportExcel,
  exportLoading,
  exportDisabled,
  className,
}) => {
  const { settings } = useTableSettings();

  return (
    <div className={cn("flex flex-col h-full bg-card rounded-xl shadow-sm border border-border overflow-hidden", className)}>
      {showToolbar && settings.showToolbar && (
        <div className="no-print border-b border-border bg-muted/20 px-3 py-2">
          <TableToolbar
            title={title}
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            columns={columns}
            onColumnToggle={onColumnToggle}
            onColumnsReset={onColumnsReset}
            columnsModified={columnsModified}
            actions={actions}
            filterBar={filterBar}
            onExportExcel={onExportExcel}
            exportLoading={exportLoading}
            exportDisabled={exportDisabled}
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden relative">
        {children}
      </div>

      {footer && (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
};
