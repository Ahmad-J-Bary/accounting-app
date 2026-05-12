import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ReportLayout } from "@widgets/templates/ReportLayout";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Label } from "@shared/ui/label";
import { useDataTable } from "@shared/hooks";
import { journalEntryService, type JournalFilters } from "@modules/accounting/api/journalEntryService";
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { formatCurrency, formatDate, formatDateTime } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { FileText, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Printer, Download } from "lucide-react";
import { JOURNAL_REPORT_TYPES } from "@modules/accounting/lib/journal-config";

export default function AccountingJournalsReport() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<JournalFilters>({
    journal_type: (searchParams.get('type') as JournalType) || 'GeneralJournal',
    from_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const type = searchParams.get('type') as JournalType;
    if (type && type !== filters.journal_type) {
      setFilters(f => ({ ...f, journal_type: type }));
    }
  }, [searchParams, filters.journal_type]);

  const {
    filtered: entries,
    loading,
    refresh,
  } = useDataTable<JournalEntryDto>({
    fetchData: () => journalEntryService.listJournalEntries(filters),
    searchFields: ['entry_number', 'description'],
    dependencies: [filters],
  });

  const selectedJournal = useMemo(() => 
    JOURNAL_REPORT_TYPES.find(t => t.value === filters.journal_type) || JOURNAL_REPORT_TYPES[0]
  , [filters.journal_type]);

  const totals = useMemo(() => {
    return entries.reduce((acc, curr) => {
      acc.debit += parseFloat(curr.total_base_debit);
      acc.credit += parseFloat(curr.total_base_credit);
      return acc;
    }, { debit: 0, credit: 0 });
  }, [entries]);

  return (
    <ReportLayout
      title={selectedJournal.label}
      subtitle={selectedJournal.desc}
      filters={
        <>
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-slate-400">نوع اليومية</Label>
            <Select 
              value={filters.journal_type} 
              onValueChange={v => setFilters(f => ({ ...f, journal_type: v as JournalType }))}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOURNAL_REPORT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
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
                value={filters.from_date || ""} 
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
                value={filters.to_date || ""} 
                onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
                className="h-11 pr-10 rounded-xl border-slate-200 bg-slate-50/50 font-bold tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button 
              className="h-11 w-full bg-slate-900 text-white rounded-xl font-black gap-2"
              onClick={() => refresh(true)}
            >
              <Filter className="w-4 h-4" />تحديث البيانات
            </Button>
          </div>
        </>
      }
    >
      <div className="p-8 space-y-8 flex-1 flex flex-col">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <ArrowUpRight className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي المدين</span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit)}</div>
              </div>
           </div>
           
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الدائن</span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit)}</div>
              </div>
           </div>

           <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center gap-5">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">عدد القيود</span>
                <div className="text-2xl font-black text-white tabular-nums">{entries.length}</div>
              </div>
           </div>
        </div>

        {/* Main Table */}
        <div className="flex-1 border border-slate-100 rounded-3xl overflow-hidden shadow-sm flex flex-col bg-white">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10">
                <tr className="border-b border-slate-100">
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">رقم القيد</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">نوع الحركة</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">الجهة / المورد</th>
                  <th className="text-left px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest w-32">عليه / مدين</th>
                  <th className="text-left px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest w-32">له / دائن</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">البيان</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">الحساب الدائن / المصدر</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">الحساب المدين / الوجهة</th>
                  <th className="text-right px-6 py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-6 py-4"><div className="h-10 bg-slate-50 rounded-xl w-full" /></td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                       <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                             <FileText className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-slate-400 font-bold">لا يوجد بيانات لهذه الفترة</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  entries.flatMap(e => e.lines.map((l, lIdx) => {
                    const isDebit = parseFloat(l.debit) > 0;
                    const isCredit = parseFloat(l.credit) > 0;
                    
                    // Find counter-party account for context
                    const counterLines = e.lines.filter(cl => isDebit ? parseFloat(cl.credit) > 0 : parseFloat(cl.debit) > 0);
                    const counterAccount = counterLines.length === 1 
                      ? counterLines[0].account_name 
                      : counterLines.length > 1 ? "حسابات متعددة" : "-";

                    return (
                      <tr key={`${e.id}-${lIdx}`} className="hover:bg-slate-50/50 transition-colors group cursor-pointer border-r-4 border-r-transparent hover:border-r-blue-500">
                        <td className="px-6 py-4 font-black text-slate-900 text-[11px]">
                          {lIdx === 0 ? e.entry_number : ""}
                        </td>
                        <td className="px-6 py-4">
                           {lIdx === 0 && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 uppercase tracking-tighter">
                               {e.journal_type_display}
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-left tabular-nums font-black text-blue-700 text-xs">
                          {isDebit ? formatCurrency(parseFloat(l.debit)) : ""}
                        </td>
                        <td className="px-6 py-4 text-left tabular-nums font-black text-emerald-700 text-xs">
                          {isCredit ? formatCurrency(parseFloat(l.credit)) : ""}
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col gap-0.5 max-w-xs">
                              <span className="font-bold text-slate-700 text-xs truncate" title={l.description || e.description}>
                                {l.description || e.description}
                              </span>
                              {lIdx === 0 && e.source_id && (
                                <span className="text-[9px] text-slate-400 font-mono">مصدر: ...{e.source_id.slice(-8)}</span>
                              )}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn("font-bold text-xs", isCredit ? "text-emerald-600" : "text-slate-400")}>
                             {isCredit ? l.account_name : counterAccount}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn("font-bold text-xs", isDebit ? "text-blue-600" : "text-slate-400")}>
                             {isDebit ? l.account_name : counterAccount}
                           </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-500 tabular-nums text-[11px] whitespace-nowrap">
                          {lIdx === 0 ? formatDateTime(e.entry_date) : ""}
                        </td>
                      </tr>
                    );
                  }))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
             <div className="flex gap-4">
                <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold bg-white border-slate-200">
                  <Printer className="w-4 h-4" />طباعة التقرير
                </Button>
                <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 font-bold bg-white border-slate-200">
                  <Download className="w-4 h-4" />تصدير Excel
                </Button>
             </div>
             
             <div className="flex items-center gap-8">
                <div className="text-right">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">صافي الحركة</span>
                   <span className={cn(
                     "text-xl font-black tabular-nums",
                     (totals.debit - totals.credit) >= 0 ? "text-blue-700" : "text-red-700"
                   )}>
                     {formatCurrency(totals.debit - totals.credit)}
                   </span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
