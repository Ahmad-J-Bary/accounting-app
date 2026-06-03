import { useState, useRef, useCallback, useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { getRowBackgroundClass, getRowBorderClass, getLeftBorderClass } from "@shared/lib/table-utils";
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";

import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import { MaterialSearchPanel } from "./MaterialSearchPanel";
import { DocumentGridCell, type DocumentGridConfig, type DocumentGridCallbacks } from "./DocumentGridCell";
import { DocumentGridHeader } from "./DocumentGridHeader";
import { GridSummaryRow } from "./GridSummaryRow";
import { useColumnResize } from "./useColumnResize";
import { useTableSettings } from "@shared/hooks";
import {
  formatWithLocale,
  useCurrencyContext,
} from "@app/providers/CurrencyContext";

export interface DocumentColumn {
  key: string;
  header: string;
  width: string;
  align?: "right" | "left" | "center";
  type:
    | "text"
    | "number"
    | "material"
    | "material_code"
    | "material_barcode"
    | "readonly"
    | "image"
    | "badge"
    | "unit_select";
}

export interface GenericDocumentGridProps {
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
  docCurrency = "",
  exchangeRate = "1",
}: GenericDocumentGridProps) {
  const { baseCurrency, convertBetween, currencies } = useCurrencyContext();
  const { settings, getDensityPadding } = useTableSettings();

  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"name" | "code" | "barcode">("name");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const defaultVisible = useMemo(() => columns.map((c) => c.key), [columns]);
  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences(preferenceKey, defaultVisible);

  const filteredColumns = useMemo(
    () => columns.filter((c) => visibleColumns.includes(c.key)),
    [columns, visibleColumns],
  );

  const { columnWidths, handleResizeStart, getColumnStyle, autoFitColumn } = useColumnResize(columns, preferenceKey);

  const editableCols = filteredColumns.filter((c) => c.type !== "readonly");
  const isNavigableCol = (c: DocumentColumn) =>
    c.type !== "unit_select" && c.type !== "image";

  const findNextCol = useCallback(
    (fromIdx: number, dir: 1 | -1): number => {
      let idx = fromIdx + dir;
      if (fromIdx < 0) idx = dir === 1 ? 0 : editableCols.length - 1;
      if (fromIdx >= editableCols.length) idx = dir === 1 ? 0 : editableCols.length - 1;
      while (idx >= 0 && idx < editableCols.length) {
        if (isNavigableCol(editableCols[idx])) return idx;
        idx += dir;
      }
      return fromIdx;
    },
    [editableCols],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
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
          {
            let nc = findNextCol(colIdx, -1);
            if (nc === colIdx) {
              nc = findNextCol(editableCols.length, -1);
              let nr = rowIdx - 1;
              if (nr < 0) nr = 0;
              inputRefs.current.get(`${nr}-${nc}`)?.focus();
            } else {
              inputRefs.current.get(`${rowIdx}-${nc}`)?.focus();
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          setSearchRow(null);
          {
            let nc = findNextCol(colIdx, 1);
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
    },
    [editableCols.length, lines, onAddLine, onRemoveLine, readOnly, findNextCol],
  );

  const formatRawAmount = useCallback(
    (amount: number, currencyCode?: string) => {
      const currency = currencies.find((c) => c.code === currencyCode) || baseCurrency || null;
      const formatted = formatWithLocale(amount, currency?.decimals ?? 2);
      return currency ? `${formatted} ${currency.symbol || currency.code}` : formatted;
    },
    [currencies, baseCurrency],
  );

  const getCellValue = useCallback((line: GridLine, key: string): string => {
    if (!line.material_id && !line.material_name) return "";
    if (key === "line_total")
      return formatRawAmount(line.line_total ?? 0, docCurrency || baseCurrency?.code);
    const raw = (line as unknown as Record<string, string | number>)[key];
    if (raw === undefined) return "";
    let s = String(raw);
    if (s.includes(".")) s = s.replace(/\.?0+$/, "");
    if (key === "profit_percent" && s && s !== "0") return `${s}%`;
    return s;
  }, [formatRawAmount, docCurrency, baseCurrency?.code]);

  const handleCellChange = useCallback(
    (rowIdx: number, colKey: string, value: string) => {
      if (readOnly) return;
      const currMatch = colKey.match(/^(.+)_([A-Z]{3})$/);
      if (currMatch) {
        const baseField = currMatch[1];
        const currCode = currMatch[2];
        const baseCode = baseCurrency?.code;
        if (!baseCode || currCode === baseCode) {
          onUpdateLine(rowIdx, { [baseField]: value, [colKey]: value });
          return;
        }
        const otherPrice = parseFloat(value) || 0;
        const basePrice = convertBetween(otherPrice, currCode, baseCode);
        onUpdateLine(rowIdx, {
          [baseField]: Number.isFinite(basePrice) ? basePrice.toString() : value,
          [colKey]: value,
        });
      } else {
        onUpdateLine(rowIdx, { [colKey]: value });
      }
    },
    [convertBetween, baseCurrency?.code, onUpdateLine, readOnly],
  );

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);
  const showSearchPanel = searchRow !== null;

  const cellConfig: DocumentGridConfig = {
    cellBorderClass,
    columnWidths,
    getColumnStyle,
    densityPadding: getDensityPadding(),
    fontSize: settings.fontSize,
    readOnly,
    materials,
    getCellValue,
    searchRow,
  };

  const cellCallbacks: DocumentGridCallbacks = {
    onUpdateLine,
    onCellChange: handleCellChange,
    onKeyDown: handleKeyDown,
    onActiveCellChange: setActiveCell,
    onSearchRowChange: setSearchRow,
    onSearchTypeChange: setSearchType,
    onSearchTermChange: setSearchTerm,
    inputRefs,
  };

  const handleAutoFit = useCallback(
    (colKey: string) => autoFitColumn(colKey, getCellValue, lines, columns),
    [autoFitColumn, getCellValue, lines, columns],
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <DocumentGridHeader
        columns={columns}
        filteredColumns={filteredColumns}
        getDensityPadding={getDensityPadding}
        headerColor={settings.headerColor}
        stickyHeader={settings.stickyHeader}
        borderStyle={settings.borderStyle}
        columnWidths={columnWidths}
        getColumnStyle={getColumnStyle}
        fontSize={settings.fontSize}
        isVisible={isVisible}
        toggleColumn={toggleColumn}
        handleResizeStart={handleResizeStart}
        handleAutoFit={handleAutoFit}
      />

      <div className="flex-1 overflow-auto min-h-[300px] custom-scrollbar">
        {lines.map((line, rowIdx) => {
          const isActiveRow = activeCell?.row === rowIdx;
          let editColCursor = 0;

          return (
            <div
              key={line._id}
              className={cn(
                "flex transition-colors duration-75 group",
                getRowBorderClass(settings.borderStyle),
                getRowBackgroundClass(isActiveRow, rowIdx, settings.zebraRows, settings.rowHoverEffect),
              )}
            >
              <div className={cn("w-10 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold bg-slate-50/50", cellBorderClass)}>
                {rowIdx + 1}
              </div>

              {filteredColumns.map((col) => {
                const isEditable = col.type !== "readonly";
                const editColIdx = isEditable ? editColCursor++ : -1;
                return (
                  <DocumentGridCell
                    key={col.key}
                    column={col}
                    line={line}
                    rowIndex={rowIdx}
                    editColIndex={editColIdx}
                    isCellActive={activeCell?.row === rowIdx && activeCell?.col === editColIdx}
                    refKey={`${rowIdx}-${editColIdx}`}
                    config={cellConfig}
                    callbacks={cellCallbacks}
                  />
                );
              })}

              <div className="w-12 shrink-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!readOnly && (
                  <button
                    onClick={() => onRemoveLine(rowIdx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="حذف السطر (Ctrl+Del)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {settings.showSummary && lines.length > 0 && (
          <GridSummaryRow
            filteredColumns={filteredColumns}
            lines={lines}
            cellBorderClass={cellBorderClass}
            columnWidths={columnWidths}
            formatRawAmount={formatRawAmount}
            docCurrency={docCurrency}
            baseCurrency={baseCurrency}
          />
        )}
      </div>

      <MaterialSearchPanel
        materials={materials}
        search={searchTerm}
        searchType={searchType}
        visible={showSearchPanel}
        onSelect={(m) => {
          if (readOnly) return;
          if (searchRow !== null) {
            onSelectMaterial(searchRow, m);
            setSearchRow(null);
            setSearchTerm("");
          }
        }}
        onClose={() => { setSearchRow(null); setSearchTerm(""); }}
      />
    </div>
  );
}
