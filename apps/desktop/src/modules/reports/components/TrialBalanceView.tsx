import { useMemo, useState } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns, useBaseCurrencyColumns } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { Minus, Plus } from "lucide-react";
import { ReportMeta } from "@widgets/reports";
import { computeTreeTotals, flattenTreeRows, isBalanceDebit } from "../lib/trialBalance";
import type { TrialBalanceTreeRow } from "../lib/trialBalance";
import type { LoadedTrialBalanceData } from "../hooks/useTrialBalanceReport";

type TrialBalanceViewProps = {
  data: LoadedTrialBalanceData;
  loading: boolean;
};

const DETAIL_LEVELS = [
  { level: 1, maxDepth: 0, label: "مستوى 1", desc: "التصنيفات الرئيسية" },
  { level: 2, maxDepth: 1, label: "مستوى 2", desc: "+ التصنيفات الفرعية" },
  { level: 3, maxDepth: 2, label: "مستوى 3", desc: "+ الحسابات المفصلة" },
  { level: 4, maxDepth: Infinity, label: "مستوى 4", desc: "+ كافة التفاصيل" },
];

const cellWrap = "w-full leading-snug";

export function TrialBalanceView({ data, loading }: TrialBalanceViewProps) {
  const { currencies, formatAmount } = useCurrencyContext();
  const { isBaseCurrency, currencySuffix: cs } = useBaseCurrencyColumns();
  const [detailLevel, setDetailLevel] = useState(3);

  const accounts = data.accounts;
  const ledgerTotals = data.ledgerTotals;

  const treeTotals = useMemo(() => computeTreeTotals(accounts, ledgerTotals), [accounts, ledgerTotals]);

  const maxDepth = DETAIL_LEVELS[detailLevel - 1].maxDepth;

  const rows = useMemo<TrialBalanceTreeRow[]>(() => {
    return flattenTreeRows(treeTotals, maxDepth);
  }, [treeTotals, maxDepth]);

  const rootClass = (c: string) => `tabular-nums font-black ${c}`;
  const secClass = "tabular-nums font-medium text-slate-400";

  const allColumns = useMemo<UnifiedColumn<TrialBalanceTreeRow>[]>(() => {
    const cols: UnifiedColumn<TrialBalanceTreeRow>[] = [
      {
        id: "name",
        header: "اسم الحساب",
        label: "اسم الحساب",
        accessor: (row) => {
          const padClass = row.depth === 0 ? "" : row.depth === 1 ? "ps-6" : row.depth === 2 ? "ps-12" : "ps-16";
          const fontClass = row.depth === 0
            ? "font-extrabold text-sm text-slate-900"
            : row.depth === 1
            ? "font-bold text-xs text-slate-800"
            : row.depth === 2
            ? "font-semibold text-xs text-slate-700"
            : "font-normal text-xs text-slate-600";
          return (
            <div className={cn("w-full leading-snug break-words", padClass, fontClass)}>
              {row.name}
            </div>
          );
        },
        className: "justify-start",
      },
    ];

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `opening_${curr.code}`,
        header: `الرصيد الافتتاحي ${cs(symbol)}`,
        label: `الرصيد الافتتاحي ${cs(symbol)}`,
        accessor: (row) => {
          const netOpening = row.openingDebit - row.openingCredit;
          if (netOpening === 0) return <div className={cellWrap}><span className="text-slate-300">—</span></div>;
          const status = netOpening > 0 ? "مدين" : "دائن";
          return (
            <div className={cellWrap}>
              <span className={cn(
                isBase ? rootClass("text-amber-700") : secClass,
                "text-xs",
                status === "مدين" ? "" : ""
              )}>
                {formatAmount(Math.abs(netOpening), { currencyCode: curr.code })} ({status})
              </span>
            </div>
          );
        },
        className: "justify-end",
      });
    });

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `debit_${curr.code}`,
        header: `مدين ${cs(symbol)}`,
        label: `مدين ${cs(symbol)}`,
        accessor: (row) => (
          <div className={cellWrap}>
            {row.periodDebit > 0 ? (
              <span className={cn(isBase ? rootClass("text-blue-700") : secClass, "text-xs")}>
                {formatAmount(row.periodDebit, { currencyCode: curr.code })}
              </span>
            ) : (
              <span className="text-slate-300 text-xs">—</span>
            )}
          </div>
        ),
        className: isBase ? rootClass("text-blue-700") : secClass,
      });
    });

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `credit_${curr.code}`,
        header: `دائن ${cs(symbol)}`,
        label: `دائن ${cs(symbol)}`,
        accessor: (row) => (
          <div className={cellWrap}>
            {row.periodCredit > 0 ? (
              <span className={cn(isBase ? rootClass("text-emerald-700") : secClass, "text-xs")}>
                {formatAmount(row.periodCredit, { currencyCode: curr.code })}
              </span>
            ) : (
              <span className="text-slate-300 text-xs">—</span>
            )}
          </div>
        ),
        className: isBase ? rootClass("text-emerald-700") : secClass,
      });
    });

    currencies.forEach(curr => {
      const symbol = curr.symbol || curr.code;
      const isBase = isBaseCurrency(curr.code);
      cols.push({
        id: `balance_${curr.code}`,
        header: `الرصيد النهائي ${cs(symbol)}`,
        label: `الرصيد النهائي ${cs(symbol)}`,
        accessor: (row) => {
          const val = row.balance;
          return (
            <div className={cellWrap}>
              <span className={cn(
                isBase
                  ? rootClass(val > 0 ? "text-red-700" : val < 0 ? "text-emerald-700" : "text-slate-400")
                  : secClass,
                "text-xs"
              )}>
                {formatAmount(Math.abs(val), { currencyCode: curr.code })}
              </span>
            </div>
          );
        },
        className: isBase ? "justify-end tabular-nums font-black" : secClass,
      });
    });

    cols.push({
      id: "status",
      header: "حالة الحساب",
      label: "حالة الحساب",
      accessor: (row) => {
        const status = isBalanceDebit(row.balance);
        if (!status) return <div className={cellWrap}><span className="text-slate-300">—</span></div>;
        return (
          <div className={cellWrap}>
            <span className={cn(
              "font-bold text-xs",
              status === "مدين" ? "text-red-600" : "text-emerald-600",
            )}>
              {status}
            </span>
          </div>
        );
      },
      className: "justify-center",
    });

    return cols;
  }, [currencies, formatAmount, isBaseCurrency, cs]);

  const defaultVisible = useMemo(() => {
    const baseCode = currencies.find(c => isBaseCurrency(c.code))?.code;
    if (!baseCode) return ["name", "status"];
    return ["name", `opening_${baseCode}`, `debit_${baseCode}`, `credit_${baseCode}`, `balance_${baseCode}`, "status"];
  }, [currencies, isBaseCurrency]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "trial-balance",
    columns: allColumns,
    defaultVisible,
  });

  const totals = useMemo(() => {
    let totalOpeningNet = 0, totalPeriodDebit = 0, totalPeriodCredit = 0;
    let totalBalance = 0;

    for (const row of rows) {
      totalOpeningNet += (row.openingDebit - row.openingCredit);
      totalPeriodDebit += row.periodDebit;
      totalPeriodCredit += row.periodCredit;
      totalBalance += row.balance;
    }

    const balanceStatus = isBalanceDebit(totalBalance);
    return {
      openingNet: totalOpeningNet,
      periodDebit: totalPeriodDebit,
      periodCredit: totalPeriodCredit,
      balance: totalBalance,
      balanceStatus,
      count: rows.length,
    };
  }, [rows]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map((col) => {
      const id = col.id;

      if (id === "name") {
        return {
          id: "count", columnId: "name", label: "", value: `${totals.count} حساب`,
          className: "text-slate-500 font-medium",
        };
      }

      if (id === "status") {
        return { id: "status_spacer", columnId: "status", label: "", value: totals.balanceStatus || "—" };
      }

      const openingMatch = id.match(/^opening_(.+)$/);
      if (openingMatch) {
        const currCode = openingMatch[1];
        const sign = totals.openingNet > 0 ? "مدين" : totals.openingNet < 0 ? "دائن" : "متزن";
        return {
          id: `${id}_summary`, columnId: id,
          label: "إجمالي الأرصدة الافتتاحية",
          value: totals.openingNet !== 0
            ? `${formatAmount(Math.abs(totals.openingNet), { currencyCode: currCode })} (${sign})`
            : "—",
          className: "text-amber-700 font-bold",
        };
      }

      const debitMatch = id.match(/^debit_(.+)$/);
      if (debitMatch) {
        const currCode = debitMatch[1];
        return {
          id: `${id}_summary`, columnId: id,
          label: `إجمالي حركات مدين`,
          value: totals.periodDebit > 0 ? formatAmount(totals.periodDebit, { currencyCode: currCode }) : "—",
          className: "text-blue-700 font-black",
        };
      }

      const creditMatch = id.match(/^credit_(.+)$/);
      if (creditMatch) {
        const currCode = creditMatch[1];
        return {
          id: `${id}_summary`, columnId: id,
          label: `إجمالي حركات دائن`,
          value: totals.periodCredit > 0 ? formatAmount(totals.periodCredit, { currencyCode: currCode }) : "—",
          className: "text-emerald-700 font-black",
        };
      }

      const balanceMatch = id.match(/^balance_(.+)$/);
      if (balanceMatch) {
        const currCode = balanceMatch[1];
        const isBase = isBaseCurrency(currCode);
        const valClass = totals.balance > 0
          ? "text-red-700 font-black"
          : totals.balance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return {
          id: `${id}_summary`, columnId: id,
          label: `إجمالي الرصيد النهائي`,
          value: totals.balance !== 0 ? formatAmount(Math.abs(totals.balance), { currencyCode: currCode }) : "—",
          className: isBase ? valClass : "text-slate-500 font-extrabold",
        };
      }

      return { id: `${id}_spacer`, columnId: id, label: "", value: "" };
    });
  }, [enrichedColumns, totals, formatAmount, isBaseCurrency]);


  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="ميزان المراجعة" description="بيان يوضح إجمالي الحركة المدينة والحركة الدائنة لكل الحسابات المتضمنة في دليل الحسابات (الشجرة)" />

      <div className="flex-1 min-h-0 overflow-hidden pb-4">
        <TableShell
          searchPlaceholder="بحث في الحسابات..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
          onColumnsReset={resetToDefault}
          columnsModified={isModified}
          filterBar={
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  disabled={detailLevel === 1}
                  onClick={() => setDetailLevel((p) => Math.max(1, p - 1))}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1" dir="ltr">
                  {[1, 2, 3, 4].map((level) => (
                    <button
                      key={level}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-200 cursor-pointer",
                        level <= detailLevel
                          ? "bg-slate-900"
                          : "bg-slate-200 hover:bg-slate-300",
                        level === detailLevel ? "w-6" : "w-1.5",
                      )}
                      onClick={() => setDetailLevel(level)}
                      title={DETAIL_LEVELS.find((d) => d.level === level)?.desc}
                    />
                  ))}
                </div>

                <button
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  disabled={detailLevel === 4}
                  onClick={() => setDetailLevel((p) => Math.min(4, p + 1))}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="flex-1 text-center text-[11px] font-bold text-slate-400 tracking-wider">
                {detailLevel === 1 ? "مختصر" : detailLevel === 4 ? "مفصل" : "مستوى " + detailLevel}
              </span>
            </div>
          }
        >
          <UnifiedTable
            data={rows}
            columns={enrichedColumns}
            loading={loading}
            tableId="trial-balance"
            emptyMessage="لا توجد حسابات مسجلة"
            summary={summaryColumns}
            enableResize
          />
        </TableShell>
      </div>
    </div>
  );
}
