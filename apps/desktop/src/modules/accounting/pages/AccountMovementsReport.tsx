import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Label } from "@shared/ui/label";
import { accountingService } from "@modules/accounting/api/accountingService";
import type { AccountDto, AccountLedgerDto } from "@erp/shared-types";
import { formatCurrency, formatDateTime } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { FileText, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Printer, Download, BookOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function AccountMovementsReport() {
  const { baseCurrency } = useCurrencyContext();
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('accountId') || '');
  const [filters, setFilters] = useState({
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
  });
  
  const [ledger, setLedger] = useState<AccountLedgerDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountingService.getChartOfAccounts().then(setAccounts);
  }, []);

  const fetchLedger = useCallback(async () => {
    if (!selectedAccountId) {
      toast.error("الرجاء اختيار الحساب أولاً");
      return;
    }
    setLoading(true);
    try {
      const data = await accountingService.getAccountLedger(selectedAccountId);
      // Backend doesn't support date filtering in get_account_ledger yet in this snippet, 
      // but we can filter the lines in the frontend for now if needed, 
      // or assume the backend will be updated.
      setLedger(data);
    } catch (e) {
      toast.error("فشل تحميل كشف الحساب");
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedger();
    }
  }, [selectedAccountId, fetchLedger]);

  const filteredLines = useMemo(() => {
    if (!ledger) return [];
    return ledger.lines.filter(l => {
      const d = new Date(l.date).toISOString().split('T')[0];
      return d >= filters.from_date && d <= filters.to_date;
    });
  }, [ledger, filters]);

  const totals = useMemo(() => {
    return filteredLines.reduce((acc, curr) => {
      acc.debit += parseFloat(curr.debit_base);
      acc.credit += parseFloat(curr.credit_base);
      return acc;
    }, { debit: 0, credit: 0 });
  }, [filteredLines]);

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
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="date" 
                value={filters.from_date} 
                onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
                className="h-11 pr-10 rounded-xl border-slate-200 bg-slate-50/50 font-bold tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">إلى تاريخ</Label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="date" 
                value={filters.to_date} 
                onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
                className="h-11 pr-10 rounded-xl border-slate-200 bg-slate-50/50 font-bold tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button 
              className="h-11 w-full bg-slate-900 text-white rounded-xl font-black gap-2"
              onClick={fetchLedger}
            >
              <Filter className="w-4 h-4" />تحديث البيانات
            </Button>
          </div>
        </>
      }
    >
      <div className="p-8 space-y-8 flex-1 flex flex-col">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <ArrowUpRight className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي المدين</span>
                <div className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit, baseCurrency?.symbol || baseCurrency?.code)}</div>
              </div>
           </div>
           
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الدائن</span>
                <div className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit, baseCurrency?.symbol || baseCurrency?.code)}</div>
              </div>
           </div>

           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">الرصيد النهائي</span>
                <div className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(parseFloat(ledger?.closing_balance_base || "0"), baseCurrency?.symbol || baseCurrency?.code)}</div>
              </div>
           </div>

           <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center gap-5">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">عدد الحركات</span>
                <div className="text-xl font-black text-white tabular-nums">{filteredLines.length}</div>
              </div>
           </div>
        </div>

        {/* Main Table */}
        <div className="flex-1 border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col bg-white">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10">
                <tr className="border-b border-slate-100">
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">التاريخ</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">المستند / القيد</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">البيان / التفاصيل</th>
                  <th className="text-left px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest w-32">مدين (عليه)</th>
                  <th className="text-left px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest w-32">دائن (له)</th>
                  <th className="text-left px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest w-32">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4"><div className="h-10 bg-slate-50 rounded-xl w-full" /></td>
                    </tr>
                  ))
                ) : filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                       <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                             <Search className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-slate-400 font-bold">لا يوجد حركات مسجلة لهذا الحساب</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((l, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-5 font-bold text-slate-600 tabular-nums text-xs">{formatDateTime(l.date)}</td>
                      <td className="px-6 py-5 font-black text-slate-900 text-xs">{l.entry_number}</td>
                      <td className="px-6 py-5">
                         <span className="font-bold text-slate-700 text-xs">{l.description}</span>
                      </td>
                      <td className="px-6 py-5 text-left tabular-nums font-bold text-blue-700">
                        {parseFloat(l.debit_base) > 0 ? formatCurrency(parseFloat(l.debit_base), baseCurrency?.symbol || baseCurrency?.code) : "-"}
                      </td>
                      <td className="px-6 py-5 text-left tabular-nums font-bold text-emerald-700">
                        {parseFloat(l.credit_base) > 0 ? formatCurrency(parseFloat(l.credit_base), baseCurrency?.symbol || baseCurrency?.code) : "-"}
                      </td>
                      <td className="px-6 py-5 text-left tabular-nums font-black text-slate-900 bg-slate-50/30">
                        {formatCurrency(parseFloat(l.balance_base), baseCurrency?.symbol || baseCurrency?.code)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
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
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">صافي الحركة للفترة</span>
                   <span className={cn(
                     "text-xl font-black tabular-nums",
                     (totals.debit - totals.credit) >= 0 ? "text-blue-700" : "text-red-700"
                   )}>
                     {formatCurrency(totals.debit - totals.credit, baseCurrency?.symbol || baseCurrency?.code)}
                   </span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
