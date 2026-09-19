import React, { ReactNode } from 'react';
import { TableToolbar } from './TableToolbar';
import { useTableSettings } from '@shared/hooks';
import { cn } from '@shared/lib/utils';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';
import { getTableShellRadiusClass } from '@shared/lib/page-template-settings';

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
  startContent?: ReactNode;
  datasetContext?: ReactNode;
  endContent?: ReactNode;
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
  startContent,
  datasetContext,
  endContent,
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
  const { preferences } = useUiPreferences();
  const tableRadiusClass = getTableShellRadiusClass(preferences.pageTemplate);
  const dataHeaderSettings = preferences.dataHeader;

  return (
    <div className={cn("flex h-full flex-col overflow-hidden border border-border bg-card shadow-sm", tableRadiusClass, className)}>
      {showToolbar && settings.showToolbar && (
        <div className={cn("no-print border-b border-border", dataHeaderSettings.sticky && "sticky top-0 z-10")}>
          <TableToolbar
            title={title}
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            columns={columns}
            onColumnToggle={onColumnToggle}
            onColumnsReset={onColumnsReset}
            columnsModified={columnsModified}
            startContent={startContent}
            datasetContext={datasetContext}
            endContent={endContent}
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
