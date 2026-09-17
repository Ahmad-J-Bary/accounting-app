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
import { TableDensity } from '@shared/types/table-settings';
import { cn } from '@shared/lib/utils';
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  columns: ToolbarColumn[];
  onColumnToggle: (id: string) => void;
  onColumnsReset?: () => void;
  columnsModified?: boolean;
  actions?: React.ReactNode;
  showViewOptions?: boolean;
  filterBar?: React.ReactNode;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder,
  columns,
  onColumnToggle,
  onColumnsReset,
  columnsModified = false,
  actions,
  showViewOptions = true,
  filterBar,
}) => {
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const { t, direction, isRTL } = useLocalization();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('labels.placeholder', );
  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;
  const hasColumns = columns.length > 0;
  const menuItemClassName = isRTL ? "flex-row-reverse" : "";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2" dir={direction}>
      {(onSearchChange !== undefined) && (
        <div className="relative flex-[2] min-w-[160px] max-w-[320px]">
          <Search className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={resolvedSearchPlaceholder}
            className="h-8 w-full bg-white pe-7 ps-3 text-sm transition-all border-slate-200 focus:bg-white"
          />
        </div>
      )}
      {filterBar && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {filterBar}
        </div>
      )}
      <div className="me-auto flex items-center gap-1">
        {actions}
        {showViewOptions && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 border-slate-200 bg-white text-slate-600">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-2 border-slate-200 bg-white text-slate-600",
                    columnsModified && "border-amber-300 bg-amber-50 text-amber-700"
                  )}
                >
                  <Columns className="ms-1 h-3.5 w-3.5" />
                  <span className="text-xs">{t('labels.columns', )}</span>
                  {hasColumns && (
                    <span className={cn(
                      "ms-1 rounded px-1 py-0.5 text-3xs font-bold tabular-nums",
                      columnsModified
                        ? "bg-amber-200 text-amber-800"
                        : "bg-slate-100 text-slate-600"
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
                    onCheckedChange={() => onColumnToggle(col.id)}
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
                      className={cn(menuItemClassName, "text-primary focus:text-primary disabled:text-slate-400 disabled:opacity-50")}
                    >
                      <RotateCcw className="ms-2 h-4 w-4" />
                      {t('actions.restoreDefaultColumns', )}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
};
