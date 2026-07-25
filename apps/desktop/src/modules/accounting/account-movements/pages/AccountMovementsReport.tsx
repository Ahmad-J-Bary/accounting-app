import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { formatCurrency } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { ArrowUpRight, ArrowDownLeft, BookOpen, Landmark, FileText } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useChartOfAccounts, useAccountLedger } from "@shared/hooks/queries/useAccountQueries";
import { AccountMovementTable } from "../components/AccountMovementTable";
import { DatePicker } from "@shared/ui/date-picker";
import { ReportMeta, DateRangePicker } from "@widgets/reports";
import type { AccountDto } from "@erp/shared-types";

function getDescendantIds(accountId: string, accounts: AccountDto[]): string[] {
  const children = accounts.filter(a => a.parent_id === accountId);
  return [accountId, ...children.flatMap(c => getDescendantIds(c.id, accounts))];
}

export default function AccountMovementsReport() {
  const { baseCurrency } = useCurrencyContext();
  const [searchParams] = useSearchParams();
  const { data: accounts = [] } = useChartOfAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('accountId') || '');
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
  });

  const accountIds = useMemo(() => {
    if (!selectedAccountId) return undefined;
    return getDescendantIds(selectedAccountId, accounts);
  }, [selectedAccountId, accounts]);

  const { data: ledger, isLoading: loading } = useAccountLedger(accountIds);

  const filteredLines = useMemo(() => {
    if (!ledger) return [];
    const q = search.trim().toLowerCase();
    return ledger.lines
      .filter(l => {
        const d = new Date(l.date).toISOString().split('T')[0];
        return d >= filters.from_date && d <= filters.to_date;
      })
      .filter(l => {
        if (!q) return true;
        return (l.description || "").toLowerCase().includes(q)
            || (l.entry_number || "").toLowerCase().includes(q)
            || (l.opposite_account_name || "").toLowerCase().includes(q);
      });
  }, [ledger, filters, search]);

  const openingBalance = useMemo(
    () => parseFloat(ledger?.opening_balance_base || "0"),
    [ledger],
  );

  const { totals, periodClosingBalance } = useMemo(() => {
    const tots = filteredLines.reduce(
      (acc, l) => {
        acc.debit += parseFloat(l.debit_base || "0");
        acc.credit += parseFloat(l.credit_base || "0");
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    return {
      totals: tots,
      periodClosingBalance: openingBalance + tots.debit - tots.credit,
    };
  }, [filteredLines, openingBalance]);

  const symbol = baseCurrency?.symbol || baseCurrency?.code || "";

  return (
    <OperationalTableTemplate
      title="حركة الحساب"
      badge={
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-lg border-slate-200 bg-white text-xs font-bold">
            <SelectValue placeholder="اختر الحساب..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id} className="font-bold">
                {a.code} - {a.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      toolbar={
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            from={filters.from_date}
            to={filters.to_date}
            onChange={({ from_date, to_date }) => setFilters(f => ({ ...f, from_date, to_date }))}
          />
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full">
          <ReportMeta title="دفتر الأستاذ / كشف حركات الحساب" description="عرض تفصيلي لجميع الحركات المالية والقيود المؤثرة على حساب معين خلال فترة" />

          {ledger && (
            <div className="grid grid-cols-5 gap-3 px-4 pt-4 pb-2">
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">الافتتاحي</span>
                  <div className="text-sm font-black text-indigo-900 tabular-nums">{formatCurrency(openingBalance, symbol)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">المدين</span>
                  <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit, symbol)}</div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الدائن</span>
                  <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit, symbol)}</div>
                </div>
              </div>

              <div className={cn(
                "p-3 rounded-xl border flex items-center gap-3",
                (totals.debit - totals.credit) >= 0
                  ? "bg-amber-50 border-amber-100"
                  : "bg-red-50 border-red-100"
              )}>
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-white",
                  (totals.debit - totals.credit) >= 0 ? "bg-amber-600" : "bg-red-600"
                )}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">صافي</span>
                  <div className={cn(
                    "text-sm font-black tabular-nums",
                    (totals.debit - totals.credit) >= 0 ? "text-amber-700" : "text-red-700"
                  )}>
                    {formatCurrency(totals.debit - totals.credit, symbol)}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الختامي</span>
                  <div className="text-sm font-black text-white tabular-nums">{formatCurrency(periodClosingBalance, symbol)}</div>
                </div>
              </div>
            </div>
          )}

          <AccountMovementTable
            lines={filteredLines}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            accountName={ledger?.account_name || ""}
            openingBalance={openingBalance}
          />
        </div>
      }
    />
  );
}
