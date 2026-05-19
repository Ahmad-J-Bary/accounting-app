import React from 'react';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { 
  Search, 
  Columns, 
  LayoutGrid, 
  RotateCcw
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

interface TableToolbarProps {
  title?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  columns: { id: string; label: string; visible: boolean }[];
  onColumnToggle: (id: string) => void;
  actions?: React.ReactNode;
  showViewOptions?: boolean;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  title,
  search,
  onSearchChange,
  searchPlaceholder = "بحث...",
  columns,
  onColumnToggle,
  actions,
  showViewOptions = true,
}) => {
  const { settings, updateSetting, resetSettings } = useTableSettings();

  return (
    <div className="flex flex-col gap-4 mb-4" dir="rtl">
      <div className="flex items-center justify-between">
        {title && <h2 className="text-lg font-bold text-slate-800">{title}</h2>}
        <div className="flex items-center gap-2 mr-auto">
          {actions}
          
          {showViewOptions && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-slate-200 bg-white text-slate-600">
                    <LayoutGrid className="w-4 h-4 ml-2" />
                    العرض
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel className="text-right">كثافة الجدول</DropdownMenuLabel>
                  <DropdownMenuRadioGroup 
                    value={settings.density} 
                    onValueChange={(v) => updateSetting('density', v as TableDensity)}
                  >
                    <DropdownMenuRadioItem value="compact" className="flex-row-reverse">مختصر</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="comfortable" className="flex-row-reverse">مريح</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="spacious" className="flex-row-reverse">واسع</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-right">خيارات أخرى</DropdownMenuLabel>
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
                    <RotateCcw className="w-4 h-4 ml-2" />
                    إعادة ضبط المصنع
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-slate-200 bg-white text-slate-600">
                    <Columns className="w-4 h-4 ml-2" />
                    الأعمدة
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
                  <DropdownMenuLabel className="text-right">إظهار/إخفاء الأعمدة</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.visible}
                      onCheckedChange={() => onColumnToggle(col.id)}
                      className="flex-row-reverse"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {(onSearchChange !== undefined) && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 pr-10 pl-4 bg-slate-50 border-slate-200 focus:bg-white transition-all w-full max-w-md"
          />
        </div>
      )}
    </div>
  );
};
