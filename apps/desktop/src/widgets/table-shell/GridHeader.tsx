import React, { ReactNode } from 'react';
import { cn } from '@shared/lib/utils';
import { getLeftBorderClass } from '@shared/lib/table-utils';
import { Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@shared/ui/dropdown-menu';
import type { AutoFitColumnOptions } from '@shared/hooks/useColumnResize';

export interface GridHeaderColumn {
  id: string;
  header: ReactNode;
  label?: string;
  align?: 'right' | 'left' | 'center';
  width?: string;
}

interface GridHeaderProps {
  columns: GridHeaderColumn[];
  getDensityPadding: () => string;
  fontSize: number;
  headerColor?: string;
  stickyHeader?: boolean;
  borderStyle?: string;
  enableResize?: boolean;
  onHeaderCellClick?: (colId: string) => void;
  onResizeStart?: (e: React.MouseEvent, colId: string) => void;
  onAutoFit?: (colId: string, options?: AutoFitColumnOptions) => void;
  /** All columns for the settings dropdown */
  allColumns?: { id: string; label: string; visible: boolean }[];
  onColumnToggle?: (id: string) => void;
  prefixSlot?: ReactNode;
  suffixSlot?: ReactNode;
  columnWidths?: Record<string, number>;
  getColumnStyle?: (col: GridHeaderColumn) => React.CSSProperties;
}

function getHeaderText(col: GridHeaderColumn): string {
  if (typeof col.header === 'string') return col.header;
  if (typeof col.label === 'string') return col.label;
  return col.id;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  columns,
  getDensityPadding,
  fontSize,
  headerColor,
  stickyHeader,
  borderStyle,
  enableResize = true,
  onHeaderCellClick,
  onResizeStart,
  onAutoFit,
  allColumns,
  onColumnToggle,
  prefixSlot,
  suffixSlot,
  columnWidths = {},
  getColumnStyle,
}) => {
  return (
    <div
      className={cn(
        'flex transition-colors',
        headerColor || 'bg-slate-50/50 backdrop-blur-md',
        borderStyle !== 'none' && 'border-b border-slate-200',
        stickyHeader && 'sticky top-0 z-10 backdrop-blur-sm shadow-sm',
      )}
    >
      {prefixSlot ?? (allColumns && (
        <div className={cn('w-10 shrink-0 flex items-center justify-center bg-slate-100/30', getLeftBorderClass(borderStyle))}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='p-1 text-slate-400 hover:text-blue-600 transition-colors'>
                <Settings2 className='w-3.5 h-3.5' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-[180px] shadow-xl'>
              <DropdownMenuLabel className='text-right text-[10px] font-black uppercase text-slate-500 tracking-widest'>
                تخصيص الأعمدة
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.visible}
                  onCheckedChange={() => onColumnToggle?.(col.id)}
                  className='text-right flex-row-reverse gap-2 text-[11px] font-bold py-1.5'
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      {columns.map((col) => (
        <div
          key={col.id}
          data-col-id={col.id}
          className={cn(
            getDensityPadding(),
            'relative text-slate-700 font-black uppercase tracking-wider select-text',
            getLeftBorderClass(borderStyle),
            !columnWidths[col.id] && col.width,
          )}
          style={{
            ...(getColumnStyle ? getColumnStyle(col) : {}),
            fontSize: `${fontSize - 2}px`,
          }}
          onClick={() => onHeaderCellClick?.(col.id)}
          title={getHeaderText(col)}
        >
          {col.header}

          {enableResize && onResizeStart && (
            <div
              className='absolute top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors flex items-center justify-center group/resize'
              style={{ left: -4 }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart(e, col.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onAutoFit?.(col.id);
              }}
            >
              <div className='w-[1px] h-3 bg-slate-200 group-hover/resize:bg-blue-400 group-active/resize:bg-blue-600 rounded-full transition-colors' />
            </div>
          )}
        </div>
      ))}

      {suffixSlot}
    </div>
  );
};
