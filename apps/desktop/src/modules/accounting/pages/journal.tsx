import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, FileText, CheckCircle2, FileEdit, Banknote, Settings2, Calendar, Filter } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, CreateJournalEntryRequest, JournalType } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

// Refactored Components & Hooks
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/components/JournalTable';
import { JournalDetailPanel } from '@modules/accounting/components/JournalDetailPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { JournalSummaryFooter } from "@modules/accounting/components/JournalSummaryFooter";

const JOURNAL_TYPES: { value: JournalType; label: string }[] = [
  { value: 'GeneralJournal', label: 'اليومية العامة' },
  { value: 'CashJournal', label: 'يومية الصندوق' },
  { value: 'CashSalesJournal', label: 'يومية المبيعات النقدية' },
  { value: 'CreditSalesJournal', label: 'يومية المبيعات الآجلة' },
  { value: 'CashReceipt', label: 'سندات القبض' },
  { value: 'CashPayment', label: 'سندات الصرف' },
  { value: 'PurchaseJournal', label: 'يومية المشتريات' },
  { value: 'PurchaseCostsJournal', label: 'يومية تكاليف الشراء' },
  { value: 'MaterialOpeningBalance', label: 'رصيد أول المدة للمواد' },
];

export default function Journal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as JournalType | null;

  const { currencies, baseCurrency } = useCurrencyContext();
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  const [filters, setFilters] = useState<JournalFilters>({
    journal_type: typeParam || 'GeneralJournal',
    from_date: undefined,
    to_date: undefined,
  });

  useEffect(() => {
    const activeType = typeParam || 'GeneralJournal';
    if (activeType !== (filters.journal_type || 'GeneralJournal')) {
      setFilters(f => ({ ...f, journal_type: activeType }));
    }
  }, [typeParam, filters.journal_type]);

  useEffect(() => {
    const handler = () => navigate("/journal/new");
    window.addEventListener("erp:open-new-journal", handler);
    return () => window.removeEventListener("erp:open-new-journal", handler);
  }, [navigate]);

  const fetchData = useCallback(() => {
    return journalEntryService.listJournalEntries(filters);
  }, [filters]);

  const {
    filtered: entries,
    loading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<JournalEntryDto>({
    fetchData,
    searchFields: ["entry_number", "description"],
    dependencies: [filters],
  });

  const availableColumns = useMemo(() => {
    return [
      { id: "entry_date", label: "التاريخ" },
      { id: "entry_number", label: "رقم القيد" },
      { id: "journal_type", label: "نوع الحركة" },
      { id: "description", label: "البيان" },
      { id: "debit_account", label: "الحساب المدين / الوجهة" },
      { id: "credit_account", label: "الحساب الدائن / المصدر" },
      { id: "total_debit_usd", label: "عليه / مدين ($)" },
      { id: "total_debit_syp", label: "عليه / مدين (ل.س)" },
      { id: "total_credit_usd", label: "له / دائن ($)" },
      { id: "total_credit_syp", label: "له / دائن (ل.س)" },
    ];
  }, []);

  const defaultVisibleColumns = useMemo(() => {
    return ["entry_date", "entry_number", "journal_type", "description", "debit_account", "credit_account", "total_debit_usd", "total_debit_syp", "total_credit_usd", "total_credit_syp"];
  }, []);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("journal_entries", defaultVisibleColumns);

  const isLoading = loading || refreshing;

  const handlePost = async (id: string) => {
    try {
      await journalEntryService.postJournalEntry(id);
      refresh(true);
      if (detailOpen && selectedEntry?.id === id) {
        handleView(id);
      }
      toast.success("تم ترحيل القيد بنجاح");
    } catch (e: unknown) {
      toast.error("فشل ترحيل القيد: " + String(e));
    }
  };

  const handleReverse = async (id: string) => {
    try {
      await journalEntryService.reverseJournalEntry(id);
      refresh(true);
      if (detailOpen && selectedEntry?.id === id) {
        handleView(id);
      }
      toast.success("تم عكس القيد بنجاح");
    } catch (e: unknown) {
      toast.error("فشل عكس القيد: " + String(e));
    }
  };

  const handleView = async (id: string) => {
    try {
      const details = await journalEntryService.getJournalEntryDetails(id);
      setSelectedEntry(details);
      setDetailOpen(true);
    } catch (e: unknown) {
      toast.error("فشل تحميل تفاصيل القيد: " + String(e));
    }
  };

  const stats = useMemo(() => [
    { label: "إجمالي القيود", value: entries.length, icon: FileText, color: "text-slate-900" },
    { label: "إجمالي الحركات", value: entries.reduce((s, e) => s + (e.lines?.length || 0), 0), icon: Banknote, color: "text-indigo-600" },
  ], [entries]);

  const journalTotals = useMemo(() => {
    let debitUSD = 0, creditUSD = 0;
    let debitSYP = 0, creditSYP = 0;

    entries.forEach(entry => {
      entry.lines?.forEach(line => {
        const d = parseFloat(line.debit || "0");
        const c = parseFloat(line.credit || "0");
        
        if (line.currency === 'USD') {
          debitUSD += d;
          creditUSD += c;
        } else if (line.currency === 'SYP') {
          debitSYP += d;
          creditSYP += c;
        }
      });
    });

    return [
      { currencyCode: 'USD', currencySymbol: '$', debit: debitUSD, credit: creditUSD },
      { currencyCode: 'SYP', currencySymbol: 'ل.س', debit: debitSYP, credit: creditSYP },
    ];
  }, [entries]);

  const journalTitle = JOURNAL_TYPES.find(t => t.value === (filters.journal_type || 'GeneralJournal'))?.label || 'القيود اليومية';

  return (
    <OperationalTableTemplate
      title={journalTitle}
      stats={stats}
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white border-slate-200 h-9">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
        </div>
      }
      filterBar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="بحث في القيود (الرقم، البيان)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-4 pr-10 h-10 w-full bg-white shadow-sm font-bold placeholder:font-medium border-slate-200"
            />
          </div>
          <Select 
            value={filters.journal_type} 
            onValueChange={(val) => setFilters(f => ({ ...f, journal_type: val as JournalType }))}
          >
            <SelectTrigger className="w-[180px] h-10 bg-white font-bold shadow-sm border-slate-200">
              <Filter className="w-4 h-4 ml-2 text-slate-400" />
              <SelectValue placeholder="نوع اليومية" />
            </SelectTrigger>
            <SelectContent>
              {JOURNAL_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="font-bold">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      tableContent={
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
          <div className="border-b border-slate-100 bg-slate-50/50 p-2 flex justify-between items-center shrink-0">
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-white text-xs font-bold shadow-sm">
                    <Settings2 className="w-4 h-4 ml-2" />
                    تخصيص الأعمدة
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs font-bold text-slate-500">الأعمدة المعروضة</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableColumns.map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={isVisible(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                      className="text-xs font-bold justify-end text-right"
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <JournalTable
              entries={entries}
              loading={loading}
              visibleColumns={visibleColumns}
            />
          </div>
        </div>
      }
      summaryContent={
        <JournalSummaryFooter 
          totals={journalTotals} 
          visibleColumns={visibleColumns} 
          className="border-none shadow-none bg-transparent p-0"
        />
      }
    >
      <JournalDetailPanel
        open={detailOpen}
        onOpenChange={setDetailOpen}
        entry={selectedEntry}
        onPost={handlePost}
        onReverse={handleReverse}
      />
    </OperationalTableTemplate>
  );
}