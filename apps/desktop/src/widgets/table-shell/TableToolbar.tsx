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
  searchPlaceholder = "بحث...",
  columns,
  onColumnToggle,
  onColumnsReset,
  columnsModified = false,
  actions,
  showViewOptions = true,
  filterBar,
}) => {
  const { settings, updateSetting, resetSettings } = useTableSettings();
  const visibleCount = columns.filter((c) => c.visible).length;
  const totalCount = columns.length;
  const hasColumns = columns.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2" dir="rtl">
      {(onSearchChange !== undefined) && (
        <div className="relative flex-[2] min-w-[160px] max-w-[320px]">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pe-7 ps-3 text-sm bg-white border-slate-200 focus:bg-white transition-all w-full"
          />
        </div>
      )}
      {filterBar && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {filterBar}
        </div>
      )}
      <div className="flex items-center gap-1 ms-auto">
        {actions}
        {showViewOptions && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 border-slate-200 bg-white text-slate-600">
                  <LayoutGrid className="w-3.5 h-3.5 me-1" />
                  <span className="text-xs">العرض</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-start">كثافة الجدول</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={settings.density}
                  onValueChange={(v) => updateSetting('density', v as TableDensity)}
                >
                  <DropdownMenuRadioItem value="compact" className="flex-row-reverse">مختصر</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comfortable" className="flex-row-reverse">مريح</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="spacious" className="flex-row-reverse">واسع</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-start">خيارات أخرى</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={settings.zebraRows}
                  onCheckedChange={(v) => updateSetting('zebraRows', !!v)}
                  className="flex-row-reverse"
                >
                  صفوف ملونة (Zebra)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={settings.stickyHeader}
                  onCheckedChange={(v) => updateSetting('stickyHeader', !!v)}
                  className="flex-row-reverse"
                >
                  تثبيت الهيدر
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetSettings} className="flex-row-reverse text-rose-600 focus:text-rose-600">
                  <RotateCcw className="w-4 h-4 me-2" />
                  إعادة ضبط المصنع
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
                  <Columns className="w-3.5 h-3.5 me-1" />
                  <span className="text-xs">الأعمدة</span>
                  {hasColumns && (
                    <span className={cn(
                      "ms-1 text-3xs font-bold px-1 py-0.5 rounded tabular-nums",
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
                <DropdownMenuLabel className="flex items-center justify-between text-start gap-2">
                  <span>إظهار / إخفاء الأعمدة</span>
                  {hasColumns && (
                    <span className="text-2xs tabular-nums text-slate-500 font-medium">
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
                    className="flex-row-reverse"
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
                      className="flex-row-reverse text-blue-600 focus:text-blue-600 disabled:text-slate-400 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4 me-2" />
                      استعادة الأعمدة الافتراضية
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
