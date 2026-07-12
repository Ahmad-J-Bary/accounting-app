import { useMemo, useRef, useCallback, type ReactNode } from "react";
import { GridHeader, type GridHeaderColumn } from "@widgets/table-shell/GridHeader";
import type { UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableSummary, type SummaryColumn } from "@widgets/table-shell/TableSummary";
import { TableShell } from "@widgets/table-shell/TableShell";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useUnifiedColumns, useSortable, useBaseCurrencyColumns, useTableSettings, useGridResize } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { getLeftBorderClass, getRowBorderClass, getRowBackgroundClass } from "@shared/lib/table-utils";
import type { GridResizeContent } from "@shared/hooks/useGridResize";
import type { AccountLedgerLineDto } from "@erp/shared-types";
import { formatDateTime } from "@shared/lib/format";
import { GroupedEntrySharedCell } from "./GroupedEntrySharedCell";

type SortField = "entry_number" | "date" | "journal_type" | "account";

interface AccountMovementTableProps {
  lines: AccountLedgerLineDto[];
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  accountName: string;
}

type EnrichedLine = AccountLedgerLineDto & {
  typeLabel: string;
  account_name: string;
  side: "debit" | "credit";
  amount_base: number;
  amount_original: number;
  group_key: string;
};

type LedgerTableRow = EnrichedLine & { isFirstInGroup: boolean };

type EnrichedOriginalLine = AccountLedgerLineDto & {
  typeLabel: string;
};

const SHARED_COLUMN_IDS = new Set(["entry_number", "journal_type", "description", "date"]);

function getHeaderText<T>(col: UnifiedColumn<T>): string {
  if (typeof col.header === "string") return col.header;
  if (typeof col.label === "string") return col.label;
  return col.id;
}

function getPrimitiveCellValue(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

export function AccountMovementTable({
  lines,
  loading,
  search,
  onSearchChange,
  accountName
}: AccountMovementTableProps) {
  const { currencies, baseCurrency, formatAmount } = useCurrencyContext();
  const { isBaseCurrency } = useBaseCurrencyColumns();
  const { settings, getDensityPadding } = useTableSettings();
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  // إثراء قائمة الحركات الأصلية لاستخدامها في الفرز وتخصيص التسميات
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

  // فرز الحركات الأصلية أولاً لضمان عدم انفصال أسطر الحركة الواحدة بعد التقسيم
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
        case "account":
          comparison = (a.opposite_account_name || "").localeCompare(b.opposite_account_name || "", "ar");
          break;
      }
      return direction === "asc" ? comparison : -comparison;
    }
  });

  // تقسيم كل حركة أصلية مفروزة إلى سطرين: مدين ودائن
  const tableData = useMemo(() => {
    const rows: EnrichedLine[] = [];
    sortedOriginalLines.forEach((line, idx) => {
      const debitBase = parseFloat(line.debit_base || "0");
      const creditBase = parseFloat(line.credit_base || "0");
      const isDebit = debitBase > 0 || parseFloat(line.debit_original || "0") > 0;

      const amtBase = debitBase > 0 ? debitBase : creditBase;
      const amtOrig = parseFloat(line.debit_original || "0") > 0
        ? parseFloat(line.debit_original || "0")
        : parseFloat(line.credit_original || "0");

      const groupKey = `${line.journal_id || idx}-${line.entry_number}-${idx}`;

      // سطر المدين (Debit)
      rows.push({
        ...line,
        account_name: isDebit ? accountName : line.opposite_account_name,
        side: "debit",
        amount_base: amtBase,
        amount_original: amtOrig,
        group_key: groupKey,
      });

      // سطر الدائن (Credit)
      rows.push({
        ...line,
        account_name: isDebit ? line.opposite_account_name : accountName,
        side: "credit",
        amount_base: amtBase,
        amount_original: amtOrig,
        group_key: groupKey,
      });
    });

    return rows.map((row, idx) => ({
      ...row,
      isFirstInGroup: idx % 2 === 0,
    })) as LedgerTableRow[];
  }, [sortedOriginalLines, accountName]);

  const allColumns = useMemo<UnifiedColumn<LedgerTableRow>[]>(() => {
    const cols: UnifiedColumn<LedgerTableRow>[] = [
      {
        id: "entry_number",
        header: "رقم القيد",
        label: "رقم القيد",
        accessor: (r) => r.isFirstInGroup ? r.entry_number : "",
        className: "font-black text-slate-900 text-center"
      },
      {
        id: "journal_type",
        header: "نوع الحركة",
        label: "نوع الحركة",
        accessor: (r) => r.isFirstInGroup ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
            {r.typeLabel}
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
        header: `له / دائن (${symbol})`,
        label: `له / دائن (${symbol})`,
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
        accessor: (r) => r.isFirstInGroup ? r.description : "",
        className: "text-slate-700 font-bold"
      },
      {
        id: "account",
        header: "الحساب",
        label: "الحساب",
        accessor: (r) => (
          <span className={r.side === "debit" ? "text-blue-600 font-bold" : "text-emerald-600 font-bold"}>
            {r.account_name}
          </span>
        ),
      },
      {
        id: "date",
        header: "التاريخ",
        label: "التاريخ",
        accessor: (r) => r.isFirstInGroup ? formatDateTime(r.date) : "",
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
    def.push("description", "account", "date");
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
    (col: UnifiedColumn<LedgerTableRow>): string[] =>
      tableData
        .slice(0, 30)
        .map((row, idx) =>
          typeof col.accessor === "function"
            ? getPrimitiveCellValue(col.accessor(row, idx))
            : getPrimitiveCellValue(row[col.accessor as keyof LedgerTableRow] as ReactNode),
        )
        .filter(Boolean),
    [tableData],
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
    "account-movement-grid",
    containerRef,
    contentByColumn,
    settings.fontSize,
  );

  const groupedData = useMemo(() => {
    const groups: LedgerTableRow[][] = [];
    for (let i = 0; i < tableData.length; i += 2) {
      groups.push([tableData[i], tableData[i + 1]]);
    }
    return groups;
  }, [tableData]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    // حساب الإجماليات من البيانات الأصلية لمنع تضاعف المبالغ بسبب التقسيم
    const baseDebitTotal = lines.reduce(
      (s, l) => s + parseFloat(l.debit_base || "0"),
      0,
    );
    const baseCreditTotal = lines.reduce(
      (s, l) => s + parseFloat(l.credit_base || "0"),
      0,
    );
    const baseBalance = baseDebitTotal - baseCreditTotal;
    const baseSymbol = baseCurrency?.symbol || baseCurrency?.code || "";

    return enrichedColumns.map((col) => {
      const id = col.id;
      if (id === "entry_number") {
        return { id: "count", columnId: "entry_number", label: "", value: `${lines.length} حركة`, className: "text-slate-500 font-medium" };
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
      if (id === "date") {
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
  }, [lines, formatAmount, enrichedColumns, isBaseCurrency, baseCurrency, sortedCurrencies]);

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
    if (["entry_number", "journal_type", "account", "date"].includes(colId)) {
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
      return <EmptyState message={search ? "لا توجد حركات تطابق معايير البحث" : "لا توجد حركات مسجلة لهذا الحساب"} />;
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
                : (first[col.accessor as keyof LedgerTableRow] as ReactNode);

              return (
                <GroupedEntrySharedCell
                  key={col.id}
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
                : (row[col.accessor as keyof LedgerTableRow] as ReactNode);

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
      title={`حركة الحساب: ${accountName}`}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="بحث برقم القيد أو البيان..."
      columns={toolbarColumns}
      onColumnToggle={toggleColumn}
      onColumnsReset={resetToDefault}
      columnsModified={isModified}
      showToolbar={true}
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
