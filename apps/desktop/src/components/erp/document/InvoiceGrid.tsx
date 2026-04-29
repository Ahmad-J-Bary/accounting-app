import React, { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { Trash2, Copy } from "lucide-react";
import { materialService } from "@/services/materialService";
import type { MaterialDto, InvoiceLineDto } from "@erp/shared-types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  GridLine,
  toBackendLines,
  newGridLine,
  calcLineTotal,
  generateDocNumber
} from "./invoiceUtils";

export type { GridLine };

interface ColumnDef {
  key: string;
  header: string;
  width: string;
  align: "right" | "left" | "center";
  type: "text" | "number" | "material" | "readonly";
}

const SALES_COLS: ColumnDef[] = [
  { key: "material_name", header: "المادة / الصنف", width: "min-w-[200px] flex-[3]", align: "right", type: "material" },
  { key: "quantity",      header: "الكمية",          width: "w-[90px]",               align: "center", type: "number" },
  { key: "unit_price",    header: "سعر البيع",        width: "w-[110px]",              align: "left",   type: "number" },
  { key: "discount",      header: "خصم %",           width: "w-[80px]",               align: "center", type: "number" },
  { key: "line_total",    header: "الإجمالي",         width: "w-[120px]",              align: "left",   type: "readonly" },
  { key: "notes",         header: "ملاحظات",          width: "flex-[2]",               align: "right",  type: "text" },
];

const PURCHASE_COLS: ColumnDef[] = [
  { key: "material_name", header: "المادة / الصنف", width: "min-w-[200px] flex-[3]", align: "right", type: "material" },
  { key: "quantity",      header: "الكمية",          width: "w-[90px]",               align: "center", type: "number" },
  { key: "unit_price",    header: "سعر الشراء",       width: "w-[110px]",              align: "left",   type: "number" },
  { key: "discount",      header: "خصم %",           width: "w-[80px]",               align: "center", type: "number" },
  { key: "line_total",    header: "الإجمالي",         width: "w-[120px]",              align: "left",   type: "readonly" },
  { key: "notes",         header: "ملاحظات",          width: "flex-[2]",               align: "right",  type: "text" },
];

const OPENING_COLS: ColumnDef[] = [
  { key: "material_name",   header: "المادة / الصنف", width: "min-w-[200px] flex-[3]", align: "right",  type: "material" },
  { key: "quantity",         header: "الكمية",          width: "w-[90px]",               align: "center", type: "number" },
  { key: "unit_price",       header: "سعر التكلفة",     width: "w-[110px]",              align: "left",   type: "number" },
  { key: "retail_price",     header: "مفرق",            width: "w-[100px]",              align: "left",   type: "number" },
  { key: "wholesale_price",  header: "جملة",            width: "w-[100px]",              align: "left",   type: "number" },
  { key: "minimum_stock",    header: "حد الطلب",        width: "w-[80px]",               align: "center", type: "number" },
  { key: "line_total",       header: "القيمة",           width: "w-[120px]",              align: "left",   type: "readonly" },
];

// ──────────────────────────────────────────────────────────────────────────────
// MaterialSearchPanel — shown BELOW the grid, never overlapping it
// ──────────────────────────────────────────────────────────────────────────────
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
          <table className="w-full text-xs">
            <thead className="bg-blue-50/80 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500 w-24">الكود</th>
                <th className="px-3 py-1.5 text-right font-bold text-slate-500">اسم الصنف</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-20">المخزون</th>
                <th className="px-3 py-1.5 text-left font-bold text-slate-500 w-24">سعر الشراء</th>
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
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.stock_quantity}</td>
                  <td className="px-3 py-1.5 text-left tabular-nums text-slate-600">{m.purchase_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// InvoiceGrid
// ──────────────────────────────────────────────────────────────────────────────
interface InvoiceGridProps {
  type: "Sales" | "Purchase" | "OpeningBalance";
  lines: GridLine[];
  onChange: (lines: GridLine[]) => void;
  disabled?: boolean;
}

export function InvoiceGrid({ type, lines, onChange, disabled = false }: InvoiceGridProps) {
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const columns = type === "Sales" ? SALES_COLS : type === "Purchase" ? PURCHASE_COLS : OPENING_COLS;
  const editableCols = columns.filter(c => c.type !== "readonly");

  // Always keep at least one empty row at the bottom
  const ensureTrailingRow = useCallback((ls: GridLine[]): GridLine[] => {
    const last = ls[ls.length - 1];
    const lastIsEmpty = !last || (!last.material_id && !last.material_name && last.quantity === "1" && last.unit_price === "0");
    if (lastIsEmpty) return ls;
    return [...ls, newGridLine()];
  }, []);

  // Initialize with one empty row
  useEffect(() => {
    if (lines.length === 0) {
      onChange([newGridLine()]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    materialService.listMaterials().then(setMaterials).catch(console.error);
  }, []);

  const updateLine = useCallback((idx: number, updates: Partial<GridLine>) => {
    const updated = lines.map((l, i) => {
      if (i !== idx) return l;
      const merged = { ...l, ...updates };
      merged.line_total = calcLineTotal(merged);
      return merged;
    });
    onChange(ensureTrailingRow(updated));
  }, [lines, onChange, ensureTrailingRow]);

  const removeLine = useCallback((idx: number) => {
    const remaining = lines.filter((_, i) => i !== idx);
    onChange(remaining.length === 0 ? [newGridLine()] : ensureTrailingRow(remaining));
  }, [lines, onChange, ensureTrailingRow]);

  const duplicateLine = useCallback((idx: number) => {
    const copy = { ...lines[idx], _id: `ln_${Date.now()}` };
    const newLines = [...lines];
    newLines.splice(idx + 1, 0, copy);
    onChange(ensureTrailingRow(newLines));
  }, [lines, onChange, ensureTrailingRow]);

  const selectMaterial = useCallback((rowIdx: number, m: MaterialDto) => {
    const unitPrice = type === "Purchase" ? (m.purchase_price || "0") : "0";
    updateLine(rowIdx, {
      material_id: m.id,
      material_name: m.name,
      code: m.code,
      barcode: m.barcode,
      unit_price: unitPrice,
      purchase_price: m.purchase_price,
    });
    setSearchRow(null);
    setSearchTerm("");
    // Focus quantity cell
    const qtyColIdx = editableCols.findIndex(c => c.key === "quantity");
    setTimeout(() => inputRefs.current.get(`${rowIdx}-${qtyColIdx}`)?.focus(), 60);
  }, [type, updateLine, editableCols]);

  const handleKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
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
        if (nc >= editableCols.length) { nc = 0; nr = rowIdx + 1; }
        if (nr >= lines.length) {
          // Trigger auto-add by touching the last row's material field
          const trailing = newGridLine();
          onChange(ensureTrailingRow([...lines, trailing]));
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
        if (e.ctrlKey) { e.preventDefault(); removeLine(rowIdx); }
        break;
      case "Insert":
        e.preventDefault(); duplicateLine(rowIdx); break;
    }
  }, [searchRow, editableCols.length, lines, onChange, ensureTrailingRow, removeLine, duplicateLine]);

  const getCellValue = (line: GridLine, key: string): string => {
    if (key === "line_total") return formatCurrency(line.line_total ?? 0);
    return String((line as unknown as Record<string, unknown>)[key] ?? "");
  };

  const showSearchPanel = searchRow !== null;

  return (
    <div className="flex flex-col" dir="rtl">
      {/* Header row */}
      <div className="flex bg-slate-100 border-b-2 border-slate-300 text-[11px] font-bold text-slate-500 select-none sticky top-0 z-10">
        <div className="w-8 text-center py-2 border-l border-slate-200 text-slate-300 flex-shrink-0">#</div>
        {columns.map(col => (
          <div key={col.key}
            className={cn(
              "py-2 px-2 border-l border-slate-200 last:border-l-0 uppercase tracking-wider",
              col.width,
              col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
            )}>
            {col.header}
          </div>
        ))}
        <div className="w-14 text-center py-2 flex-shrink-0 text-slate-300">⋮</div>
      </div>

      {/* Body rows */}
      <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        {lines.map((line, rowIdx) => {
          const isActive = activeCell?.row === rowIdx;
          let editColCursor = 0;

          return (
            <div key={line._id}
              className={cn(
                "flex border-b border-slate-100 group transition-colors",
                isActive ? "bg-blue-50/50" : "hover:bg-slate-50/70"
              )}>
              {/* # */}
              <div className="w-8 flex items-center justify-center text-[10px] text-slate-300 border-l border-slate-100 flex-shrink-0 font-mono">
                {rowIdx + 1}
              </div>

              {columns.map(col => {
                const isEditable = col.type !== "readonly";
                const editColIdx = isEditable ? editColCursor++ : -1;
                const isCellActive = activeCell?.row === rowIdx && activeCell?.col === editColIdx;
                const refKey = `${rowIdx}-${editColIdx}`;

                if (col.type === "readonly") {
                  return (
                    <div key={col.key}
                      className={cn(
                        "flex items-center px-2 border-l border-slate-100 text-xs",
                        col.width, "flex-shrink-0",
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                        "font-bold text-slate-700 tabular-nums"
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
                        disabled={disabled}
                        className={cn(
                          "w-full h-8 px-2 text-[12px] bg-transparent border-0 outline-none text-right",
                          "placeholder:text-slate-300 focus:bg-white transition-colors",
                          disabled && "opacity-50"
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
                          updateLine(rowIdx, { material_name: e.target.value, material_id: "" });
                        }}
                        onBlur={() => setTimeout(() => {
                          if (searchRow === rowIdx) setSearchRow(null);
                        }, 200)}
                        onKeyDown={e => handleKeyDown(e, rowIdx, editColIdx)}
                      />
                    </div>
                  );
                }

                // number / text inputs
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
                      disabled={disabled}
                      className={cn(
                        "w-full h-8 px-2 text-[12px] bg-transparent border-0 outline-none tabular-nums",
                        "focus:bg-white transition-colors",
                        col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                        disabled && "opacity-50"
                      )}
                      value={getCellValue(line, col.key)}
                      onChange={e => updateLine(rowIdx, { [col.key]: e.target.value } as Partial<GridLine>)}
                      onFocus={() => setActiveCell({ row: rowIdx, col: editColIdx })}
                      onKeyDown={e => handleKeyDown(e, rowIdx, editColIdx)}
                    />
                  </div>
                );
              })}

              {/* Row actions — visible on hover */}
              <div className="w-14 flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => duplicateLine(rowIdx)} disabled={disabled}
                  className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded" title="تكرار (Insert)">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={() => removeLine(rowIdx)} disabled={disabled}
                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="حذف (Ctrl+Del)">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Material Search Panel — below grid, never overlapping */}
      <MaterialSearchPanel
        materials={materials}
        search={searchTerm}
        visible={showSearchPanel}
        onSelect={m => {
          if (searchRow !== null) selectMaterial(searchRow, m);
        }}
        onClose={() => { setSearchRow(null); setSearchTerm(""); }}
      />

      {/* Footer stats */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
        <span className="space-x-3 rtl:space-x-reverse">
          <kbd className="bg-slate-200 px-1 rounded text-[10px]">Tab/Enter</kbd> انتقال
          <kbd className="bg-slate-200 px-1 rounded text-[10px]">↑↓</kbd> صفوف
          <kbd className="bg-slate-200 px-1 rounded text-[10px]">Ctrl+Del</kbd> حذف
          <kbd className="bg-slate-200 px-1 rounded text-[10px]">Insert</kbd> تكرار
        </span>
        <span className="font-bold text-slate-700 tabular-nums text-sm">
          {formatCurrency(lines.reduce((s, l) => s + (l.line_total ?? 0), 0))}
        </span>
      </div>
    </div>
  );
}
