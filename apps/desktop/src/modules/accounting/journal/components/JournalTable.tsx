import { useMemo, useRef, useCallback, useEffect, type ReactNode } from "react";
import { Download, Undo2 } from "lucide-react";
import { GridHeader, type GridHeaderColumn } from "@widgets/table-shell/GridHeader";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { Skeleton } from "@shared/ui/skeleton";
import { Button } from "@shared/ui/button";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { useExportSetup, useUnifiedColumns, useSortable, useBaseCurrencyColumns, useTableSettings, useGridResize, type GridResizeContent } from "@shared/hooks";
import type { ExcelExportColumn, ExcelExportOptions } from "@shared/lib/excel";
import { dateCol, executeExport, estimateExcelWidth, debitCreditAmountCols } from "@shared/lib/excel";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { getLeftBorderClass, getRowBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
import { GroupedEntrySharedCell } from "./GroupedEntrySharedCell";
import { getHeaderText, getPrimitiveCellValue, SHARED_COLUMN_IDS } from "./groupedTableUtils";

import type { JournalEntryDto } from "@erp/shared-types";
import type { JournalFilters } from "@modules/accounting/api/journalEntryService";
import { auditGroupKey, toJournalLines, toJournalLinesSingleLine, journalTwoLineCompare, type JournalRowLine, type JournalSingleLineRow, type ReversalContext } from "../lib/journal-view";

type DisplayMode = "two-line" | "one-line";

interface JournalTableProps {
  entries: JournalEntryDto[];
  /** Audit archive: Reversed originals + contra journals + Draft +
   * Cancelled. Rendered in a clearly separated section below the operational
   * posted list, never interleaved with normal transactions. */
  auditEntries?: JournalEntryDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  filters?: JournalFilters;
  filterBar?: React.ReactNode;
  displayMode?: DisplayMode;
  onReverse?: (id: string) => void;
  reversingId?: string | null;
  /** Reversal-pair lookup (built once over the full fetch by the page) used to
   * show each audit entry's counterpart number (عكس القيد #N / عكسه القيد #M). */
  reversalContext?: ReversalContext;
}

type SortFieldTwoLine = "entry_number" | "created_at" | "journal_type" | "account";
type SortFieldOneLine = "entry_number" | "created_at" | "journal_type" | "debit_accounts" | "credit_accounts";
type JournalTableRow = JournalRowLine & { isFirstInGroup: boolean };
type JournalSingleLineTableRow = JournalSingleLineRow & { isFirstInGroup: boolean };

function buildJournalMergeRanges(rows: JournalTableRow[], visibleColumnIds: string[]): NonNullable<ExcelExportOptions["mergeCells"]> {
  const mergeableColumns = ["entry_number", "journal_type", "description", "entry_date"]
    .filter((columnId) => visibleColumnIds.includes(columnId));

  if (mergeableColumns.length === 0 || rows.length <= 1) {
    return [];
  }

  const merges: NonNullable<ExcelExportOptions["mergeCells"]> = [];
  let startIndex = 0;

  while (startIndex < rows.length) {
    const entryNumber = rows[startIndex]?.entry_number;
    let endIndex = startIndex;

    while (endIndex + 1 < rows.length && rows[endIndex + 1]?.entry_number === entryNumber) {
      endIndex += 1;
    }

    if (endIndex > startIndex) {
      mergeableColumns.forEach((columnId) => {
        merges.push({
          columnId,
          startRow: startIndex,
          endRow: endIndex,
        });
      });
    }

    startIndex = endIndex + 1;
  }

  return merges;
}

export function JournalTable({ 
  entries, 
  auditEntries,
  loading, 
  search, 
  onSearchChange, 
  filterBar, 
  displayMode = "two-line",
  onReverse,
  reversingId,
  reversalContext,
}: JournalTableProps) {
  const { isBaseCurrency, currencySuffix: cs, hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { settings, getDensityPadding } = useTableSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const { exportData, baseCurrency, rateMap, sortedCurrencies, formatAmount, baseCode, ratesSheet, currencyMode } = useExportSetup();

  const isTwoLine = displayMode === "two-line";

  // ============ DATA (computed for both modes, but typed separately) ============
  const twoLineData = useMemo(() => {
    const lines = entries.flatMap(e => toJournalLines(e, reversalContext));
    return lines.map((line, idx) => ({
      ...line,
      isFirstInGroup: idx === 0 || line.group_key !== lines[idx - 1].group_key,
    })) as JournalTableRow[];
  }, [entries, reversalContext]);

  const singleLineData = useMemo(() => {
    const lines = entries.flatMap(e => toJournalLinesSingleLine(e, reversalContext));
    return lines.map((line, idx) => ({
      ...line,
      isFirstInGroup: idx === 0 || line.group_key !== lines[idx - 1].group_key,
    })) as JournalSingleLineTableRow[];
  }, [entries, reversalContext]);

  // ============ SORTING (separate hooks per mode) ============
  const twoLineSort = useSortable({
    data: twoLineData,
    defaultField: (localStorage.getItem("journal-sort-field-two-line") as SortFieldTwoLine) || "entry_number",
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => journalTwoLineCompare(a, b, field as SortFieldTwoLine, direction),
  });

  const singleLineSort = useSortable({
    data: singleLineData,
    defaultField: (localStorage.getItem("journal-sort-field-one-line") as SortFieldOneLine) || "entry_number",
    defaultDirection: "desc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "entry_number":
          comparison = (parseInt(a.entry_number || "0", 10) || 0) - (parseInt(b.entry_number || "0", 10) || 0);
          break;
        case "created_at":
          comparison = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
          break;
        case "journal_type":
          comparison = (a.journal_type_display || "").localeCompare(b.journal_type_display || "", "ar");
          break;
        case "debit_accounts":
          comparison = (a.debit_account_names || "").localeCompare(b.debit_account_names || "", "ar");
          break;
        case "credit_accounts":
          comparison = (a.credit_account_names || "").localeCompare(b.credit_account_names || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  // ============ COLUMNS (built per mode) ============
  const twoLineColumns = useMemo<UnifiedColumn<JournalTableRow>[]>(() => {
    const cols: UnifiedColumn<JournalTableRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (e) => e.isFirstInGroup ? formatNumber(parseInt(e.entry_number) || 0) : "",
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (e) => e.isFirstInGroup ? (
          <span className="inline-flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
                {e.journal_type_display}
              </span>
              {e.is_contra && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700">
                  عكس
                </span>
              )}
              {e.status === "Reversed" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-600">
                  معكوس
                </span>
              )}
              {e.status === "Draft" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-200 text-slate-600">
                  مسودة
                </span>
              )}
              {e.status === "Cancelled" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-300 text-slate-700">
                  ملغي
                </span>
              )}
              {e.status === "Posted" && !e.is_contra && onReverse && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reversingId === e.id}
                  onClick={() => onReverse(e.id)}
                  className="h-6 px-2 text-[10px] font-bold text-red-600 hover:bg-red-50"
                >
                  <Undo2 className="w-3 h-3 ml-1" />
                  {reversingId === e.id ? "جارٍ..." : "عكس"}
                </Button>
              )}
            </span>
            {e.reversal_entry_number && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500">
                {e.is_contra ? `عكس القيد #${e.reversal_entry_number}` : `عكسه القيد #${e.reversal_entry_number}`}
              </span>
            )}
          </span>
        ) : "",
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين${cs(symbol)}`,
        label: `عليه / مدين${cs(symbol)}`,
        accessor: (e: JournalTableRow) => {
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
        header: `له / دائن${cs(symbol)}`,
        label: `له / دائن${cs(symbol)}`,
        accessor: (e: JournalTableRow) => {
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
        accessor: (e: JournalTableRow) => (
          <span className={e.side === "debit" ? "text-blue-600 font-bold" : "text-emerald-600 font-bold"}>
            {e.account_name}
          </span>
        ),
      },
      {
        id: "entry_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (e) => e.isFirstInGroup ? formatDateTime(e.entry_date) : "",
        className: "text-slate-500 tabular-nums"
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount, isBaseCurrency, cs, onReverse, reversingId]);

  const singleLineColumns = useMemo<UnifiedColumn<JournalSingleLineTableRow>[]>(() => {
    const cols: UnifiedColumn<JournalSingleLineTableRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (e) => formatNumber(parseInt(e.entry_number) || 0),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (e) => (
          <span className="inline-flex flex-col items-start gap-0.5">
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
                {e.journal_type_display}
              </span>
              {e.is_contra && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700">
                  عكس
                </span>
              )}
              {e.status === "Reversed" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-600">
                  معكوس
                </span>
              )}
              {e.status === "Draft" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-200 text-slate-600">
                  مسودة
                </span>
              )}
              {e.status === "Cancelled" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-300 text-slate-700">
                  ملغي
                </span>
              )}
              {e.status === "Posted" && !e.is_contra && onReverse && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reversingId === e.id}
                  onClick={() => onReverse(e.id)}
                  className="h-6 px-2 text-[10px] font-bold text-red-600 hover:bg-red-50"
                >
                  <Undo2 className="w-3 h-3 ml-1" />
                  {reversingId === e.id ? "جارٍ..." : "عكس"}
                </Button>
              )}
            </span>
            {e.reversal_entry_number && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500">
                {e.is_contra ? `عكس القيد #${e.reversal_entry_number}` : `عكسه القيد #${e.reversal_entry_number}`}
              </span>
            )}
          </span>
        ),
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين${cs(symbol)}`,
        label: `عليه / مدين${cs(symbol)}`,
        accessor: (e: JournalSingleLineTableRow) =>
          e.debit_amount_base > 0 ? formatAmount(e.debit_amount_base, { currencyCode: curr.code }) : "",
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
        header: `له / دائن${cs(symbol)}`,
        label: `له / دائن${cs(symbol)}`,
        accessor: (e: JournalSingleLineTableRow) =>
          e.credit_amount_base > 0 ? formatAmount(e.credit_amount_base, { currencyCode: curr.code }) : "",
        className: isBase
          ? "tabular-nums font-black text-emerald-700"
          : "tabular-nums font-medium text-emerald-300"
      });
    });

    cols.push({
        id: "description",
        header: "البيان",
        label: "البيان",
        accessor: (e) => e.description,
        className: "text-slate-700 font-bold"
      },
      {
        id: "debit_accounts",
        header: "الحساب المدين / الوجهة",
        label: "الحساب المدين / الوجهة",
        accessor: (e: JournalSingleLineTableRow) => (
          <span className="text-blue-600 font-bold">{e.debit_account_names}</span>
        ),
      },
      {
        id: "credit_accounts",
        header: "الحساب الدائن / المصدر",
        label: "الحساب الدائن / المصدر",
        accessor: (e: JournalSingleLineTableRow) => (
          <span className="text-emerald-600 font-bold">{e.credit_account_names}</span>
        ),
      },
      {
        id: "entry_date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (e) => formatDateTime(e.entry_date),
        className: "text-slate-500 tabular-nums"
      },
    );
    return cols;
  }, [formatAmount, cs, sortedCurrencies, isBaseCurrency, onReverse, reversingId]);

  // ============ SELECT ACTIVE DATA/COLUMNS/SORT ============
  const sortedData = isTwoLine ? twoLineSort.sortedData : singleLineSort.sortedData;
  const sortField = isTwoLine ? twoLineSort.sortField : singleLineSort.sortField;
  const sortDirection = isTwoLine ? twoLineSort.sortDirection : singleLineSort.sortDirection;

  useEffect(() => {
    const key = isTwoLine ? "journal-sort-field-two-line" : "journal-sort-field-one-line";
    localStorage.setItem(key, sortField);
  }, [sortField, isTwoLine]);
  
  // Unified handleSort that narrows the field type
  const handleSort = useCallback((field: string) => {
    if (isTwoLine) {
      twoLineSort.handleSort(field as SortFieldTwoLine);
    } else {
      singleLineSort.handleSort(field as SortFieldOneLine);
    }
  }, [isTwoLine, twoLineSort, singleLineSort]);

  const defaultVisible = useMemo(() => {
    const def: string[] = ["entry_number", "journal_type"];
    if (isTwoLine) {
      sortedCurrencies.forEach(curr => {
        if (isBaseCurrency(curr.code)) def.push(`debit_${curr.code}`);
      });
      sortedCurrencies.forEach(curr => {
        if (isBaseCurrency(curr.code)) def.push(`credit_${curr.code}`);
      });
      def.push("description", "account", "entry_date");
    } else {
      sortedCurrencies.forEach(curr => {
        if (isBaseCurrency(curr.code)) def.push(`debit_${curr.code}`);
      });
      sortedCurrencies.forEach(curr => {
        if (isBaseCurrency(curr.code)) def.push(`credit_${curr.code}`);
      });
      def.push("description", "debit_accounts", "credit_accounts", "entry_date");
    }
    return def;
  }, [sortedCurrencies, isBaseCurrency, isTwoLine]);

  // ============ UNIFIED COLUMNS (separate per mode) ============
  const twoLineUnified = useUnifiedColumns({
    tableId: "journal-unified-two-line",
    columns: twoLineColumns,
    defaultVisible,
  });

  const singleLineUnified = useUnifiedColumns({
    tableId: "journal-unified-one-line",
    columns: singleLineColumns,
    defaultVisible,
  });

  const { 
    enrichedColumns, 
    toolbarColumns, 
    toggleColumn, 
    resetToDefault, 
    isModified 
  } = isTwoLine ? twoLineUnified : singleLineUnified;

  const visibleColumns = useMemo(
    () => enrichedColumns.filter(c => c.visible !== false),
    [enrichedColumns],
  );

  const gridHeaderColumns = useMemo<GridHeaderColumn[]>(
    () => visibleColumns.map(col => ({
      id: col.id,
      header: col.header,
      label: col.label || getHeaderText(col as UnifiedColumn<JournalTableRow>),
      align: col.align,
    })),
    [visibleColumns],
  );

  const getColumnSampleValues = useCallback(
    (col: UnifiedColumn<JournalTableRow> | UnifiedColumn<JournalSingleLineTableRow>): string[] => {
      if (isTwoLine) {
        const twoLineCol = col as UnifiedColumn<JournalTableRow>;
        return twoLineData
          .slice(0, 30)
          .map((row, idx) =>
            typeof twoLineCol.accessor === "function"
              ? getPrimitiveCellValue(twoLineCol.accessor(row, idx))
              : getPrimitiveCellValue(row[twoLineCol.accessor as keyof JournalTableRow] as ReactNode),
          )
          .filter(Boolean);
      } else {
        const singleLineCol = col as UnifiedColumn<JournalSingleLineTableRow>;
        return singleLineData
          .slice(0, 30)
          .map((row, idx) =>
            typeof singleLineCol.accessor === "function"
              ? getPrimitiveCellValue(singleLineCol.accessor(row, idx))
              : getPrimitiveCellValue(row[singleLineCol.accessor as keyof JournalSingleLineTableRow] as ReactNode),
          )
          .filter(Boolean);
      }
    },
    [isTwoLine, twoLineData, singleLineData],
  );

  const contentByColumn = useMemo(() => {
    const out: Record<string, GridResizeContent> = {};
    for (const col of visibleColumns) {
      out[col.id] = {
        headerText: getHeaderText(col as UnifiedColumn<JournalTableRow>),
        sampleValues: getColumnSampleValues(col as UnifiedColumn<JournalTableRow> | UnifiedColumn<JournalSingleLineTableRow>),
      };
    }
    return out;
  }, [visibleColumns, getColumnSampleValues]);

  const { gridTemplateColumns, handleResizeStart, autoFitColumn } = useGridResize(
    visibleColumns,
    `unified_journal_${displayMode}`,
    containerRef,
    contentByColumn,
    settings.fontSize,
  );

  // ============ GROUPED DATA ============
  const groupedData = useMemo(() => {
    if (isTwoLine) {
      const groups: JournalTableRow[][] = [];
      let group: JournalTableRow[] = [];
      for (const row of twoLineSort.sortedData) {
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
    } else {
      const groups: JournalSingleLineTableRow[][] = [];
      let group: JournalSingleLineTableRow[] = [];
      for (const row of singleLineSort.sortedData) {
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
    }
  }, [isTwoLine, twoLineSort.sortedData, singleLineSort.sortedData]);

  // ============ AUDIT ARCHIVE (separated section) ============
  // Reversal pairs are kept adjacent via auditGroupKey so the Reversed
  // original and its contra always read as ONE audit story, never as two
  // interleaved operational rows.
  const auditEntriesSorted = useMemo(() => {
    const list = auditEntries || [];
    return [...list].sort((a, b) => {
      const ga = auditGroupKey(a);
      const gb = auditGroupKey(b);
      if (ga !== gb) return ga.localeCompare(gb);
      return (parseInt(a.entry_number || "0", 10) || 0) - (parseInt(b.entry_number || "0", 10) || 0);
    });
  }, [auditEntries]);

  const auditGroupedData = useMemo(() => {
    if (auditEntriesSorted.length === 0) return [];
    if (isTwoLine) {
      const lines = auditEntriesSorted.flatMap((e) => toJournalLines(e, reversalContext)) as JournalRowLine[];
      const rows = lines.map((line, idx) => ({
        ...line,
        isFirstInGroup: idx === 0 || line.group_key !== lines[idx - 1].group_key,
      })) as JournalTableRow[];
      const groups: JournalTableRow[][] = [];
      let group: JournalTableRow[] = [];
      for (const row of rows) {
        if (row.isFirstInGroup && group.length > 0) {
          groups.push(group);
          group = [];
        }
        group.push(row);
      }
      if (group.length > 0) groups.push(group);
      return groups;
    }
    const lines = auditEntriesSorted.flatMap((e) => toJournalLinesSingleLine(e, reversalContext)) as JournalSingleLineRow[];
    const rows = lines.map((line, idx) => ({
      ...line,
      isFirstInGroup: idx === 0 || line.group_key !== lines[idx - 1].group_key,
    })) as JournalSingleLineTableRow[];
    const groups: JournalSingleLineTableRow[][] = [];
    let group: JournalSingleLineTableRow[] = [];
    for (const row of rows) {
      if (row.isFirstInGroup && group.length > 0) {
        groups.push(group);
        group = [];
      }
      group.push(row);
    }
    if (group.length > 0) groups.push(group);
    return groups;
  }, [auditEntriesSorted, isTwoLine, reversalContext]);

  // ============ SUMMARY COLUMNS ============
  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    let baseDebitTotal = 0;
    let baseCreditTotal = 0;

    if (isTwoLine) {
      baseDebitTotal = twoLineData.reduce((s, e) => s + (e.side === "debit" ? e.amount_base : 0), 0);
      baseCreditTotal = twoLineData.reduce((s, e) => s + (e.side === "credit" ? e.amount_base : 0), 0);
    } else {
      baseDebitTotal = singleLineData.reduce((s, e) => s + e.debit_amount_base, 0);
      baseCreditTotal = singleLineData.reduce((s, e) => s + e.credit_amount_base, 0);
    }

    const baseBalance = baseDebitTotal - baseCreditTotal;
    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${sortedData.length} سطر`, className: "text-slate-500 font-medium" };
      }
      if (id === "journal_type" || id === "description") {
        return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
      }

      if (isTwoLine) {
        if (id === "account") {
          const sign = baseBalance > 0 ? "مدين" : baseBalance < 0 ? "دائن" : "متزن";
          const label = `الرصيد / ${sign}${cs(baseSymbol)}`;
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
          const label = `الرصيد / ${sign}${cs(sym)}`;
          const value = formatAmount(Math.abs(baseBalance), { currencyCode: code });
          const valueClass = baseBalance > 0
            ? "text-blue-700 font-black"
            : baseBalance < 0
            ? "text-emerald-700 font-black"
            : "text-slate-500 font-bold";
          return { id: `${id}_balance`, columnId: id, label, value, className: valueClass };
        }
      }

      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        const isB = isBaseCurrency(currCode);
        const label = col.label || `عليه / مدين${cs(currCode)}`;
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
        const label = col.label || `له / دائن${cs(currCode)}`;
        return {
          id: `${id}_total`,
          columnId: id,
          label,
          value: baseCreditTotal > 0 ? formatAmount(-baseCreditTotal, { currencyCode: currCode }) : "—",
          className: isB
            ? "text-emerald-700 font-black"
            : "text-emerald-300 font-extrabold"
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, formatAmount, isBaseCurrency, baseCurrency, sortedCurrencies, sortedData, isTwoLine, twoLineData, singleLineData, cs]);

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
    if (colId === "entry_date") {
      handleSort("created_at");
      return;
    }
    handleSort(colId);
  }, [handleSort]);

  // ============ EXPORT VALUE FUNCTIONS (separate per mode) ============
  const getTwoLineExportValue = useCallback(
    (row: JournalTableRow, col: UnifiedColumn<JournalTableRow>): string | number => {
      if (col.id === "entry_number") return parseInt(row.entry_number, 10) || 0;
      if (col.id === "journal_type") return row.journal_type_display;
      if (col.id === "description") return row.description;
      if (col.id === "account") return row.account_name;
      if (col.id === "entry_date") return formatDateTime(row.entry_date);

      const debitMatch = col.id.match(/^debit_(.+)$/);
      if (debitMatch) {
        return row.side === "debit" && row.amount_base > 0
          ? row.amount_base
          : 0;
      }

      const creditMatch = col.id.match(/^credit_(.+)$/);
      if (creditMatch) {
        return row.side === "credit" && row.amount_base > 0
          ? -row.amount_base
          : 0;
      }

      const fallbackValue = typeof col.accessor === "function"
        ? col.accessor(row, 0)
        : row[col.accessor as keyof JournalTableRow];
      return getPrimitiveCellValue(fallbackValue as ReactNode);
    },
    []
  );

  const getSingleLineExportValue = useCallback(
    (row: JournalSingleLineTableRow, col: UnifiedColumn<JournalSingleLineTableRow>): string | number => {
      if (col.id === "entry_number") return parseInt(row.entry_number, 10) || 0;
      if (col.id === "journal_type") return row.journal_type_display;
      if (col.id === "description") return row.description;
      if (col.id === "entry_date") return formatDateTime(row.entry_date);
      if (col.id === "debit_accounts") return row.debit_account_names;
      if (col.id === "credit_accounts") return row.credit_account_names;

      const debitMatch = col.id.match(/^debit_(.+)$/);
      if (debitMatch) {
        return row.debit_amount_base > 0 ? row.debit_amount_base : 0;
      }

      const creditMatch = col.id.match(/^credit_(.+)$/);
      if (creditMatch) {
        return row.credit_amount_base > 0 ? -row.credit_amount_base : 0;
      }

      const fallbackValue = typeof col.accessor === "function"
        ? col.accessor(row, 0)
        : row[col.accessor as keyof JournalSingleLineTableRow];
      return getPrimitiveCellValue(fallbackValue as ReactNode);
    },
    []
  );

  const handleExport = useCallback(async () => {
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};

    const dcCols = debitCreditAmountCols(
      (row) => {
        if (isTwoLine) {
          const r = row as unknown as JournalTableRow;
          return {
            debit: r.side === "debit" ? r.amount_base : 0,
            credit: r.side === "credit" ? r.amount_base : 0,
          };
        }
        const r = row as unknown as JournalSingleLineTableRow;
        return { debit: r.debit_amount_base, credit: r.credit_amount_base };
      },
      sortedCurrencies, hasSecondaryCurrencies, currencyMode, baseCode, rateMap,
    );
    const dcColMap = new Map(dcCols.map(c => [c.id, c]));

    const exportColumns: ExcelExportColumn[] = enrichedColumns.map((col) => {
      const twoLineCol = col as UnifiedColumn<JournalTableRow>;
      const singleLineCol = col as UnifiedColumn<JournalSingleLineTableRow>;
      const label = col.label || getHeaderText(twoLineCol);

      const isDebitCredit = /^(debit|credit)_(?!accounts)/.test(col.id);

      if (isDebitCredit) {
        summary[col.id] = 'subtotal';
      }

      if (col.id === "entry_date") {
        return dateCol("entry_date", label, (row) => {
          const r = row as unknown as JournalTableRow | JournalSingleLineTableRow;
          return r.entry_date;
        });
      }

      if (isDebitCredit) {
        const dcCol = dcColMap.get(col.id);
        return {
          ...dcCol,
          label,
          hidden: col.visible === false,
          width: estimateExcelWidth(label, getColumnSampleValues(col)),
        };
      }

      return {
        id: col.id,
        label,
        hidden: col.visible === false,
        width: estimateExcelWidth(label, getColumnSampleValues(col)),
        accessor: isTwoLine
          ? (record) => getTwoLineExportValue(record as unknown as JournalTableRow, twoLineCol)
          : (record) => getSingleLineExportValue(record as unknown as JournalSingleLineTableRow, singleLineCol),
      };
    });

    await executeExport(exportData, {
      sheetName: "القيود اليومية",
      filename: "القيود اليومية",
      data: sortedData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary: Object.keys(summary).length > 0 ? summary : undefined,
      summaryLabel: "المجموع",
      currencyRatesSheet: ratesSheet,
      mergeCells: isTwoLine ? buildJournalMergeRanges(
        sortedData as JournalTableRow[],
        exportColumns.filter(c => !c.hidden).map((col) => col.id),
      ) : [],
    });
  }, [getColumnSampleValues, getTwoLineExportValue, getSingleLineExportValue, sortedData, enrichedColumns, isTwoLine, exportData, baseCode, rateMap, ratesSheet, sortedCurrencies, hasSecondaryCurrencies, currencyMode]);

  // ============ RENDER BODY ============
  // Shared group-grid renderer used by BOTH the operational list and the
  // separated audit archive so the two sections stay visually and
  // behaviorally consistent.
  const renderGroupGrid = (
    group: (JournalTableRow | JournalSingleLineTableRow)[],
    groupIdx: number,
    keyPrefix: string,
  ) => {
    const first = group[0];
    const rowCount = group.length;

    return (
      <div
        key={`${keyPrefix}-${first.group_key}-${groupIdx}`}
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
            const twoLineCol = col as UnifiedColumn<JournalTableRow>;
            const singleLineCol = col as UnifiedColumn<JournalSingleLineTableRow>;
            const cellValue = isTwoLine
              ? (typeof twoLineCol.accessor === "function"
                  ? twoLineCol.accessor(first as JournalTableRow, 0)
                  : ((first as JournalTableRow)[twoLineCol.accessor as keyof JournalTableRow] as ReactNode))
              : (typeof singleLineCol.accessor === "function"
                  ? singleLineCol.accessor(first as JournalSingleLineTableRow, 0)
                  : ((first as JournalSingleLineTableRow)[singleLineCol.accessor as keyof JournalSingleLineTableRow] as ReactNode));

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
                {cellValue}
              </GroupedEntrySharedCell>
            );
          }

          return group.map((row, rowIdx) => {
            const twoLineCol = col as UnifiedColumn<JournalTableRow>;
            const singleLineCol = col as UnifiedColumn<JournalSingleLineTableRow>;
            const val = isTwoLine
              ? (typeof twoLineCol.accessor === "function"
                  ? twoLineCol.accessor(row as JournalTableRow, rowIdx)
                  : ((row as JournalTableRow)[twoLineCol.accessor as keyof JournalTableRow] as ReactNode))
              : (typeof singleLineCol.accessor === "function"
                  ? singleLineCol.accessor(row as JournalSingleLineTableRow, rowIdx)
                  : ((row as JournalSingleLineTableRow)[singleLineCol.accessor as keyof JournalSingleLineTableRow] as ReactNode));

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
  };

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

    return groupedData.map((group, groupIdx) => renderGroupGrid(group, groupIdx, "group"));
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
      actions={(
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={handleExport}
        >
          <Download className="w-3.5 h-3.5 ml-1.5 text-slate-500" />
          تصدير إكسل
        </Button>
      )}
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
          sortField={sortField === "created_at" ? "entry_date" : sortField}
          sortDirection={sortDirection}
        />

        {renderBody()}

        {auditGroupedData.length > 0 && (
          <div dir="rtl">
            <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-y-2 border-amber-300" style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
              <span className="text-sm font-black text-amber-800">أرشيف التدقيق — القيود المعكوسة والملغاة</span>
              <span className="text-xs font-bold text-amber-700">{(auditEntries || []).length} قيد</span>
            </div>
            {auditGroupedData.map((group, groupIdx) => renderGroupGrid(group, groupIdx, "audit"))}
          </div>
        )}
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