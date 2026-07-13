import { useMemo, useState } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { Minus, Plus } from "lucide-react";
import { computeTreeTotals, flattenTreeRows, isBalanceDebit } from "../lib/trialBalance";
import type { TrialBalanceTreeRow } from "../lib/trialBalance";
import { useTrialBalance } from "@shared/hooks/queries/useReportQueries";

const DETAIL_LEVELS = [
  { level: 1, maxDepth: 0, label: "مستوى 1", desc: "التصنيفات الرئيسية" },
  { level: 2, maxDepth: 1, label: "مستوى 2", desc: "+ التصنيفات الفرعية" },
  { level: 3, maxDepth: 2, label: "مستوى 3", desc: "+ الحسابات المفصلة" },
  { level: 4, maxDepth: Infinity, label: "مستوى 4", desc: "+ كافة التفاصيل" },
];

export default function TrialBalanceReport() {
  const { baseCurrency, currencies, formatAmount, convertFromBase } = useCurrencyContext();
  const [detailLevel, setDetailLevel] = useState(3);

  const { data, isLoading } = useTrialBalance();

  const accounts = useMemo(() => data?.accounts ?? [], [data?.accounts]);
  const ledgerTotals = useMemo(() => data?.ledgerTotals ?? new Map(), [data?.ledgerTotals]);

  const secondaryCurrency = useMemo(() => {
    if (!baseCurrency) return null;
    return currencies.find(c => c.code !== baseCurrency.code) ?? null;
  }, [currencies, baseCurrency]);

  const treeTotals = useMemo(() => computeTreeTotals(accounts, ledgerTotals), [accounts, ledgerTotals]);

  const maxDepth = DETAIL_LEVELS[detailLevel - 1].maxDepth;

  const rows = useMemo<TrialBalanceTreeRow[]>(() => {
    const baseRows = flattenTreeRows(treeTotals, maxDepth);
    if (!secondaryCurrency) return baseRows;
    return baseRows.map((r) => ({
      ...r,
      balanceSec: convertFromBase(r.balance, secondaryCurrency.code),
      debitSec: convertFromBase(r.debit, secondaryCurrency.code),
      creditSec: convertFromBase(r.credit, secondaryCurrency.code),
    }));
  }, [treeTotals, maxDepth, secondaryCurrency, convertFromBase]);

  const baseSym = baseCurrency?.symbol || baseCurrency?.code || "";
  const secSym = secondaryCurrency?.symbol || secondaryCurrency?.code || "";

  const formatCell = useMemo(() => (value: number, code?: string) => {
    if (value === 0) return "—";
    return formatAmount(value, { currencyCode: code });
  }, [formatAmount]);

  const allColumns = useMemo<UnifiedColumn<TrialBalanceTreeRow>[]>(() => {
    const cols: UnifiedColumn<TrialBalanceTreeRow>[] = [
      {
        id: "name",
        header: "اسم الحساب",
        label: "اسم الحساب",
        accessor: (row) => {
          const padClass = row.depth === 0 ? "" : row.depth === 1 ? "pr-6" : row.depth === 2 ? "pr-12" : "pr-16";
          const fontClass = row.depth === 0
            ? "font-extrabold text-sm text-slate-900"
            : row.depth === 1
            ? "font-bold text-xs text-slate-800"
            : row.depth === 2
            ? "font-semibold text-xs text-slate-700"
            : "font-normal text-xs text-slate-600";
          return (
            <span className={cn("truncate block", padClass, fontClass)}>
              {row.name}
            </span>
          );
        },
        className: "justify-start",
      },
      {
        id: "status",
        header: "حالة الحساب",
        label: "حالة الحساب",
        accessor: (row) => {
          const status = isBalanceDebit(row.balance);
          if (!status) return <span className="text-slate-300">—</span>;
          return (
            <span className={cn(
              "font-bold text-xs",
              status === "مدين" ? "text-red-600" : "text-emerald-600",
            )}>
              {status}
            </span>
          );
        },
        className: "justify-center",
      },
      {
        id: "balance_base",
        header: `الرصيد (${baseSym})`,
        label: `الرصيد (${baseSym})`,
        accessor: (row) => {
          const val = row.balance;
          return (
            <span className={cn(
              "tabular-nums font-black",
              val > 0 ? "text-red-700" : val < 0 ? "text-emerald-700" : "text-slate-400",
            )}>
              {formatCell(val)}
            </span>
          );
        },
        className: "justify-end tabular-nums font-black",
      },
    ];

    if (secondaryCurrency) {
      cols.push({
        id: "balance_sec",
        header: `الرصيد (${secSym})`,
        label: `الرصيد (${secSym})`,
        accessor: (row) => {
          const val = row.balance;
          if (val === 0) return <span className="text-slate-300">—</span>;
          return (
            <span className="tabular-nums font-extrabold text-slate-500">
              {formatCell(row.balanceSec, secondaryCurrency.code)}
            </span>
          );
        },
        className: "justify-end tabular-nums font-extrabold text-slate-500",
      });
    }

    cols.push({
      id: "debit_base",
      header: `مدين (${baseSym})`,
      label: `مدين (${baseSym})`,
      accessor: (row) => (
        <span className="tabular-nums font-black text-blue-700">
          {row.debit > 0 ? formatCell(row.debit) : "—"}
        </span>
      ),
      className: "justify-end tabular-nums font-black text-blue-700",
    });

    if (secondaryCurrency) {
      cols.push({
        id: "debit_sec",
        header: `مدين (${secSym})`,
        label: `مدين (${secSym})`,
        accessor: (row) => (
          <span className="tabular-nums font-medium text-blue-300">
            {row.debit > 0 ? formatCell(row.debitSec, secondaryCurrency.code) : "—"}
          </span>
        ),
        className: "justify-end tabular-nums font-medium text-blue-300",
      });
    }

    cols.push({
      id: "credit_base",
      header: `دائن (${baseSym})`,
      label: `دائن (${baseSym})`,
      accessor: (row) => (
        <span className="tabular-nums font-black text-emerald-700">
          {row.credit > 0 ? formatCell(row.credit) : "—"}
        </span>
      ),
      className: "justify-end tabular-nums font-black text-emerald-700",
    });

    if (secondaryCurrency) {
      cols.push({
        id: "credit_sec",
        header: `دائن (${secSym})`,
        label: `دائن (${secSym})`,
        accessor: (row) => (
          <span className="tabular-nums font-medium text-emerald-300">
            {row.credit > 0 ? formatCell(row.creditSec, secondaryCurrency.code) : "—"}
          </span>
        ),
        className: "justify-end tabular-nums font-medium text-emerald-300",
      });
    }

    return cols;
  }, [baseSym, secSym, secondaryCurrency, formatCell]);

  const baseIds = useMemo(() => {
    const ids = ["name", "status", "balance_base", "debit_base", "credit_base"];
    return ids;
  }, []);

  const allColIds = useMemo(() => allColumns.map(c => c.id), [allColumns]);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "trial-balance",
    columns: allColumns,
    defaultVisible: secondaryCurrency ? baseIds : allColIds,
  });

  const totals = useMemo(() => {
    let totalBalance = 0, totalDebit = 0, totalCredit = 0;
    let totalBalanceSec = 0, totalDebitSec = 0, totalCreditSec = 0;

    for (const row of rows) {
      totalBalance += row.balance;
      totalDebit += row.debit;
      totalCredit += row.credit;
      totalBalanceSec += row.balanceSec;
      totalDebitSec += row.debitSec;
      totalCreditSec += row.creditSec;
    }

    const balanceStatus = isBalanceDebit(totalBalance);
    return {
      balance: totalBalance, debit: totalDebit, credit: totalCredit,
      balanceSec: totalBalanceSec, debitSec: totalDebitSec, creditSec: totalCreditSec,
      balanceStatus, count: rows.length,
    };
  }, [rows]);

  const summaryColumns = useMemo<SummaryColumn[]>(() => {
    return enrichedColumns.map((col) => {
      if (col.id === "name") {
        return {
          id: "count", columnId: "name", label: "", value: `${totals.count} حساب`,
          className: "text-slate-500 font-medium",
        };
      }
      if (col.id === "status") {
        return { id: "status_spacer", columnId: "status", label: "", value: "" };
      }
      if (col.id === "balance_base") {
        const sign = totals.balanceStatus || "متزن";
        const valClass = totals.balance > 0
          ? "text-red-700 font-black"
          : totals.balance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return {
          id: "bal_summary", columnId: "balance_base",
          label: `الرصيد / ${sign}`,
          value: totals.balance !== 0 ? formatCell(Math.abs(totals.balance)) : "—",
          className: valClass,
        };
      }
      if (col.id === "balance_sec") {
        return {
          id: "bal_sec_summary", columnId: "balance_sec", label: "", className: "text-slate-500 font-extrabold",
          value: totals.balanceSec !== 0 ? formatCell(Math.abs(totals.balanceSec), secondaryCurrency?.code) : "—",
        };
      }
      if (col.id === "debit_base") {
        return {
          id: "debit_summary", columnId: "debit_base", label: `إجمالي مدين (${baseSym})`,
          value: totals.debit > 0 ? formatCell(totals.debit) : "—",
          className: "text-blue-700 font-black",
        };
      }
      if (col.id === "debit_sec") {
        return {
          id: "debit_sec_summary", columnId: "debit_sec", label: "", className: "text-blue-300 font-extrabold",
          value: totals.debitSec > 0 ? formatCell(totals.debitSec, secondaryCurrency?.code) : "—",
        };
      }
      if (col.id === "credit_base") {
        return {
          id: "credit_summary", columnId: "credit_base", label: `إجمالي دائن (${baseSym})`,
          value: totals.credit > 0 ? formatCell(totals.credit) : "—",
          className: "text-emerald-700 font-black",
        };
      }
      if (col.id === "credit_sec") {
        return {
          id: "credit_sec_summary", columnId: "credit_sec", label: "", className: "text-emerald-300 font-extrabold",
          value: totals.creditSec > 0 ? formatCell(totals.creditSec, secondaryCurrency?.code) : "—",
        };
      }
      return { id: `${col.id}_spacer`, columnId: col.id, label: "", value: "" };
    });
  }, [enrichedColumns, totals, baseSym, secondaryCurrency, formatCell]);

  return (
    <ReportLayout title="ميزان المراجعة">
      <div className="flex flex-col flex-1 p-8 gap-8">
        {/* Description Banner */}
        <div className="shrink-0 rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-sm text-slate-600">
          <span className="text-lg font-black text-slate-900">ميزان المراجعة</span>
          <span className="mx-2 text-slate-300">|</span>
          <span>بيان يوضح إجمالي الحركة المدينة والحركة الدائنة لكل الحسابات المتضمنة في دليل الحسابات (الشجرة)</span>
        </div>

        {/* Detail Level Control */}
        <div className="shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              disabled={detailLevel === 1}
              onClick={() => setDetailLevel((p) => Math.max(1, p - 1))}
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5" dir="ltr">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  className={cn(
                    "h-2 rounded-full transition-all duration-200 cursor-pointer",
                    level <= detailLevel
                      ? "bg-slate-900"
                      : "bg-slate-200 hover:bg-slate-300",
                    level === detailLevel ? "w-8" : "w-2",
                  )}
                  onClick={() => setDetailLevel(level)}
                  title={DETAIL_LEVELS.find((d) => d.level === level)?.desc}
                />
              ))}
            </div>

            <button
              className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              disabled={detailLevel === 4}
              onClick={() => setDetailLevel((p) => Math.min(4, p + 1))}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-400 tracking-wider">
            {detailLevel === 1 ? "مختصر" : detailLevel === 4 ? "مفصل" : "مستوى " + detailLevel}
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <TableShell
            searchPlaceholder="بحث في الحسابات..."
            columns={toolbarColumns}
            onColumnToggle={toggleColumn}
            onColumnsReset={resetToDefault}
            columnsModified={isModified}
          >
            <UnifiedTable
              data={rows}
              columns={enrichedColumns}
              loading={isLoading}
              tableId="trial-balance"
              emptyMessage="لا توجد حسابات مسجلة"
              summary={summaryColumns}
              enableResize
            />
          </TableShell>
        </div>
      </div>
    </ReportLayout>
  );
}
