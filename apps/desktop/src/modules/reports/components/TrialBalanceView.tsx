import { useMemo, useState } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { Minus, Plus } from "lucide-react";
import { ReportMeta } from "@widgets/reports";
import { computeTreeTotals, flattenTreeRows, isBalanceDebit } from "../lib/trialBalance";
import type { TrialBalanceTreeRow } from "../lib/trialBalance";
import { createSummarySpacer } from "../lib/table-meta";
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

export function TrialBalanceView({ data, loading }: TrialBalanceViewProps) {
  const { baseCurrency, currencies, formatAmount, convertFromBase } = useCurrencyContext();
  const [detailLevel, setDetailLevel] = useState(3);

  const accounts = data.accounts;
  const ledgerTotals = data.ledgerTotals;

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
      debitSec: convertFromBase(r.periodDebit, secondaryCurrency.code),
      creditSec: convertFromBase(r.periodCredit, secondaryCurrency.code),
      openingDebitSec: convertFromBase(r.openingDebit, secondaryCurrency.code),
      openingCreditSec: convertFromBase(r.openingCredit, secondaryCurrency.code),
      periodDebitSec: convertFromBase(r.periodDebit, secondaryCurrency.code),
      periodCreditSec: convertFromBase(r.periodCredit, secondaryCurrency.code),
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
        id: "opening_base",
        header: `الرصيد الافتتاحي (${baseSym})`,
        label: `الرصيد الافتتاحي (${baseSym})`,
        accessor: (row) => {
          const netOpening = row.openingDebit - row.openingCredit;
          if (netOpening === 0) return <span className="text-slate-300">—</span>;
          const status = netOpening > 0 ? "مدين" : "دائن";
          return (
            <span className={cn(
              "tabular-nums font-bold text-xs",
              status === "مدين" ? "text-amber-700" : "text-purple-700"
            )}>
              {formatCell(Math.abs(netOpening))} ({status})
            </span>
          );
        },
        className: "justify-end tabular-nums font-bold",
      },
      {
        id: "debit_base",
        header: `حركة مدين (${baseSym})`,
        label: `حركة مدين (${baseSym})`,
        accessor: (row) => (
          <span className="tabular-nums font-black text-blue-700">
            {row.periodDebit > 0 ? formatCell(row.periodDebit) : "—"}
          </span>
        ),
        className: "justify-end tabular-nums font-black text-blue-700",
      },
      {
        id: "credit_base",
        header: `حركة دائن (${baseSym})`,
        label: `حركة دائن (${baseSym})`,
        accessor: (row) => (
          <span className="tabular-nums font-black text-emerald-700">
            {row.periodCredit > 0 ? formatCell(row.periodCredit) : "—"}
          </span>
        ),
        className: "justify-end tabular-nums font-black text-emerald-700",
      },
      {
        id: "balance_base",
        header: `الرصيد النهائي (${baseSym})`,
        label: `الرصيد النهائي (${baseSym})`,
        accessor: (row) => {
          const val = row.balance;
          return (
            <span className={cn(
              "tabular-nums font-black text-xs",
              val > 0 ? "text-red-700" : val < 0 ? "text-emerald-700" : "text-slate-400",
            )}>
              {formatCell(Math.abs(val))}
            </span>
          );
        },
        className: "justify-end tabular-nums font-black",
      },
      {
        id: "status",
        header: "حالة الرصيد",
        label: "حالة الرصيد",
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
    ];

    if (secondaryCurrency) {
      cols.push({
        id: "balance_sec",
        header: `الرصيد النهائي (${secSym})`,
        label: `الرصيد النهائي (${secSym})`,
        accessor: (row) => {
          const val = row.balance;
          if (val === 0) return <span className="text-slate-300">—</span>;
          return (
            <span className="tabular-nums font-extrabold text-slate-500 text-xs">
              {formatCell(Math.abs(row.balanceSec), secondaryCurrency.code)}
            </span>
          );
        },
        className: "justify-end tabular-nums font-extrabold text-slate-500",
      });
    }

    return cols;
  }, [baseSym, secSym, secondaryCurrency, formatCell]);

  const baseIds = useMemo(() => {
    return ["name", "opening_base", "debit_base", "credit_base", "balance_base", "status"];
  }, []);

  const { enrichedColumns, toolbarColumns, toggleColumn, resetToDefault, isModified } = useUnifiedColumns({
    tableId: "trial-balance",
    columns: allColumns,
    defaultVisible: baseIds,
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
      if (col.id === "name") {
        return {
          id: "count", columnId: "name", label: "", value: `${totals.count} حساب`,
          className: "text-slate-500 font-medium",
        };
      }
      if (col.id === "opening_base") {
        const sign = totals.openingNet > 0 ? "مدين" : totals.openingNet < 0 ? "دائن" : "متزن";
        return {
          id: "opening_summary", columnId: "opening_base",
          label: "إجمالي الأرصدة الافتتاحية",
          value: totals.openingNet !== 0 ? `${formatCell(Math.abs(totals.openingNet))} (${sign})` : "—",
          className: "text-amber-700 font-bold",
        };
      }
      if (col.id === "debit_base") {
        return {
          id: "debit_summary", columnId: "debit_base", label: `إجمالي حركات مدين (${baseSym})`,
          value: totals.periodDebit > 0 ? formatCell(totals.periodDebit) : "—",
          className: "text-blue-700 font-black",
        };
      }
      if (col.id === "credit_base") {
        return {
          id: "credit_summary", columnId: "credit_base", label: `إجمالي حركات دائن (${baseSym})`,
          value: totals.periodCredit > 0 ? formatCell(totals.periodCredit) : "—",
          className: "text-emerald-700 font-black",
        };
      }
      if (col.id === "balance_base") {
        const valClass = totals.balance > 0
          ? "text-red-700 font-black"
          : totals.balance < 0
          ? "text-emerald-700 font-black"
          : "text-slate-500 font-bold";
        return {
          id: "bal_summary", columnId: "balance_base",
          label: `إجمالي الرصيد النهائي`,
          value: totals.balance !== 0 ? formatCell(Math.abs(totals.balance)) : "—",
          className: valClass,
        };
      }
      if (col.id === "status") {
        return { id: "status_spacer", columnId: "status", label: "", value: totals.balanceStatus || "—" };
      }
      return createSummarySpacer(col.id);
    });
  }, [enrichedColumns, totals, baseSym, formatCell]);


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
