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
import { formatCurrency } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import { FileText, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Printer, Download } from "lucide-react";
import { JOURNAL_REPORT_TYPES } from "@modules/accounting/lib/journal-config";
import { toJournalRow, aggregateTotals } from "@modules/accounting/lib/journal-view";
import { JournalTable } from "@modules/accounting/components/JournalTable";

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

  const tableData = useMemo(
    () => entries.map(e => toJournalRow(e, filters.journal_type)),
    [entries, filters.journal_type]
  );

  const totals = useMemo(() => aggregateTotals(tableData), [tableData]);

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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي المدين (ل.س)</span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.debitSYP)}</div>
              </div>
           </div>
           
           <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-5">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">إجمالي الدائن (ل.س)</span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(totals.creditSYP)}</div>
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
          <div className="flex-1 p-0 flex flex-col relative min-h-0">
             <JournalTable entries={entries} loading={loading} filters={filters} />
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
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">صافي الحركة (ل.س)</span>
                   <span className={cn(
                     "text-xl font-black tabular-nums",
                     (totals.debitSYP - totals.creditSYP) >= 0 ? "text-blue-700" : "text-red-700"
                   )}>
                     {formatCurrency(Math.abs(totals.debitSYP - totals.creditSYP))}
                   </span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}
