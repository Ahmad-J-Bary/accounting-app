import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Trash2, Columns, RotateCcw } from "lucide-react";
import type { MaterialDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { getRowBackgroundClass, getRowBorderClass, getLeftBorderClass } from "@shared/lib/table-utils";
import { GridLine } from "@modules/invoicing/lib/invoiceUtils";

import { useColumnPreferences } from "@shared/hooks/useColumnPreferences";
import { MaterialSearchPanel } from "./MaterialSearchPanel";
import { DocumentGridCell, type DocumentGridConfig, type DocumentGridCallbacks } from "./DocumentGridCell";
import { GridHeader } from "@widgets/table-shell/GridHeader";
import { GridSummaryRow } from "./GridSummaryRow";
import { useColumnResize } from "./useColumnResize";
import { useTableSettings } from "@shared/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@shared/ui/dropdown-menu";
import { Button } from "@shared/ui/button";
import {
  formatWithLocale,
  useCurrencyContext,
} from "@app/providers/CurrencyContext";

export interface DocumentColumn {
  key: string;
  header: string;
  width: string;
  align?: "right" | "left" | "center";
  /** When false, the column is hidden by default (user can show via column picker) */
  defaultVisible?: boolean;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const defaultVisible = useMemo(() => columns.filter((c) => c.defaultVisible !== false).map((c) => c.key), [columns]);
  const allColumnIds = useMemo(() => columns.map((c) => c.key), [columns]);
  const { visibleColumns, toggleColumn, isVisible, isModified, resetToDefault } = useColumnPreferences({
    tableId: preferenceKey,
    allColumnIds,
    defaultVisibleColumns: defaultVisible,
  });

  const filteredColumns = useMemo(
    () => columns.filter((c) => visibleColumns.includes(c.key)),
    [columns, visibleColumns],
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

  const contentByColumn = useMemo(() => {
    const out: Record<string, { headerText: string; sampleValues: string[] }> = {};
    for (const col of filteredColumns) {
      out[col.key] = {
        headerText: col.header,
        sampleValues: lines.slice(0, 30).map(line => getCellValue(line, col.key)).filter(Boolean),
      };
    }
    return out;
  }, [filteredColumns, lines, getCellValue]);

  const { gridTemplateColumns, gridHeaderColumns, handleResizeStart, autoFitColumn } = useColumnResize(
    filteredColumns,
    preferenceKey,
    scrollContainerRef,
    contentByColumn,
  );

  const fullGridTemplate = useMemo(
    () => `48px ${gridTemplateColumns} 48px`,
    [gridTemplateColumns],
  );

  const handleAutoFit = useCallback(
    (colKey: string) => {
      autoFitColumn(colKey, {
        headerText: columns.find(c => c.key === colKey)?.header ?? colKey,
        sampleValues: lines.slice(0, 30).map(line => getCellValue(line, colKey)).filter(Boolean),
      });
    },
    [autoFitColumn, columns, lines, getCellValue],
  );

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

  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (searchRow === null) {
      setPanelStyle(null);
      return;
    }
    const colKeyMap: Record<string, string> = { name: "material_name", code: "material_code", barcode: "unit_barcode" };
    const colKey = colKeyMap[searchType];
    const rowEl = scrollContainerRef.current?.querySelector(`[data-row-idx="${searchRow}"]`);
    const cellEl = rowEl?.querySelector<HTMLElement>(`[data-col-id="${colKey}"]`) ?? rowEl?.querySelector<HTMLElement>("[data-col-id]");
    if (!cellEl) { setPanelStyle(null); return; }
    const rect = cellEl.getBoundingClientRect();
    const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
    const maxWidth = scrollRect ? scrollRect.width - 16 : 420;
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.min(Math.max(rect.width, 380), maxWidth),
      zIndex: 100,
    });
  }, [searchRow, searchType]);

  const cellConfig: DocumentGridConfig = {
    cellBorderClass,
    densityPadding: getDensityPadding(),
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
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

  const visibleCount = columns.filter((c) => isVisible(c.key)).length;
  const totalCount = columns.length;

  const headerPrefix = (
    <div className={cn("w-10 shrink-0 flex items-center justify-center bg-slate-100/30", getLeftBorderClass(settings.borderStyle))}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "p-1 transition-colors rounded",
              isModified
                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                : "text-slate-400 hover:text-blue-600 hover:bg-blue-50",
            )}
            title="إظهار / إخفاء الأعمدة"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-h-[420px] overflow-y-auto shadow-xl">
          <DropdownMenuLabel className="flex items-center justify-between text-right gap-2">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
              إظهار / إخفاء الأعمدة
            </span>
            <span className={cn(
              "text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded",
              isModified
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            )}>
              {visibleCount} / {totalCount}
            </span>
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
          {resetToDefault && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={resetToDefault}
                disabled={!isModified}
                className="flex-row-reverse text-blue-600 focus:text-blue-600 disabled:text-slate-400 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 ml-2" />
                استعادة الأعمدة الافتراضية
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const headerSuffix = <div className="w-12 shrink-0" />;

  return (
    <div className="flex flex-col h-full bg-white">
      <GridHeader
        columns={gridHeaderColumns}
        getDensityPadding={getDensityPadding}
        fontSize={settings.fontSize}
        fontFamily={settings.fontFamily}
        headerColor={settings.headerColor}
        stickyHeader={settings.stickyHeader}
        borderStyle={settings.borderStyle}
        gridTemplate={fullGridTemplate}
        prefixSlot={headerPrefix}
        suffixSlot={headerSuffix}
        onResizeStart={handleResizeStart}
        onAutoFit={handleAutoFit}
      />

      <div ref={scrollContainerRef} className="flex-1 overflow-auto min-h-[300px] custom-scrollbar">
        {lines.map((line, rowIdx) => {
          const isActiveRow = activeCell?.row === rowIdx;
          let editColCursor = 0;

          return (
            <div
              key={line._id}
              data-row-idx={rowIdx}
              style={{ display: "grid", gridTemplateColumns: fullGridTemplate }}
              className={cn(
                "transition-colors duration-75 group min-w-0",
                getRowBorderClass(settings.borderStyle),
                getRowBackgroundClass(isActiveRow, rowIdx, settings.zebraRows, settings.rowHoverEffect),
              )}
            >
              <div className={cn("w-10 flex items-center justify-center text-[10px] text-slate-400 font-bold bg-slate-50/50", cellBorderClass)}>
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

              <div className="w-12 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>

      {settings.showSummary && lines.length > 0 && (
        <GridSummaryRow
          filteredColumns={filteredColumns}
          lines={lines}
          cellBorderClass={cellBorderClass}
          formatRawAmount={formatRawAmount}
          docCurrency={docCurrency}
          baseCurrency={baseCurrency}
          asPageFooter
          gridTemplate={fullGridTemplate}
        />
      )}

      {showSearchPanel && panelStyle && (
        <MaterialSearchPanel
          materials={materials}
          search={searchTerm}
          searchType={searchType}
          columns={columns}
          visibleColumnKeys={visibleColumns}
          style={panelStyle}
          onSelect={(m) => {
            if (readOnly) return;
            if (searchRow !== null) {
              onSelectMaterial(searchRow, m);
              setSearchRow(null);
              setSearchTerm("");
              setPanelStyle(null);
            }
          }}
          onClose={() => { setSearchRow(null); setSearchTerm(""); setPanelStyle(null); }}
        />
      )}
    </div>
  );
}
