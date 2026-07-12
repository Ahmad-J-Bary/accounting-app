import { useMemo, useRef, useCallback, type ReactNode } from "react";
import { GridHeader, type GridHeaderColumn } from "@widgets/table-shell/GridHeader";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { formatDateTime } from "@shared/lib/format";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns, useTableSettings, useGridResize } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { getLeftBorderClass, getRowBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
import type { GridResizeContent } from "@shared/hooks/useGridResize";
import { GroupedEntrySharedCell } from "./GroupedEntrySharedCell";
import { getHeaderText, getPrimitiveCellValue, SHARED_COLUMN_IDS } from "./groupedTableUtils";

import type { JournalEntryDto } from "@erp/shared-types";
import type { JournalFilters } from "../api/journalEntryService";
import { toJournalLines, type JournalRowLine } from "../lib/journal-view";

interface JournalTableProps {
  entries: JournalEntryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filters?: JournalFilters;
  filterBar?: React.ReactNode;
}

type SortField = "entry_number" | "created_at" | "journal_type" | "account";
type JournalTableRow = JournalRowLine & { isFirstInGroup: boolean };

export function JournalTable({ entries, loading, search, onSearchChange, filters, filterBar }: JournalTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();
  const { settings, getDensityPadding } = useTableSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  const tableData = useMemo(() => {
    const lines = entries.flatMap(e => toJournalLines(e));
    return lines.map((line, idx) => ({
      ...line,
      isFirstInGroup: idx === 0 || line.group_key !== lines[idx - 1].group_key,
    }));
  }, [entries]);

  const { sortedData, sortField, sortDirection, handleSort } = useSortable({
    data: tableData,
    defaultField: "created_at" as SortField,
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "entry_number":
          comparison = (parseInt(a.entry_number || "0", 10) || 0) - (parseInt(b.entry_number || "0", 10) || 0);
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "journal_type":
          comparison = (a.journal_type_display || "").localeCompare(b.journal_type_display || "", "ar");
          break;
        case "account":
          comparison = (a.account_name || "").localeCompare(b.account_name || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const allColumns = useMemo<UnifiedColumn<JournalTableRow>[]>(() => {
    const cols: UnifiedColumn<JournalTableRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (e) => e.isFirstInGroup ? e.entry_number : "",
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (e) => e.isFirstInGroup ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {e.journal_type_display}
          </span>
        ) : "",
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين (${symbol})`,
        label: `عليه / مدين (${symbol})`,
        accessor: (e) => {
          if (e.side !== "debit") return "";
          return e.amount_base > 0 ? formatAmount(e.amount_base, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-blue-700"
          : "tabular-nums font-medium text-blue-300"
      });
    });

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: `له / دائن (${symbol})`,
        label: `له / دائن (${symbol})`,
        accessor: (e) => {
          if (e.side !== "credit") return "";
          return e.amount_base > 0 ? formatAmount(e.amount_base, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-emerald-700"
          : "tabular-nums font-medium text-emerald-300"
      });
    });

    cols.push(
      {
        id: "description",
        header: "البيان",
        label: "البيان",
        accessor: (e) => e.isFirstInGroup ? e.description : "",
        className: "text-slate-700 font-bold"
      },
      {
        id: "account",
        header: "الحساب",
        label: "الحساب",
        accessor: (e) => (
          <span className={e.side === "debit" ? "text-blue-600 font-bold" : "text-emerald-600 font-bold"}>
            {e.account_name}
          </span>
        ),
      },
      {
        id: "entry_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (e) => e.isFirstInGroup ? formatDateTime(e.created_at) : "",
        className: "text-slate-500 tabular-nums"
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount, isBaseCurrency]);

  const defaultVisible = useMemo(() => {
    const def: string[] = ["entry_number", "journal_type"];
    sortedCurrencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        def.push(`debit_${curr.code}`);
      }
    });
    sortedCurrencies.forEach(curr => {
      if (isBaseCurrency(curr.code)) {
        def.push(`credit_${curr.code}`);
      }
    });
    def.push("description", "account", "entry_date");
    return def;
  }, [sortedCurrencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "journal-unified",
    columns: allColumns,
    defaultVisible,
  });

  const visibleColumns = useMemo(
    () => enrichedColumns.filter(c => c.visible !== false),
    [enrichedColumns],
  );

  const gridHeaderColumns = useMemo<GridHeaderColumn[]>(
    () => visibleColumns.map(col => ({
      id: col.id,
      header: col.header,
      label: col.label || getHeaderText(col),
      align: col.align,
    })),
    [visibleColumns],
  );

  const getColumnSampleValues = useCallback(
    (col: UnifiedColumn<JournalTableRow>): string[] =>
      sortedData
        .slice(0, 30)
        .map((row, idx) =>
          typeof col.accessor === "function"
            ? getPrimitiveCellValue(col.accessor(row, idx))
            : getPrimitiveCellValue(row[col.accessor as keyof JournalTableRow] as ReactNode),
        )
        .filter(Boolean),
    [sortedData],
  );

  const contentByColumn = useMemo(() => {
    const out: Record<string, GridResizeContent> = {};
    for (const col of visibleColumns) {
      out[col.id] = {
        headerText: getHeaderText(col),
        sampleValues: getColumnSampleValues(col),
      };
    }
    return out;
  }, [visibleColumns, getColumnSampleValues]);

  const { gridTemplateColumns, handleResizeStart, autoFitColumn } = useGridResize(
    visibleColumns,
    "unified_journal",
    containerRef,
    contentByColumn,
    settings.fontSize,
  );

  const groupedData = useMemo(() => {
    const groups: JournalTableRow[][] = [];
    let group: JournalTableRow[] = [];
    for (const row of sortedData) {
      if (row.isFirstInGroup && group.length > 0) {
        groups.push(group);
        group = [];
      }
      group.push(row);
    }
    if (group.length > 0) {
      groups.push(group);
    }
    return groups;
  }, [sortedData]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const baseDebitTotal = tableData.reduce((s, e) => s + (e.side === "debit" ? e.amount_base : 0), 0);
    const baseCreditTotal = tableData.reduce((s, e) => s + (e.side === "credit" ? e.amount_base : 0), 0);
    const baseBalance = baseDebitTotal - baseCreditTotal;
    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${tableData.length} سطر`, className: "text-slate-500 font-medium" };
      }
      if (id === "journal_type" || id === "description") {
        return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
      }

      if (id === "account") {
        const sign = baseBalance > 0 ? "مدين" : baseBalance < 0 ? "دائن" : "متزن";
        const label = `الرصيد / ${sign} (${baseSymbol})`;
        const value = formatAmount(Math.abs(baseBalance), { currencyCode: baseCurrency?.code || "" });
        const valueClass = baseBalance > 0
          ? "text-blue-700 font-black"
          : baseBalance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return { id: `${id}_balance`, columnId: id, label, value, className: valueClass };
      }
      if (id === "entry_date") {
        const sec = sortedCurrencies.length > 1 ? sortedCurrencies[1] : null;
        const curr = sec || baseCurrency;
        const code = curr?.code || "";
        const sym = curr?.symbol || code;
        const sign = baseBalance > 0 ? "مدين" : baseBalance < 0 ? "دائن" : "متزن";
        const label = `الرصيد / ${sign} (${sym})`;
        const value = formatAmount(Math.abs(baseBalance), { currencyCode: code });
        const valueClass = baseBalance > 0
          ? "text-blue-700 font-black"
          : baseBalance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return { id: `${id}_balance`, columnId: id, label, value, className: valueClass };
      }

      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        const isB = isBaseCurrency(currCode);
        const label = col.label || `عليه / مدين (${currCode})`;
        return {
          id: `${id}_total`,
          columnId: id,
          label,
          value: baseDebitTotal > 0 ? formatAmount(baseDebitTotal, { currencyCode: currCode }) : "—",
          className: isB
            ? "text-blue-700 font-black"
            : "text-blue-300 font-extrabold"
        };
      }

      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        const isB = isBaseCurrency(currCode);
        const label = col.label || `له / دائن (${currCode})`;
        return {
          id: `${id}_total`,
          columnId: id,
          label,
          value: baseCreditTotal > 0 ? formatAmount(baseCreditTotal, { currencyCode: currCode }) : "—",
          className: isB
            ? "text-emerald-700 font-black"
            : "text-emerald-300 font-extrabold"
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [tableData, formatAmount, enrichedColumns, isBaseCurrency, baseCurrency, sortedCurrencies]);

  const visibleColumnIds = useMemo(
    () => new Set(visibleColumns.map(c => c.id)),
    [visibleColumns],
  );

  const filteredSummary = useMemo(() => {
    if (!summaryColumns?.length) return undefined;
    return summaryColumns.filter(s => {
      if (!s.columnId) return true;
      return visibleColumnIds.has(s.columnId);
    });
  }, [summaryColumns, visibleColumnIds]);

  const showSummary = !!(
    filteredSummary?.length && settings.showSummary && groupedData.length > 0
  );

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  const getCellStyle = useCallback((): React.CSSProperties => ({
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: `${settings.fontSize}px`,
    fontFamily: settings.fontFamily,
  }), [settings.fontSize, settings.fontFamily]);

  const handleHeaderCellClick = useCallback((colId: string) => {
    if (["entry_number", "journal_type", "account", "created_at"].includes(colId)) {
      handleSort(colId as SortField);
    }
  }, [handleSort]);

  const renderBody = () => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className={cn("animate-pulse", getRowBorderClass(settings.borderStyle))}
          style={{ display: "grid", gridTemplateColumns }}
          dir="rtl"
        >
          {visibleColumns.map(col => (
            <div
              key={col.id}
              className={cn(getDensityPadding(), cellBorderClass)}
              style={{ minWidth: 0 }}
            >
              <Skeleton
                className={cn(
                  "h-3.5 rounded",
                  col.align === "left"
                    ? "mr-auto ml-0 w-3/4"
                    : col.align === "center"
                    ? "mx-auto w-1/2"
                    : "ml-auto mr-0 w-3/4",
                )}
              />
            </div>
          ))}
        </div>
      ));
    }

    if (groupedData.length === 0) {
      return <EmptyState message="لا توجد قيود يومية مسجلة" />;
    }

    return groupedData.map((group, groupIdx) => {
      const first = group[0];
      const rowCount = group.length;

      return (
        <div
          key={`group-${first.group_key}-${groupIdx}`}
          dir="rtl"
          className={cn(
            "transition-all duration-75",
            getRowBorderClass(settings.borderStyle),
            getRowBackgroundClass(false, groupIdx, settings.zebraRows, settings.rowHoverEffect),
          )}
          style={{
            display: "grid",
            gridTemplateColumns,
            gridTemplateRows: `repeat(${rowCount}, auto)`,
          }}
        >
          {visibleColumns.flatMap((col, colIdx) => {
            const columnPosition = colIdx + 1;
            const isShared = SHARED_COLUMN_IDS.has(col.id);

            if (isShared) {
              const value = typeof col.accessor === "function"
                ? col.accessor(first, 0)
                : (first[col.accessor as keyof JournalTableRow] as ReactNode);

              return (
                <GroupedEntrySharedCell
                  key={`${col.id}`}
                  rowCount={rowCount}
                  columnPosition={columnPosition}
                  densityClassName={getDensityPadding()}
                  borderClassName={cellBorderClass}
                  className={col.className}
                  fontSize={settings.fontSize}
                  fontFamily={settings.fontFamily}
                >
                  {value}
                </GroupedEntrySharedCell>
              );
            }

            return group.map((row, rowIdx) => {
              const val = typeof col.accessor === "function"
                ? col.accessor(row, 0)
                : (row[col.accessor as keyof JournalTableRow] as ReactNode);

              return (
                <div
                  key={`${col.id}-${rowIdx}`}
                  style={{
                    gridRow: rowIdx + 1,
                    gridColumn: String(columnPosition),
                    ...getCellStyle(),
                  }}
                  className={cn(
                    getDensityPadding(),
                    cellBorderClass,
                    "text-slate-600",
                    col.className,
                  )}
                >
                  {val || ""}
                </div>
              );
            });
          })}
        </div>
      );
    });
  };

  return (
    <TableShell
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم القيد أو البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
      filterBar={filterBar}
    >
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative custom-scrollbar"
        style={{ scrollbarGutter: "stable" }}
      >
        <GridHeader
          columns={gridHeaderColumns}
          getDensityPadding={getDensityPadding}
          fontSize={settings.fontSize}
          fontFamily={settings.fontFamily}
          headerColor={settings.headerColor}
          stickyHeader={settings.stickyHeader}
          borderStyle={settings.borderStyle}
          enableResize
          onHeaderCellClick={handleHeaderCellClick}
          onResizeStart={handleResizeStart}
          onAutoFit={autoFitColumn}
          gridTemplate={gridTemplateColumns}
          sortField={sortField}
          sortDirection={sortDirection}
        />

        {renderBody()}
      </div>

      {showSummary && (
        <div style={{ paddingInlineEnd: 8 }}>
          <TableSummary
            columns={filteredSummary!}
            gridTemplate={gridTemplateColumns}
            asPageFooter
          />
        </div>
      )}
    </TableShell>
  );
}
