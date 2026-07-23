import { useMemo, useRef, useCallback, type ReactNode } from "react";
import { GridHeader, type GridHeaderColumn } from "@widgets/table-shell/GridHeader";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExcelExport, useUnifiedColumns, useSortable, useBaseCurrencyColumns, useTableSettings, useGridResize } from "@shared/hooks";
import { useExportSettings } from "@shared/hooks/useExportSettings";
import type { ExcelExportColumn, ExcelExportOptions } from "@shared/lib/excel";
import { buildCurrencyRatesSheetOptions } from "@shared/lib/excel";
import { cn } from "@shared/lib/utils";
import { getLeftBorderClass, getRowBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
import type { GridResizeContent } from "@shared/hooks/useGridResize";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime, formatNumber } from "@shared/lib/format";
import { getHeaderText, getPrimitiveCellValue } from "@modules/accounting/journal/components/groupedTableUtils";
import { Download } from "lucide-react";
import { Button } from "@shared/ui/button";

function estimateExcelWidth(headerText: string, sampleValues: string[]): number {
  const longestText = [headerText, ...sampleValues].reduce((max, value) => {
    return Math.max(max, String(value ?? "").trim().length);
  }, 0);

  return Math.max(12, Math.min(36, longestText + 4));
}

type SortField = "entry_number" | "date" | "journal_type";

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  accountName: string;
  openingBalance?: number;
}

type MovementRow = AccountLedgerLineDto & {
  typeLabel: string;
  side: "debit" | "credit";
  amount_base: number;
  running_balance: number;
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
  openingBalance = 0,
}: AccountMovementTableProps) {
  const { currencies, baseCurrency, rateMap, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix } = useBaseCurrencyColumns();
  const { currencyMode } = useExportSettings();
  const { exportData } = useExcelExport();
  const { settings, getDensityPadding } = useTableSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

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
      }

      return {
        ...line,
        typeLabel,
      } satisfies EnrichedOriginalLine;
    });
  }, [lines, accountName]);

  const { sortedData: sortedOriginalLines, sortField, sortDirection, handleSort } = useSortable({
    data: enrichedLines,
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

  const tableData = useMemo(() => {
    const rows: MovementRow[] = [];
    let running = openingBalance;

    for (const line of sortedOriginalLines) {
      const debitBase = parseFloat(line.debit_base || "0");
      const creditBase = parseFloat(line.credit_base || "0");

      running += debitBase - creditBase;

      rows.push({
        ...line,
        typeLabel: line.typeLabel,
        side: debitBase > 0 ? "debit" : "credit",
        amount_base: debitBase > 0 ? debitBase : creditBase,
        running_balance: running,
      });
    }

    return rows;
  }, [sortedOriginalLines, openingBalance]);

  const allColumns = useMemo<UnifiedColumn<MovementRow>[]>(() => {
    const cols: UnifiedColumn<MovementRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (r) => formatNumber(parseInt(r.entry_number) || 0),
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (r) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {r.typeLabel}
          </span>
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

    cols.push(
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
      {
        id: "balance",
        header: "الرصيد",
        label: "الرصيد",
        accessor: (r) => formatAmount(r.running_balance, { currencyCode: baseCurrency?.code || "" }),
        className: "tabular-nums font-black bg-slate-50/30"
      },
    );
    return cols;
  }, [sortedCurrencies, formatAmount, isBaseCurrency, baseCurrency, currencySuffix]);

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
    def.push("description", "date", "balance");
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

    const currencyRatesSheet = buildCurrencyRatesSheetOptions(baseCurrency, sortedCurrencies, rateMap, currencyMode).currencyRatesSheet;

    const exportColumns: ExcelExportColumn[] = enrichedColumns.map((col) => {
      const label = col.label || getHeaderText(col);

      const isDebitCredit = /^debit_|^credit_/.test(col.id);

      if (isDebitCredit && col.visible !== false) {
        summary[col.id] = 'subtotal';
      }

      return {
        id: col.id,
        label,
        hidden: col.visible === false,
        width: estimateExcelWidth(label, getColumnSampleValues(col)),
        accessor: (row) => {
          const r = row as unknown as MovementRow;
          if (col.id === "entry_number") return parseInt(r.entry_number, 10) || 0;
          if (col.id === "journal_type") return r.typeLabel;
          if (col.id === "description") return r.description;
          if (col.id === "date") return formatDateTime(r.date);
          if (col.id === "balance") return r.running_balance;

          const debitMatch = col.id.match(/^debit_(.+)$/);
          if (debitMatch) {
            return r.side === "debit" && r.amount_base > 0 ? r.amount_base : 0;
          }

          const creditMatch = col.id.match(/^credit_(.+)$/);
          if (creditMatch) {
            return r.side === "credit" && r.amount_base > 0 ? -r.amount_base : 0;
          }

          return "";
        },
        ...(isDebitCredit || col.id === "balance" ? { numeric: true, decimalPlaces: 2 } : {}),
      };
    });

    const exportOptions: ExcelExportOptions = {
      sheetName: "كشف حركة الحساب",
      autoFilter: true,
      summary: Object.keys(summary).length > 0 ? summary : undefined,
      summaryLabel: "المجموع",
      ...(currencyRatesSheet ? { currencyRatesSheet } : {}),
    };

    await exportData(
      tableData as unknown as Record<string, unknown>[],
      exportColumns,
      `حركة_حساب_${accountName}`,
      exportOptions,
    );
  }, [enrichedColumns, tableData, accountName, exportData, getColumnSampleValues, currencyMode, baseCurrency, sortedCurrencies, rateMap]);

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
    const baseDebitTotal = lines.reduce(
      (s, l) => s + parseFloat(l.debit_base || "0"),
      0,
    );
    const baseCreditTotal = lines.reduce(
      (s, l) => s + parseFloat(l.credit_base || "0"),
      0,
    );
    const closingBalance = openingBalance + baseDebitTotal - baseCreditTotal;
    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${lines.length} حركة`, className: "text-slate-500 font-medium" };
      }
      if (id === "journal_type" || id === "description" || id === "date") {
        return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
      }

      if (id === "balance") {
        const sign = closingBalance > 0 ? "مدين" : closingBalance < 0 ? "دائن" : "متزن";
        const label = `الرصيد الختامي / ${sign}${currencySuffix(baseSymbol)}`;
        const value = formatAmount(Math.abs(closingBalance), { currencyCode: baseCurrency?.code || "" });
        const valueClass = closingBalance > 0
          ? "text-blue-700 font-black"
          : closingBalance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return { id: `${id}_closing`, columnId: id, label, value, className: valueClass };
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
        const label = col.label || `له / دائن${currencySuffix(currCode)}`;
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
  }, [lines, formatAmount, enrichedColumns, isBaseCurrency, baseCurrency, openingBalance, currencySuffix]);

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
        {/* Opening Balance Row */}
        <div
          key="opening-balance"
          dir="rtl"
          className={cn(
            "transition-all duration-75 bg-indigo-50/40 border-b border-indigo-100",
            getRowBorderClass(settings.borderStyle),
          )}
          style={{
            display: "grid",
            gridTemplateColumns,
          }}
        >
          {visibleColumns.map((col, colIdx) => {
            const columnPosition = colIdx + 1;
            let content: ReactNode = "";
            if (col.id === "entry_number") content = "—";
            else if (col.id === "journal_type") content = <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-700 uppercase tracking-tighter">رصيد افتتاحي</span>;
            else if (col.id === "balance") content = formatAmount(openingBalance, { currencyCode: baseCurrency?.code || "" });

            return (
              <div
                key={`opening-${col.id}`}
                style={{
                  gridColumn: String(columnPosition),
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: col.align === "left" ? "flex-start" : col.align === "center" ? "center" : "flex-end",
                  textAlign: col.align || "right",
                  fontSize: `${settings.fontSize}px`,
                  fontFamily: settings.fontFamily,
                }}
                className={cn(
                  getDensityPadding(),
                  cellBorderClass,
                  col.id === "balance" ? "text-indigo-700 font-black" : "text-indigo-600 font-bold",
                )}
              >
                {content}
              </div>
            );
          })}
        </div>

        {/* Movement Rows — one row per movement */}
        {tableData.map((row, rowIdx) => (
          <div
            key={`row-${row.entry_number}-${rowIdx}`}
            dir="rtl"
            className={cn(
              "transition-all duration-75",
              getRowBorderClass(settings.borderStyle),
              getRowBackgroundClass(false, rowIdx, settings.zebraRows, settings.rowHoverEffect),
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
                    justifyContent: col.align === "left" ? "flex-start" : col.align === "center" ? "center" : "flex-end",
                    textAlign: col.align || "right",
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
