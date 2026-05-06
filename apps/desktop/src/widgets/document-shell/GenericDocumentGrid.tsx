import React, { useCallback, useRef } from "react";
import { cn } from "@shared/lib/utils";
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";
import { Trash2, Copy, Search } from "lucide-react";
import { MaterialDto } from "@erp/shared-types";

export interface DocumentColumn {
  key: string;
  header: string;
  width: string;
  align?: "right" | "left" | "center";
  type: "text" | "number" | "material" | "readonly";
}

interface GenericDocumentGridProps {
  columns: DocumentColumn[];
  lines: GridLine[];
  onUpdateLine: (index: number, updates: Partial<GridLine>) => void;
  onRemoveLine: (index: number) => void;
  onAddLine: () => void;
  onSelectMaterial: (index: number, material: MaterialDto) => void;
  materials: MaterialDto[];
  readOnly?: boolean;
}

/**
 * A highly optimized, generic grid for financial documents.
 * Focuses on keyboard navigation and rapid data entry.
 */
export function GenericDocumentGrid({
  columns,
  lines,
  onUpdateLine,
  onRemoveLine,
  onAddLine,
  onSelectMaterial,
  materials,
  readOnly = false
}: GenericDocumentGridProps) {
  const [activeCell, setActiveCell] = React.useState<{ row: number; col: number } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearch, setShowSearch] = React.useState<number | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (readOnly) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex === lines.length - 1) {
        onAddLine();
      }
      setActiveCell({ row: rowIndex + 1, col: colIndex });
    }
    // Add more navigation logic here...
  };

  return (
    <div className="flex flex-col h-full bg-white font-mono text-[13px]" dir="rtl">
      {/* Table Header */}
      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="w-10 shrink-0 border-l border-slate-200" /> {/* Index column */}
        {columns.map((col) => (
          <div 
            key={col.key} 
            className={cn("px-3 py-2 text-slate-500 font-bold border-l border-slate-200 text-xs", col.width)}
            style={{ textAlign: col.align || "right" }}
          >
            {col.header}
          </div>
        ))}
        <div className="w-10 shrink-0" /> {/* Actions column */}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {lines.map((line, rowIndex) => (
          <div 
            key={line._id} 
            className={cn(
              "flex border-b border-slate-100 hover:bg-slate-50 transition-colors group",
              rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/20"
            )}
          >
            {/* Index */}
            <div className="w-10 shrink-0 border-l border-slate-200 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50/50">
              {rowIndex + 1}
            </div>

            {/* Cells */}
            {columns.map((col, colIndex) => (
              <div 
                key={col.key} 
                className={cn("px-1 py-1 border-l border-slate-100 flex items-center", col.width)}
              >
                {col.type === "readonly" ? (
                  <div className={cn("px-2 w-full text-slate-500 truncate", col.align === "left" ? "text-left" : "text-right")}>
                    {(line as any)[col.key] || "—"}
                  </div>
                ) : col.type === "material" ? (
                  <div className="relative w-full">
                    <input 
                      className="w-full px-2 py-1 bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded outline-none text-right font-bold text-blue-800"
                      value={line.material_name || ""}
                      readOnly={readOnly}
                      onChange={(e) => {
                        onUpdateLine(rowIndex, { material_name: e.target.value });
                        setSearchQuery(e.target.value);
                        setShowSearch(rowIndex);
                      }}
                      onFocus={() => setShowSearch(rowIndex)}
                    />
                  </div>
                ) : (
                  <input 
                    className={cn(
                      "w-full px-2 py-1 bg-transparent border-none focus:ring-2 focus:ring-blue-500 rounded outline-none font-bold",
                      col.align === "left" ? "text-left" : "text-right"
                    )}
                    value={(line as any)[col.key] || ""}
                    readOnly={readOnly}
                    type={col.type === "number" ? "number" : "text"}
                    onChange={(e) => onUpdateLine(rowIndex, { [col.key]: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                  />
                )}
              </div>
            ))}

            {/* Row Actions */}
            <div className="w-10 shrink-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!readOnly && (
                <button 
                  onClick={() => onRemoveLine(rowIndex)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        
        {!readOnly && (
          <div className="p-4 flex justify-center">
            <button 
              onClick={onAddLine}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full transition-colors"
            >
              <span>+ إضافة سطر جديد</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
