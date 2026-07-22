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
  className,
}) => {
  const { settings } = useTableSettings();

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden", className)}>
      {showToolbar && settings.showToolbar && (
        <div className="no-print px-4 py-2 border-b border-slate-100 bg-slate-50/30">
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
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden relative">
        {children}
      </div>

      {footer && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          {footer}
        </div>
      )}
    </div>
  );
};
