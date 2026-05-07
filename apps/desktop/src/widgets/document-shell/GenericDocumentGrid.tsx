import React, { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo } from "react";
import { Trash2, Copy, Search, Settings2 } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto } from "@erp/shared-types";
import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

export interface DocumentColumn {
  key: string;
  header: string;
  width: string;
  align?: "right" | "left" | "center";
  type: "text" | "number" | "material" | "readonly";
}

interface MaterialSearchPanelProps {
  materials: MaterialDto[];
  search: string;
  visible: boolean;
  onSelect: (m: MaterialDto) => void;
  onClose: () => void;
}

function MaterialSearchPanel({ materials, search, visible, onSelect, onClose }: MaterialSearchPanelProps) {
  const filtered = materials.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase()) ||
    (m.barcode ?? "").includes(search)
  ).slice(0, 30);

  if (!visible) return null;

  return (
    <div className="border-t border-blue-200 bg-blue-50/40">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 border-b border-blue-100">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
          نتائج البحث — {filtered.length} صنف
        </span>
        <button onClick={onClose} className="text-[10px] text-blue-400 hover:text-blue-600 mr-auto">إغلاق</button>
      </div>
      <div className="max-h-44 overflow-y-auto" dir="rtl">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">لا توجد نتائج</div>
        ) : (
          <table className="w-full text-xs font-sans">
            <thead className="bg-blue-50/80 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500 w-24">الكود</th>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500">اسم الصنف</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-20">المخزون</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-24">آخر تكلفة شراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {filtered.map(m => (
                <tr
                  key={m.id}
                  className="hover:bg-blue-100 cursor-pointer transition-colors"
                  onMouseDown={() => onSelect(m)}
                >
                  <td className="px-3 py-1.5 font-mono text-slate-600">{m.code}</td>
                  <td className="px-3 py-1.5 font-semibold text-slate-800">{m.name}</td>
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.total_available}</td>
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.last_purchase_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
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
  preferenceKey?: string;
}

export function GenericDocumentGrid({
  columns,
  lines,
  onUpdateLine,
  onRemoveLine,
  onAddLine,
  onSelectMaterial,
  materials,
  readOnly = false,
  preferenceKey = "generic_grid"
}: GenericDocumentGridProps) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const defaultVisible = useMemo(() => columns.map(c => c.key), [columns]);
  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences(preferenceKey, defaultVisible);

  const filteredColumns = useMemo(() => {
    return columns.filter(c => visibleColumns.includes(c.key));
  }, [columns, visibleColumns]);

  const editableCols = filteredColumns.filter(c => c.type !== "readonly");

  const handleKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (readOnly) return;

    if (searchRow === rowIdx && ["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault(); return;
    }

    switch (e.key) {
      case "Escape":
        setSearchRow(null);
        setSearchTerm("");
        break;
      case "Tab":
      case "Enter": {
        e.preventDefault();
        setSearchRow(null);
        let nr = rowIdx, nc = colIdx + 1;
        if (nc >= editableCols.length) { 
          nc = 0; 
          nr = rowIdx + 1; 
        }
        
        if (nr >= lines.length) {
          onAddLine();
          setTimeout(() => inputRefs.current.get(`${nr}-0`)?.focus(), 60);
        } else {
          inputRefs.current.get(`${nr}-${nc}`)?.focus();
        }
        break;
      }
      case "ArrowDown":
        e.preventDefault();
        inputRefs.current.get(`${Math.min(rowIdx + 1, lines.length - 1)}-${colIdx}`)?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        inputRefs.current.get(`${Math.max(rowIdx - 1, 0)}-${colIdx}`)?.focus();
        break;
      case "Delete":
        if (e.ctrlKey) { e.preventDefault(); onRemoveLine(rowIdx); }
        break;
    }
  }, [searchRow, editableCols.length, lines.length, onAddLine, onRemoveLine, readOnly]);

  const getCellValue = (line: GridLine, key: string): string => {
    if (key === "line_total") return formatCurrency(line.line_total ?? 0);
    return String((line as unknown as Record<string, string | number>)[key] ?? "");
  };

  const showSearchPanel = searchRow !== null;

  return (
    <div className="flex flex-col h-full bg-white font-mono text-[13px]" dir="rtl">
      {/* Table Header */}
      <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="w-10 shrink-0 border-l border-slate-200 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-slate-300 hover:text-blue-500 transition-colors">
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px] shadow-xl">
              <DropdownMenuLabel className="text-right text-[10px] font-black uppercase text-slate-400">تخصيص الأعمدة</DropdownMenuLabel>
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
            className={cn("px-3 py-2 text-slate-500 font-bold border-l border-slate-200 text-[11px] uppercase tracking-wider", col.width)}
            style={{ textAlign: col.align || "right" }}
          >
            {col.header}
          </div>
        ))}
        <div className="w-12 shrink-0" />
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto min-h-[300px]">
        {lines.map((line, rowIdx) => {
          const isActiveRow = activeCell?.row === rowIdx;
          let editColCursor = 0;

          return (
            <div 
              key={line._id} 
              className={cn(
                "flex border-b border-slate-100 hover:bg-slate-50 transition-colors group",
                isActiveRow ? "bg-blue-50/50" : rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
              )}
            >
              {/* Index */}
              <div className="w-10 shrink-0 border-l border-slate-200 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50/50">
                {rowIdx + 1}
              </div>

              {/* Cells */}
              {filteredColumns.map((col) => {
                const isEditable = col.type !== "readonly";
                const editColIdx = isEditable ? editColCursor++ : -1;
                const isCellActive = activeCell?.row === rowIdx && activeCell?.col === editColIdx;
                const refKey = `${rowIdx}-${editColIdx}`;

                if (col.type === "readonly") {
                  return (
                    <div key={col.key}
                      className={cn(
                        "flex items-center px-3 border-l border-slate-100 text-[12px] font-bold text-slate-700 truncate",
                        col.width,
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                      )}>
                      {getCellValue(line, col.key)}
                    </div>
                  );
                }

                if (col.type === "material") {
                  return (
                    <div key={col.key}
                      className={cn(
                        "relative border-l border-slate-100",
                        col.width,
                        isCellActive && "ring-inset ring-2 ring-blue-400 z-20"
                      )}>
                      <input
                        ref={el => {
                          if (el) inputRefs.current.set(refKey, el);
                          else inputRefs.current.delete(refKey);
                        }}
                        disabled={readOnly}
                        className={cn(
                          "w-full h-9 px-3 text-[12px] bg-transparent border-none outline-none text-right font-bold text-blue-800",
                          "placeholder:text-slate-300 focus:bg-white transition-colors",
                          readOnly && "opacity-50"
                        )}
                        placeholder="الكود أو الاسم..."
                        value={line.material_name || ""}
                        autoComplete="off"
                        onFocus={() => {
                          setActiveCell({ row: rowIdx, col: editColIdx });
                          setSearchRow(rowIdx);
                          setSearchTerm(line.material_name || "");
                        }}
                        onChange={e => {
                          setSearchTerm(e.target.value);
                          setSearchRow(rowIdx);
                          onUpdateLine(rowIdx, { material_name: e.target.value, material_id: "" });
                        }}
                        onBlur={() => setTimeout(() => {
                          if (searchRow === rowIdx) setSearchRow(null);
                        }, 200)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, editColIdx)}
                      />
                    </div>
                  );
                }

                return (
                  <div key={col.key}
                    className={cn(
                      "border-l border-slate-100",
                      col.width,
                      isCellActive && "ring-inset ring-2 ring-blue-400"
                    )}>
                    <input
                      ref={el => {
                        if (el) inputRefs.current.set(refKey, el);
                        else inputRefs.current.delete(refKey);
                      }}
                      type={col.type === "number" ? "number" : "text"}
                      min={col.type === "number" ? "0" : undefined}
                      step={col.type === "number" ? "any" : undefined}
                      disabled={readOnly}
                      className={cn(
                        "w-full h-9 px-3 text-[12px] bg-transparent border-none outline-none tabular-nums font-bold",
                        "focus:bg-white transition-colors",
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                        readOnly && "opacity-50"
                      )}
                      value={(line as unknown as Record<string, string | number>)[col.key] || ""}
                      onChange={e => onUpdateLine(rowIdx, { [col.key]: e.target.value })}
                      onFocus={() => setActiveCell({ row: rowIdx, col: editColIdx })}
                      onKeyDown={e => handleKeyDown(e, rowIdx, editColIdx)}
                    />
                  </div>
                );
              })}

              <div className="w-12 shrink-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!readOnly && (
                  <button 
                    onClick={() => onRemoveLine(rowIdx)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف السطر (Ctrl+Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!readOnly && (
          <div className="p-4 flex justify-center bg-slate-50/30">
            <button 
              onClick={onAddLine}
              className="text-[11px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-2 px-6 py-2 bg-blue-50 rounded-full transition-all hover:shadow-sm uppercase tracking-wider"
            >
              <span>+ إضافة سطر جديد (Enter)</span>
            </button>
          </div>
        )}
      </div>

      <MaterialSearchPanel
        materials={materials}
        search={searchTerm}
        visible={showSearchPanel}
        onSelect={m => {
          if (searchRow !== null) {
            onSelectMaterial(searchRow, m);
            setSearchRow(null);
            setSearchTerm("");
          }
        }}
        onClose={() => { setSearchRow(null); setSearchTerm(""); }}
      />

      <div className="flex items-center justify-between px-4 py-2 bg-slate-100/80 border-t border-slate-200 text-[10px] text-slate-400 font-bold">
        <div className="flex items-center gap-4 uppercase tracking-widest">
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-200 px-1 rounded text-slate-600">Tab/Enter</kbd> انتقال
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-200 px-1 rounded text-slate-600">↑↓</kbd> صفوف
          </div>
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-200 px-1 rounded text-slate-600">Ctrl+Del</kbd> حذف
          </div>
        </div>
        <div className="text-slate-500">
          إجمالي عدد الأسطر: {lines.length}
        </div>
      </div>
    </div>
  );
}
