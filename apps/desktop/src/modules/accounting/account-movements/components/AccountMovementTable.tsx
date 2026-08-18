import { useMemo, useRef, useCallback, type ReactNode } from "react";
import { GridHeader, type GridHeaderColumn } from "@widgets/table-shell/GridHeader";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { useExportSetup, useUnifiedColumns, useSortable, useBaseCurrencyColumns, useTableSettings, useGridResize, type GridResizeContent } from "@shared/hooks";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { dateCol, executeExport, estimateExcelWidth, debitCreditAmountCols } from "@shared/lib/excel";
import { cn } from "@shared/lib/utils";
import { getLeftBorderClass, getRowBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import { getHeaderText, getPrimitiveCellValue } from "@modules/accounting/journal/components/groupedTableUtils";
import { computeClosingBalance, computeRunningBalance, isOpeningLine, markEntryRunFirsts } from "@modules/accounting/account-movements/lib/openingLines";
import { Download } from "lucide-react";
import { Button } from "@shared/ui/button";

type SortField = "entry_number" | "date" | "journal_type";

interface OpeningEntryInfo {
  entry_number: string;
  description: string;
  date: string;
  debit_base: string;
  credit_base: string;
}

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  accountName: string;
  openingBalance?: number;
  openingBalanceDate?: string;
  openingEntry?: OpeningEntryInfo | null;
  openingDebitTotal?: number;
  openingCreditTotal?: number;
  openingEntries?: OpeningEntryInfo[];
}

type MovementRow = AccountLedgerLineDto & {
  typeLabel: string;
  side: "debit" | "credit";
  amount_base: number;
  isOpening: boolean;
  /** First row of an adjacent run sharing the same journal — entry-number /
   * type / date are rendered once across the run. */
  isFirstInEntry: boolean;
  /** Running balance (الرصيد الجاري) seeded by the beginning balance. */
  balance: number;
  /** Synthetic Beginning Balance row (رصيد سابق / أول الفترة). */
  isBeginning?: boolean;
};

type EnrichedOriginalLine = AccountLedgerLineDto & {
  typeLabel: string;
};

export function AccountMovementTable({
  lines,
  loading,
  search,
  onSearchChange,
  accountName,
  openingBalance,
  openingBalanceDate,
}: AccountMovementTableProps) {
  const { isBaseCurrency, currencySuffix, hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { settings, getDensityPadding } = useTableSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const { exportData, baseCurrency, rateMap, sortedCurrencies, formatAmount, baseCode, ratesSheet, currencyMode } = useExportSetup();

  const enrichedLines = useMemo(() => {
    return lines.map((line) => {
      let typeLabel = line.journal_type;

      if (typeLabel === "GeneralJournal" || typeLabel === "اليومية العامة") {
        const desc = line.description || "";
        const isDepreciation = desc.includes("إهلاك سنوي") || desc.includes("إهلاك");
        const isOpening = desc.includes("إضافة أصل سابق") || desc.includes("أول المدة");
        const isPurchase = desc.includes("شراء أصل ثابت") || desc.includes("اثبات شراء");

        if (isDepreciation || isOpening || isPurchase) {
          let assetType = "أصول ثابتة";
          const opposite = line.opposite_account_name || "";

          if (
            opposite.includes("أبنية") ||
            opposite.includes("أراضي") ||
            opposite.includes("المباني") ||
            opposite.includes("الأراضي") ||
            accountName.includes("أبنية") ||
            accountName.includes("أراضي") ||
            accountName.includes("المباني") ||
            accountName.includes("الأراضي")
          ) {
            assetType = "أبنية وأراضي";
          } else if (
            opposite.includes("معدات") ||
            opposite.includes("تجهيزات") ||
            opposite.includes("الآلات") ||
            opposite.includes("المعدات") ||
            accountName.includes("معدات") ||
            accountName.includes("تجهيزات") ||
            accountName.includes("الآلات") ||
            accountName.includes("المعدات")
          ) {
            assetType = "معدات وتجهيزات";
          } else if (
            opposite.includes("أثاث") ||
            opposite.includes("مفروشات") ||
            opposite.includes("المفروشات") ||
            accountName.includes("أثاث") ||
            accountName.includes("مفروشات") ||
            accountName.includes("المفروشات")
          ) {
            assetType = "أثاث ومفروشات";
          }

          if (isDepreciation) {
            typeLabel = "إهلاك سنوي";
          } else if (isOpening) {
            typeLabel = `رصيد افتتاحي للأصول الثابتة / ${assetType}`;
          } else if (isPurchase) {
            typeLabel = `شراء أصل ثابت / ${assetType}`;
          }
        } else {
          typeLabel = "اليومية العامة";
        }
      } else {
        if (typeLabel === "GeneralJournal") typeLabel = "اليومية العامة";
        if (
          typeLabel === "AccountOpeningBalance" ||
          typeLabel === "CashOpeningBalance" ||
          typeLabel === "رصيد افتتاحي لحساب" ||
          typeLabel === "رصيد افتتاحي للخزينة"
        ) {
          typeLabel = "رصيد افتتاحي";
        }
      }

      return {
        ...line,
        typeLabel,
      } satisfies EnrichedOriginalLine;
    });
  }, [lines, accountName]);

  const mergedLines = enrichedLines;

  const { sortedData: sortedOriginalLines, sortField, sortDirection, handleSort } = useSortable({
    data: mergedLines,
    defaultField: "entry_number" as SortField,
    defaultDirection: "asc",
    sortFn: (a, b, field, direction) => {
      let comparison = 0;
      switch (field) {
        case "entry_number":
          comparison = (a.entry_number || "").localeCompare(b.entry_number || "", "ar", { numeric: true });
          break;
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "journal_type":
          comparison = (a.typeLabel || "").localeCompare(b.typeLabel || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  const cleanLines = sortedOriginalLines;

  const tableData = useMemo(() => {
    const runningBalances = computeRunningBalance(cleanLines, openingBalance || 0);
    const rows: MovementRow[] = [];

    cleanLines.forEach((line, idx) => {
      const debitBase = parseFloat(line.debit_base || "0");
      const creditBase = parseFloat(line.credit_base || "0");

      rows.push({
        ...line,
        typeLabel: line.typeLabel,
        side: debitBase > 0 ? "debit" : "credit",
        amount_base: debitBase > 0 ? debitBase : creditBase,
        isOpening: isOpeningLine(line),
        isFirstInEntry: false,
        balance: runningBalances[idx],
      });
    });

    const firsts = markEntryRunFirsts(cleanLines);
    rows.forEach((row, idx) => {
      row.isFirstInEntry = firsts[idx];
    });

    if (openingBalance !== 0 && openingBalance !== undefined) {
      const sign = openingBalance > 0 ? "debit" : "credit";
      rows.unshift({
        date: openingBalanceDate || "",
        journal_id: "",
        entry_number: "",
        journal_type: "",
        source_id: null,
        description: "رصيد سابق / أول الفترة",
        opposite_account_name: "",
        currency: "",
        fx_rate: "",
        debit_base: sign === "debit" ? String(Math.abs(openingBalance)) : "0",
        credit_base: sign === "credit" ? String(Math.abs(openingBalance)) : "0",
        balance_base: String(openingBalance),
        debit_original: "",
        credit_original: "",
        balance_original: "",
        typeLabel: "رصيد سابق",
        side: sign,
        amount_base: Math.abs(openingBalance),
        isOpening: false,
        isFirstInEntry: true,
        balance: openingBalance,
        isBeginning: true,
      });
    }

    return rows;
  }, [cleanLines, openingBalance, openingBalanceDate]);

  const allColumns = useMemo<UnifiedColumn<MovementRow>[]>(() => {
    const cols: UnifiedColumn<MovementRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (r) => (r.isFirstInEntry && !r.isBeginning ? formatNumber(parseInt(r.entry_number) || 0) : ""),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (r) => (
          r.isFirstInEntry ? (
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
              r.isBeginning
                ? "bg-amber-100/70 text-amber-700"
                : r.isOpening
                ? "bg-indigo-100/60 text-indigo-700"
                : "bg-slate-100 text-slate-600"
            )}>
              {r.typeLabel}
            </span>
          ) : (
            <span />
          )
        ),
      },
    ];

    sortedCurrencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: `عليه / مدين${currencySuffix(symbol)}`,
        label: `عليه / مدين${currencySuffix(symbol)}`,
        align: "center",
        accessor: (r) => {
          if (r.side !== "debit") return "";
          return r.amount_base > 0 ? formatAmount(r.amount_base, { currencyCode: curr.code }) : "";
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
        header: `له / دائن${currencySuffix(symbol)}`,
        label: `له / دائن${currencySuffix(symbol)}`,
        align: "center",
        accessor: (r) => {
          if (r.side !== "credit") return "";
          return r.amount_base > 0 ? formatAmount(r.amount_base, { currencyCode: curr.code }) : "";
        },
        className: isBase
          ? "tabular-nums font-black text-emerald-700"
          : "tabular-nums font-medium text-emerald-300"
      });
    });

    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";
    cols.push(
      {
        id: "balance",
        header: `الرصيد${currencySuffix(baseSymbol)}`,
        label: `الرصيد${currencySuffix(baseSymbol)}`,
        align: "center",
        accessor: (r) => {
          const b = r.balance ?? 0;
          if (b === 0) return <span className="text-slate-300">—</span>;
          const formatted = formatAmount(Math.abs(b), { currencyCode: baseCurrency?.code || "" });
          return b > 0
            ? <span className="tabular-nums font-black text-blue-700">{formatted}</span>
            : <span className="tabular-nums font-black text-emerald-700">−{formatted}</span>;
        },
        className: "tabular-nums font-black",
      },
      {
        id: "description",
        header: "البيان",
        label: "البيان",
        accessor: (r) => r.description,
        className: "text-slate-700 font-bold"
      },
      {
        id: "date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (r) => formatDateTime(r.date),
        className: "text-slate-500 tabular-nums"
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount, isBaseCurrency, currencySuffix, baseCurrency]);

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
    def.push("balance", "description", "date");
    return def;
  }, [sortedCurrencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "account-movement-unified",
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
    (col: UnifiedColumn<MovementRow>): string[] =>
      tableData
        .slice(0, 30)
        .map((row, idx) =>
          typeof col.accessor === "function"
            ? getPrimitiveCellValue(col.accessor(row, idx))
            : getPrimitiveCellValue(row[col.accessor as keyof MovementRow] as ReactNode),
        )
        .filter(Boolean),
    [tableData],
  );

  const handleExport = useCallback(async () => {
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};

    const dcCols = debitCreditAmountCols(
      (row) => {
        const r = row as unknown as MovementRow;
        return {
          debit: r.side === "debit" ? r.amount_base : 0,
          credit: r.side === "credit" ? r.amount_base : 0,
        };
      },
      sortedCurrencies, hasSecondaryCurrencies, currencyMode, baseCode, rateMap,
    );
    const dcColMap = new Map(dcCols.map(c => [c.id, c]));

    const exportColumns: ExcelExportColumn[] = enrichedColumns.map((col) => {
      const label = col.label || getHeaderText(col);

      const isDebitCredit = /^debit_|^credit_/.test(col.id);

      if (isDebitCredit) {
        summary[col.id] = 'subtotal';
      }

      if (col.id === "date") {
        return dateCol("date", label, (row) => {
          const r = row as unknown as MovementRow;
          return r.isFirstInEntry ? r.date : "";
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
        accessor: (row) => {
          const r = row as unknown as MovementRow;
          if (col.id === "entry_number") return r.isFirstInEntry ? (r.isBeginning ? "" : (parseInt(r.entry_number, 10) || 0)) : "";
          if (col.id === "journal_type") return r.isFirstInEntry ? r.typeLabel : "";
          if (col.id === "balance") return r.balance ?? 0;
          if (col.id === "description") return r.description;
          return "";
        },
      };
    });

    await executeExport(exportData, {
      sheetName: "كشف حركة الحساب",
      filename: `حركة_حساب_${accountName}`,
      data: tableData as unknown as Record<string, unknown>[],
      columns: exportColumns,
      summary: Object.keys(summary).length > 0 ? summary : undefined,
      summaryLabel: "المجموع",
      currencyRatesSheet: ratesSheet,
    });
  }, [enrichedColumns, tableData, accountName, exportData, getColumnSampleValues, baseCode, rateMap, ratesSheet, sortedCurrencies, hasSecondaryCurrencies, currencyMode]);

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
    "account-movement-grid",
    containerRef,
    contentByColumn,
    settings.fontSize,
  );

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    const totalDebit = tableData.reduce(
      (s, l) => s + parseFloat(l.debit_base || "0"),
      0,
    );
    const totalCredit = tableData.reduce(
      (s, l) => s + parseFloat(l.credit_base || "0"),
      0,
    );
    const { net: closingNet, sign: closingSign } = computeClosingBalance(totalDebit, totalCredit);
    const hasBeginning = tableData.some(l => l.isBeginning);
    const rowCount = tableData.length - (hasBeginning ? 1 : 0);
    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${rowCount} حركة`, className: "text-slate-500 font-medium" };
      }
      if (id === "journal_type" || id === "description") {
        return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
      }

      if (id === "date") {
        const label = `الرصيد الختامي / ${closingSign}${currencySuffix(baseSymbol)}`;
        const value = formatAmount(Math.abs(closingNet), { currencyCode: baseCurrency?.code || "" });
        const valueClass = closingSign === "مدين"
          ? "text-blue-700 font-black"
          : closingSign === "دائن"
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return { id: "closing", columnId: "date", label, value, className: valueClass };
      }

      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        const isB = isBaseCurrency(currCode);
        const label = col.label || `عليه / مدين${currencySuffix(currCode)}`;
        return {
          id: `${id}_total`,
          columnId: id,
          label,
          value: totalDebit > 0 ? formatAmount(totalDebit, { currencyCode: currCode }) : "—",
          className: isB
            ? "text-blue-700 font-black"
            : "text-blue-300 font-extrabold"
        };
      }

      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        const isB = isBaseCurrency(currCode);
        const label = col.label || `له / دائن${currencySuffix(currCode)}`;
        return {
          id: `${id}_total`,
          columnId: id,
          label,
          value: totalCredit > 0 ? formatAmount(totalCredit, { currencyCode: currCode }) : "—",
          className: isB
            ? "text-emerald-700 font-black"
            : "text-emerald-300 font-extrabold"
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [tableData, formatAmount, enrichedColumns, isBaseCurrency, baseCurrency, currencySuffix]);

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
    filteredSummary?.length && settings.showSummary && tableData.length > 0
  );

  const cellBorderClass = getLeftBorderClass(settings.borderStyle);

  const handleHeaderCellClick = useCallback((colId: string) => {
    if (["entry_number", "journal_type", "date"].includes(colId)) {
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

    if (tableData.length === 0) {
      return <EmptyState message={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مسجلة لهذا الحساب"} />;
    }

    return (
      <>
        {/* Movement Rows — one row per movement */}
        {tableData.map((row, rowIdx) => (
          <div
            key={`row-${row.entry_number}-${rowIdx}`}
            dir="rtl"
            className={cn(
              "transition-all duration-75",
              getRowBorderClass(settings.borderStyle),
              row.isBeginning
                ? "bg-amber-50/60 border-b border-amber-100"
                : row.isOpening
                ? "bg-indigo-50/40 border-b border-indigo-100"
                : getRowBackgroundClass(false, rowIdx, settings.zebraRows, settings.rowHoverEffect),
            )}
            style={{
              display: "grid",
              gridTemplateColumns,
            }}
          >
            {visibleColumns.map((col, colIdx) => {
              const columnPosition = colIdx + 1;
              const val = typeof col.accessor === "function"
                ? col.accessor(row, rowIdx)
                : (row[col.accessor as keyof MovementRow] as ReactNode);

              return (
                <div
                  key={col.id}
                  style={{
                    gridColumn: String(columnPosition),
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: `${settings.fontSize}px`,
                    fontFamily: settings.fontFamily,
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
            })}
          </div>
        ))}
      </>
    );
  };

  return (
    <TableShell
      title={`حركة الحساب: ${accountName}`}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم القيد أو البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
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
