import { useState, useRef, useCallback, type KeyboardEvent, useMemo } from "react";
import { Trash2, Settings2 } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";
import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";
import { MaterialSearchPanel } from "./MaterialSearchPanel";

export interface DocumentColumn {
  key: string;
  header: string;
  width: string;
  align?: "right" | "left" | "center";
  type: "text" | "number" | "material" | "material_code" | "material_barcode" | "readonly" | "image" | "badge" | "unit_select";
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
  docCurrency?: string;
  exchangeRate?: string;
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
  preferenceKey = "generic_grid",
  docCurrency = "USD",
  exchangeRate = "1"
}: GenericDocumentGridProps) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"name" | "code" | "barcode">("name");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const defaultVisible = useMemo(() => columns.map(c => c.key), [columns]);
  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences(preferenceKey, defaultVisible);

  const filteredColumns = useMemo(() => {
    return columns.filter(c => visibleColumns.includes(c.key));
  }, [columns, visibleColumns]);

  const editableCols = filteredColumns.filter(c => c.type !== "readonly");
  const isNavigableCol = (c: DocumentColumn) => c.type !== "unit_select" && c.type !== "image";

  const findNextCol = useCallback((fromIdx: number, dir: 1 | -1): number => {
    let idx = fromIdx + dir;
    if (fromIdx < 0) idx = dir === 1 ? 0 : editableCols.length - 1;
    if (fromIdx >= editableCols.length) idx = dir === 1 ? 0 : editableCols.length - 1;
    while (idx >= 0 && idx < editableCols.length) {
      if (isNavigableCol(editableCols[idx])) return idx;
      idx += dir;
    }
    return fromIdx; // stay if no navigable found in that direction
  }, [editableCols]);

  const handleKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    if (readOnly) return;

    const moveTo = (nr: number, nc: number) => {
      if (nr >= lines.length) {
        onAddLine();
        setTimeout(() => inputRefs.current.get(`${nr}-${nc}`)?.focus(), 60);
      } else {
        inputRefs.current.get(`${nr}-${nc}`)?.focus();
      }
    };

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
          nc = findNextCol(-1, 1);
          nr = rowIdx + 1;
          const hasMaterial = lines[rowIdx]?.material_id || lines[rowIdx]?.material_name;
          if (!hasMaterial) nr = rowIdx;
        }
        moveTo(nr, nc);
        break;
      }
      case "ArrowRight":
        e.preventDefault();
        setSearchRow(null);
        { let nc = findNextCol(colIdx, -1);
          if (nc === colIdx) { nc = findNextCol(editableCols.length, -1); let nr = rowIdx - 1; if (nr < 0) nr = 0; inputRefs.current.get(`${nr}-${nc}`)?.focus(); }
          else { inputRefs.current.get(`${rowIdx}-${nc}`)?.focus(); }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        setSearchRow(null);
        { let nc = findNextCol(colIdx, 1);
          if (nc === colIdx) {
            nc = findNextCol(-1, 1);
            const hasMaterial = lines[rowIdx]?.material_id || lines[rowIdx]?.material_name;
            if (hasMaterial) {
              const nr = rowIdx + 1;
              moveTo(nr, nc);
            } else {
              inputRefs.current.get(`${rowIdx}-${nc}`)?.focus();
            }
          } else {
            inputRefs.current.get(`${rowIdx}-${nc}`)?.focus();
          }
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setSearchRow(null);
        inputRefs.current.get(`${Math.min(rowIdx + 1, lines.length - 1)}-${colIdx}`)?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSearchRow(null);
        inputRefs.current.get(`${Math.max(rowIdx - 1, 0)}-${colIdx}`)?.focus();
        break;
      case "Delete":
        if (e.ctrlKey) { e.preventDefault(); onRemoveLine(rowIdx); }
        break;
    }
  }, [editableCols.length, lines, onAddLine, onRemoveLine, readOnly, findNextCol]);

  const getCellValue = (line: GridLine, key: string): string => {
    if (!line.material_id && !line.material_name) return "";
    if (key === "line_total") return formatCurrency(line.line_total ?? 0);
    const raw = (line as unknown as Record<string, string | number>)[key];
    if (raw === undefined) return "";
    let s = String(raw);
    // Trim trailing zeros after decimal point for numeric-like values
    if (s.includes(".")) s = s.replace(/\.?0+$/, "");
    if (key === "profit_percent" && s && s !== "0") return `${s}%`;
    return s;
  };

  const handleCellChange = useCallback((rowIdx: number, colKey: string, value: string) => {
    if (readOnly) return;
    // Detect currency-specific fields: field_CCC (e.g. retail_price_SYP)
    const currMatch = colKey.match(/^(.+)_([A-Z]{3})$/);
    if (currMatch) {
      const baseField = currMatch[1];
      const currCode = currMatch[2];
      let factor = 1;
      if (docCurrency === "USD") {
        factor = parseFloat(exchangeRate) || 1;
      } else if (currCode === "USD") {
        factor = 1 / (parseFloat(exchangeRate) || 1);
      }
      const otherPrice = parseFloat(value) || 0;
      const docPrice = otherPrice / factor;
      onUpdateLine(rowIdx, {
        [baseField]: docPrice.toString(),
        [colKey]: value
      });
    } else {
      onUpdateLine(rowIdx, { [colKey]: value });
    }
  }, [docCurrency, exchangeRate, onUpdateLine, readOnly]);

  const showSearchPanel = searchRow !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex border-b border-border bg-muted sticky top-0 z-10">
        <div className="w-10 shrink-0 border-l border-border flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-muted-foreground hover:text-primary transition-colors">
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px] shadow-xl">
              <DropdownMenuLabel className="text-right text-[10px] font-black uppercase text-muted-foreground">تخصيص الأعمدة</DropdownMenuLabel>
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
            className={cn("px-2 py-1.5 text-muted-foreground font-black border-l border-border text-[10px] uppercase tracking-tighter", col.width)}
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
                "flex border-b border-border hover:bg-muted transition-colors group",
                isActiveRow ? "bg-primary/5" : rowIdx % 2 === 0 ? "bg-card" : "bg-muted/20"
              )}
            >
              {/* Index */}
              <div className="w-10 shrink-0 border-l border-border flex items-center justify-center text-[10px] text-muted-foreground bg-muted/30">
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
                        "flex items-center px-2 border-l border-border text-[11px] font-bold text-foreground truncate",
                        col.width,
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                      )}>
                      {getCellValue(line, col.key)}
                    </div>
                  );
                }

                if (col.type === "image") {
                    const src = getCellValue(line, col.key);
                    return (
                      <div key={col.key}
                        className={cn(
                          "flex items-center justify-center p-1 border-l border-border",
                          col.width
                        )}>
                        {src ? (
                            <img src={src} alt="" className="w-6 h-6 object-contain rounded bg-muted border border-border" />
                        ) : (
                            <div className="w-6 h-6 rounded bg-muted border border-dashed border-slate-200" />
                        )}
                      </div>
                    );
                }

                if (col.type === "badge") {
                    return (
                      <div key={col.key}
                        className={cn(
                          "flex items-center justify-center px-1 border-l border-border",
                          col.width
                        )}>
                        <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-tighter">
                            {getCellValue(line, col.key)}
                        </span>
                      </div>
                    );
                }

                if (col.type === "unit_select") {
                    const material = materials.find(m => m.id === line.material_id);
                    const units = material?.units || [];
                    const currentUnit = getCellValue(line, col.key);

                    return (
                      <div key={col.key}
                        className={cn(
                          "flex items-center justify-center px-1 border-l border-border",
                          col.width
                        )}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild disabled={readOnly || !line.material_id}>
                                <button className={cn(
                                    "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter transition-all",
                                    line.material_id 
                                        ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 cursor-pointer" 
                                        : "bg-muted text-muted-foreground border-border cursor-default"
                                )}>
                                    {line.material_id ? (currentUnit || "اختر") : ""}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="min-w-[100px] shadow-xl">
                                <DropdownMenuLabel className="text-right text-[9px] font-black text-muted-foreground uppercase">الوحدات المتاحة</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {units.map((u) => (
                                    <DropdownMenuCheckboxItem
                                        key={u.id}
                                        checked={line.unit_id === u.id || currentUnit === u.name}
                                        onCheckedChange={() => {
                                            onUpdateLine(rowIdx, { unit_id: u.id, unit_name: u.name });
                                        }}
                                        className="text-right flex-row-reverse gap-2 text-[10px] font-bold py-1.5"
                                    >
                                        {u.name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                }

                if (col.type === "material" || col.type === "material_code" || col.type === "material_barcode") {
                  const isCodeSearch = col.type === "material_code";
                  const isBarcodeSearch = col.type === "material_barcode";
                  
                  let displayValue = line.material_name || "";
                  if (isCodeSearch) displayValue = line.material_code || "";
                  if (isBarcodeSearch) displayValue = line.unit_barcode || "";

                  if (readOnly) {
                    return (
                      <div key={col.key}
                        className={cn(
                          "flex items-center px-2 border-l border-border h-8 text-[11px] font-bold text-gray-800 truncate",
                          col.width,
                          col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                        )}>
                        {displayValue || "-"}
                      </div>
                    );
                  }

                  return (
                    <div key={col.key}
                      className={cn(
                        "relative border-l border-border",
                        col.width,
                        isCellActive && "ring-inset ring-2 ring-blue-400 z-20"
                      )}>
                      <input
                        ref={el => {
                          if (el) inputRefs.current.set(refKey, el);
                          else inputRefs.current.delete(refKey);
                        }}
                        className={cn(
                          "w-full h-8 px-2 text-[11px] bg-transparent border-none outline-none text-right font-bold text-blue-800",
                          "placeholder:text-muted-foreground focus:bg-white transition-colors"
                        )}
                        placeholder="البحث..."
                        value={displayValue}
                        autoComplete="off"
                        onFocus={() => {
                          setActiveCell({ row: rowIdx, col: editColIdx });
                          setSearchRow(rowIdx);
                          setSearchType(isCodeSearch ? "code" : isBarcodeSearch ? "barcode" : "name");
                          setSearchTerm(displayValue);
                        }}
                        onChange={e => {
                          setSearchTerm(e.target.value);
                          setSearchRow(rowIdx);
                          setSearchType(isCodeSearch ? "code" : isBarcodeSearch ? "barcode" : "name");
                          
                          if (isCodeSearch) {
                            onUpdateLine(rowIdx, { material_code: e.target.value, material_id: "" });
                          } else if (isBarcodeSearch) {
                            onUpdateLine(rowIdx, { unit_barcode: e.target.value, material_id: "" });
                          } else {
                            onUpdateLine(rowIdx, { material_name: e.target.value, material_id: "" });
                          }
                        }}
                        onBlur={() => setTimeout(() => {
                          if (searchRow === rowIdx) setSearchRow(null);
                        }, 200)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, editColIdx)}
                      />
                    </div>
                  );
                }

                if (readOnly) {
                  return (
                    <div key={col.key}
                      className={cn(
                        "flex items-center px-2 border-l border-border h-8 text-[11px] font-bold text-gray-800 truncate",
                        col.width,
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                      )}>
                      {getCellValue(line, col.key) || "-"}
                    </div>
                  );
                }

                return (
                  <div key={col.key}
                    className={cn(
                      "border-l border-border",
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
                      className={cn(
                        "w-full h-8 px-2 text-[11px] bg-transparent border-none outline-none tabular-nums font-bold",
                        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        "focus:bg-white transition-colors",
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                      )}
                      value={getCellValue(line, col.key)}
                      onChange={e => handleCellChange(rowIdx, col.key, e.target.value)}
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
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف السطر (Ctrl+Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

      </div>
      <MaterialSearchPanel
        materials={materials}
        search={searchTerm}
        searchType={searchType}
        visible={showSearchPanel}
        onSelect={m => {
          if (readOnly) return;
          if (searchRow !== null) {
            onSelectMaterial(searchRow, m);
            setSearchRow(null);
            setSearchTerm("");
          }
        }}
        onClose={() => { setSearchRow(null); setSearchTerm(""); }}
      />

      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-t border-slate-200 text-[10px] text-muted-foreground font-bold">
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
