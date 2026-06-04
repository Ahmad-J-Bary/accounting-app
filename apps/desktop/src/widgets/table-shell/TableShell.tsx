import React, { ReactNode } from 'react';
import { TableToolbar } from './TableToolbar';
import { useTableSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';

export interface TableShellProps {
  title?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  columns: { id: string; label: string; visible: boolean }[];
  onColumnToggle: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showToolbar?: boolean;
  className?: string;
}

export const TableShell: React.FC<TableShellProps> = ({
  title,
  search,
  onSearchChange,
  searchPlaceholder,
  columns,
  onColumnToggle,
  actions,
  children,
  footer,
  showToolbar = true,
  className,
}) => {
  const { settings } = useTableSettings();

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden", className)}>
      {showToolbar && settings.showToolbar && (
        <div className="p-4 border-b border-slate-100 bg-slate-50/30">
          <TableToolbar
            title={title}
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            columns={columns}
            onColumnToggle={onColumnToggle}
            actions={actions}
          />
        </div>
      )}
      
      <div className="flex-1 overflow-x-hidden overflow-y-auto relative custom-scrollbar">
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
