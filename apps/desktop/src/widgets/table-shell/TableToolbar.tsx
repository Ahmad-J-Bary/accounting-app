import React from 'react';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import {
  Search,
  Columns,
  LayoutGrid,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@shared/ui/dropdown-menu";
import { useTableSettings } from '@shared/hooks';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';
import { TableDensity } from '@shared/types/table-settings';
import { cn } from '@shared/lib/utils';
import { useLocalization } from "@app/providers/LocalizationProvider";
import { ExportExcelButton } from "./ExportExcelButton";
import { getDataHeaderShellClasses } from "@shared/lib/page-template-settings";

export interface ToolbarColumn {
  id: string;
  label: string;
  visible: boolean;
}

interface TableToolbarProps {
  title?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  columns?: ToolbarColumn[];
  onColumnToggle?: (id: string) => void;
  onColumnsReset?: () => void;
  columnsModified?: boolean;
  startContent?: React.ReactNode;
  datasetContext?: React.ReactNode;
  endContent?: React.ReactNode;
  actions?: React.ReactNode;
  showViewOptions?: boolean;
  showColumns?: boolean;
  showDensity?: boolean;
  filterBar?: React.ReactNode;
  onExportExcel?: () => void;
  exportLoading?: boolean;
  exportDisabled?: boolean;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  columns = [],
  onColumnToggle,
  onColumnsReset,
  columnsModified = false,
  startContent,
  datasetContext,
  endContent,
  actions,
  showViewOptions = true,
  showColumns,
  showDensity,
  filterBar,
  onExportExcel,
  exportLoading = false,
  exportDisabled = false,
}) => {
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const { preferences } = useUiPreferences();
  const { t, direction, isRTL } = useLocalization();
  const dataHeaderSettings = preferences.dataHeader;
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('labels.placeholder', );
  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;
  const hasColumns = columns.length > 0;
  const menuItemClassName = isRTL ? "flex-row-reverse" : "";

  // Compute fine-grained visibility for utilities
  const shouldShowDensity = showDensity ?? showViewOptions;
  const shouldShowColumns = (showColumns ?? showViewOptions) && hasColumns && onColumnToggle !== undefined;
  const shouldShowExport = !!onExportExcel;

  const resolvedStartContent = startContent ?? datasetContext;
  const resolvedEndContent = endContent ?? actions;
  const hasAnyUtilities = shouldShowDensity || shouldShowColumns || shouldShowExport || !!resolvedEndContent;
  const hasSearchOrFilter = onSearchChange !== undefined || !!filterBar || !!resolvedStartContent;

  if (!hasAnyUtilities && !hasSearchOrFilter) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", getDataHeaderShellClasses(dataHeaderSettings))} dir={direction}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {(onSearchChange !== undefined) && (
          <div className="relative min-w-[180px] flex-1 max-w-[320px]">
            <Search className="pointer-events-none absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={resolvedSearchPlaceholder}
              className="h-8 w-full bg-background pe-8 ps-3 text-sm transition-all border-border focus:bg-background"
            />
          </div>
        )}
        {resolvedStartContent && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {resolvedStartContent}
          </div>
        )}
        {filterBar && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {filterBar}
          </div>
        )}
      </div>
      {hasAnyUtilities && (
        <div className="ms-auto flex items-center gap-1.5">
          {resolvedEndContent}
          {shouldShowDensity && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2.5 border-border bg-background text-muted-foreground hover:text-foreground">
                  <LayoutGrid className="ms-1 h-3.5 w-3.5" />
                  <span className="text-xs">{t('labels.view', )}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-start">{t('labels.tableDensity', )}</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={settings.density}
                  onValueChange={(v) => updateSetting('density', v as TableDensity)}
                >
                  <DropdownMenuRadioItem value="compact" className={menuItemClassName}>{t('labels.compact', )}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comfortable" className={menuItemClassName}>{t('labels.comfortable', )}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="spacious" className={menuItemClassName}>{t('labels.spacious', )}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-start">{t('labels.otherOptions', )}</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={settings.zebraRows}
                  onCheckedChange={(v) => updateSetting('zebraRows', !!v)}
                  className={menuItemClassName}
                >
                  {t('labels.zebraRows', )}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={settings.stickyHeader}
                  onCheckedChange={(v) => updateSetting('stickyHeader', !!v)}
                  className={menuItemClassName}
                >
                  {t('labels.stickyHeader', )}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetSettings} className={cn(menuItemClassName, "text-destructive focus:text-destructive")}>
                  <RotateCcw className="ms-2 h-4 w-4" />
                  {t('labels.factoryReset', )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {shouldShowColumns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 border-border bg-background text-muted-foreground hover:text-foreground",
                    columnsModified && "border-amber-300 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  <Columns className="ms-1 h-3.5 w-3.5" />
                  <span className="text-xs">{t('labels.columns', )}</span>
                  {hasColumns && (
                    <span className={cn(
                      "ms-1 rounded px-1 py-0.5 text-3xs font-bold tabular-nums",
                      columnsModified
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {visibleCount}/{totalCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-[420px] overflow-y-auto">
                <DropdownMenuLabel className="flex items-center justify-between gap-2 text-start">
                  <span>{t('labels.showHideColumns', )}</span>
                  {hasColumns && (
                    <span className="text-2xs tabular-nums text-muted-foreground font-medium">
                      {visibleCount} / {totalCount}
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.visible}
                    onCheckedChange={() => onColumnToggle?.(col.id)}
                    className={menuItemClassName}
                  >
                    <span>{col.label}</span>
                  </DropdownMenuCheckboxItem>
                ))}
                {onColumnsReset && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onColumnsReset}
                      disabled={!columnsModified}
                      className={cn(menuItemClassName, "text-primary focus:text-primary disabled:text-muted-foreground disabled:opacity-50")}
                    >
                      <RotateCcw className="ms-2 h-4 w-4" />
                      {t('actions.restoreDefaultColumns', )}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {shouldShowExport && onExportExcel && (
            <ExportExcelButton
              onClick={onExportExcel}
              loading={exportLoading}
              disabled={exportDisabled}
            />
          )}
        </div>
      )}
    </div>
  );
};
