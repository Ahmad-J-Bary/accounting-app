import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Label } from "@shared/ui/label";
import { formatCurrency, formatDate } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { Filter, ArrowUpRight, ArrowDownLeft, Printer, Download, BookOpen, Landmark, FileText } from "lucide-react";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useChartOfAccounts, useAccountLedger } from "@shared/hooks/queries/useAccountQueries";
import { AccountMovementTable } from "../components/AccountMovementTable";
import { DatePicker } from "@shared/ui/date-picker";
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

  const { data: ledger, isLoading: loading, refetch } = useAccountLedger(accountIds);

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

  const handleUpdate = () => {
    if (!selectedAccountId) {
      toast.error("الرجاء اختيار الحساب أولاً");
      return;
    }
    refetch();
  };

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
    <ReportLayout
      title="دفتر الأستاذ / كشف حركات الحساب"
      subtitle="عرض تفصيلي لجميع الحركات المالية والقيود المؤثرة على حساب معين خلال فترة."
      filters={
        <>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">الحساب</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 font-bold">
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
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">من تاريخ</Label>
            <DatePicker
              value={filters.from_date}
              onChange={v => setFilters(f => ({ ...f, from_date: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">إلى تاريخ</Label>
            <DatePicker
              value={filters.to_date}
              onChange={v => setFilters(f => ({ ...f, to_date: v }))}
            />
          </div>

          <div className="flex items-end">
            <Button
              className="h-11 w-full bg-slate-900 text-white rounded-xl font-black gap-2"
              onClick={handleUpdate}
            >
              <Filter className="w-4 h-4" />تحديث البيانات
            </Button>
          </div>
        </>
      }
    >
      <div className="p-8 space-y-8 flex-1 flex flex-col">
        {/* Date Range Banner */}
        {filters.from_date && filters.to_date && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-blue-50 text-blue-700 px-4 py-1.5 border border-blue-100 font-bold">
              الفترة من {formatDate(filters.from_date)} إلى {formatDate(filters.to_date)}
            </span>
          </div>
        )}

        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
           <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">الرصيد الافتتاحي</span>
                <div className="text-lg font-black text-indigo-900 tabular-nums">{formatCurrency(openingBalance, symbol)}</div>
              </div>
           </div>

           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي المدين</span>
                <div className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit, symbol)}</div>
              </div>
           </div>

           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الدائن</span>
                <div className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit, symbol)}</div>
              </div>
           </div>

           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg",
                (totals.debit - totals.credit) >= 0
                  ? "bg-amber-600 shadow-amber-100"
                  : "bg-red-600 shadow-red-100"
              )}>
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">صافي الحركة</span>
                <div className={cn(
                  "text-lg font-black tabular-nums",
                  (totals.debit - totals.credit) >= 0 ? "text-amber-700" : "text-red-700"
                )}>
                  {formatCurrency(totals.debit - totals.credit, symbol)}
                </div>
              </div>
           </div>

           <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">الرصيد الختامي</span>
                <div className="text-lg font-black text-white tabular-nums">{formatCurrency(periodClosingBalance, symbol)}</div>
              </div>
           </div>
        </div>

        {/* Main Table */}
        <div className="flex-1 border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col bg-white">
          <AccountMovementTable
            lines={filteredLines}
            loading={loading}
            search={search}
            onSearchChange={setSearch}
            accountName={ledger?.account_name || ""}
            openingBalance={openingBalance}
          />

          <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
             <div className="flex gap-4">
                <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold bg-white border-slate-200">
                  <Printer className="w-4 h-4" />طباعة الكشف
                </Button>
                <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold bg-white border-slate-200">
                  <Download className="w-4 h-4" />تصدير Excel
                </Button>
             </div>

             <div className="flex items-center gap-8">
                <div className="text-right">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">الرصيد الختامي للفترة</span>
                   <span className={cn(
                     "text-xl font-black tabular-nums",
                     periodClosingBalance >= 0 ? "text-slate-900" : "text-red-700"
                   )}>
                     {formatCurrency(periodClosingBalance, symbol)}
                   </span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
