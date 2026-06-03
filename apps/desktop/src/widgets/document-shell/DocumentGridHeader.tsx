import { cn } from "@shared/lib/utils";
import { getAlignmentClass, getLeftBorderClass } from "@shared/lib/table-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@shared/ui/dropdown-menu";
import { Settings2 } from "lucide-react";
import type { DocumentColumn } from "./GenericDocumentGrid";

interface DocumentGridHeaderProps {
  columns: DocumentColumn[];
  filteredColumns: DocumentColumn[];
  getDensityPadding: () => string;
  headerColor: string;
  stickyHeader: boolean;
  borderStyle: string;
  columnWidths: Record<string, number>;
  getColumnStyle: (col: DocumentColumn) => React.CSSProperties;
  fontSize: number;
  isVisible: (key: string) => boolean;
  toggleColumn: (key: string) => void;
  handleResizeStart: (e: React.MouseEvent, colKey: string) => void;
  handleAutoFit: (colKey: string) => void;
}

export function DocumentGridHeader({
  columns,
  filteredColumns,
  getDensityPadding,
  headerColor,
  stickyHeader,
  borderStyle,
  columnWidths,
  getColumnStyle,
  fontSize,
  isVisible,
  toggleColumn,
  handleResizeStart,
  handleAutoFit,
}: DocumentGridHeaderProps) {
  return (
    <div
      className={cn(
        "flex transition-colors",
        headerColor || "bg-slate-50/50 backdrop-blur-md",
        borderStyle !== "none" && "border-b border-slate-200",
        stickyHeader && "sticky top-0 z-10 backdrop-blur-sm shadow-sm",
      )}
    >
      <div className={cn("w-10 shrink-0 flex items-center justify-center bg-slate-100/30", getLeftBorderClass(borderStyle))}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[180px] shadow-xl">
            <DropdownMenuLabel className="text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">
              تخصيص الأعمدة
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={isVisible(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
                className="text-right flex-row-reverse gap-2 text-[11px] font-bold py-1.5"
              >
                {col.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {filteredColumns.map((col) => (
        <div
          key={col.key}
          className={cn(
            getDensityPadding(),
            "relative text-slate-700 font-black uppercase tracking-wider select-none",
            getLeftBorderClass(borderStyle),
            !columnWidths[col.key] && col.width,
          )}
          style={{ ...getColumnStyle(col), fontSize: `${fontSize - 2}px` }}
        >
          {col.header}
          <div
            className="absolute top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors flex items-center justify-center group/resize"
            style={{ left: -4 }}
            onMouseDown={(e) => handleResizeStart(e, col.key)}
            onDoubleClick={() => handleAutoFit(col.key)}
          >
            <div className="w-[1px] h-3 bg-slate-200 group-hover/resize:bg-blue-400 group-active/resize:bg-blue-600 rounded-full transition-colors" />
          </div>
        </div>
      ))}
      <div className="w-12 shrink-0" />
    </div>
  );
}
