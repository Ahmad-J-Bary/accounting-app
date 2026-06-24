import { useState, useMemo, useEffect } from "react";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { UnifiedTable, type UnifiedColumn } from "@widgets/table-shell/UnifiedTable";
import { TableShell } from "@widgets/table-shell/TableShell";
import type { SummaryColumn } from "@widgets/table-shell/TableSummary";
import { useUnifiedColumns } from "@shared/hooks";
import { cn } from "@shared/lib/utils";
import { Scale, BookOpen, ArrowUpRight, ArrowDownLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { flattenTree, isBalanceDebit } from "../lib/trialBalance";

interface TrialBalanceFlatRow {
  id: string;
  code: string;
  name: string;
  depth: number;
  balance: number;
  debit: number;
  credit: number;
  balanceSec: number;
  debitSec: number;
  creditSec: number;
}

export default function TrialBalanceReport() {
  const { baseCurrency, currencies, formatAmount, convertFromBase } = useCurrencyContext();
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);

  const secondaryCurrency = useMemo(() => {
    if (!baseCurrency) return null;
    return currencies.find(c => c.code !== baseCurrency.code) ?? null;
  }, [currencies, baseCurrency]);

  useEffect(() => {
    setLoading(true);
    accountingService.getChartOfAccounts()
      .then(setAccounts)
      .catch(() => toast.error("فشل تحميل بيانات ميزان المراجعة"))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo<TrialBalanceFlatRow[]>(() => {
    return flattenTree(accounts).map(({ account, depth }) => {
      const debit = parseFloat(account.debit || "0");
      const credit = parseFloat(account.credit || "0");
      const balance = debit - credit;
      return {
        id: account.id,
        code: account.code,
        name: account.name_ar,
        depth,
        balance,
        debit,
        credit,
        balanceSec: secondaryCurrency ? convertFromBase(balance, secondaryCurrency.code) : 0,
        debitSec: secondaryCurrency ? convertFromBase(debit, secondaryCurrency.code) : 0,
        creditSec: secondaryCurrency ? convertFromBase(credit, secondaryCurrency.code) : 0,
      };
    });
  }, [accounts, secondaryCurrency, convertFromBase]);

  const baseSym = baseCurrency?.symbol || baseCurrency?.code || "";
  const secSym = secondaryCurrency?.symbol || secondaryCurrency?.code || "";

  const formatCell = useMemo(() => (value: number, code?: string) => {
    if (value === 0) return "—";
    return formatAmount(value, { currencyCode: code });
  }, [formatAmount]);

  const allColumns = useMemo<UnifiedColumn<TrialBalanceFlatRow>[]>(() => {
    const cols: UnifiedColumn<TrialBalanceFlatRow>[] = [
      {
        id: "name",
        header: "اسم الحساب",
        label: "اسم الحساب",
        accessor: (row) => (
          <span className="truncate font-bold text-slate-700 text-xs">
            {row.name}
          </span>
        ),
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

        {/* Table */}
        <div className="flex-1 min-h-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <TableShell
            searchPlaceholder="بحث في الحسابات..."
            columns={toolbarColumns}
            onColumnToggle={toggleColumn}
            onColumnsReset={resetToDefault}
            columnsModified={isModified}
            actions={
              <Button
                size="sm"
                className="h-9 bg-slate-900 text-white rounded-xl font-black gap-2"
                onClick={() => {
                  setLoading(true);
                  accountingService.getChartOfAccounts()
                    .then(setAccounts)
                    .catch(() => toast.error("فشل تحديث البيانات"))
                    .finally(() => setLoading(false));
                }}
              >
                <Search className="w-4 h-4" /> تحديث
              </Button>
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
    </ReportLayout>
  );
}
