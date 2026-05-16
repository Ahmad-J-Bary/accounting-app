import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Search, FileText, Banknote, Filter } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/components/JournalTable';
import { JournalDetailPanel } from '@modules/accounting/components/JournalDetailPanel';
import { JournalSummaryFooter } from "@modules/accounting/components/JournalSummaryFooter";
import { JOURNAL_TYPES, getJournalColumnsByType } from "@modules/accounting/lib/journal-config";
import { toJournalRow, aggregateEntryTotals } from "@modules/accounting/lib/journal-view";

export default function Journal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as JournalType | null;


  const [selectedEntry, setSelectedEntry] = useState<JournalEntryDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  const [filters, setFilters] = useState<JournalFilters>({
    journal_type: typeParam || 'GeneralJournal',
    from_date: undefined,
    to_date: undefined,
  });

  useEffect(() => {
    // Sync from URL only when the query param exists.
    // Do not force-reset user selection back to GeneralJournal.
    if (typeParam && typeParam !== (filters.journal_type || 'GeneralJournal')) {
      setFilters(f => ({ ...f, journal_type: typeParam }));
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

  const visibleColumns = useMemo(
    () => getJournalColumnsByType(),
    []
  );

  const displayEntries = useMemo(() => {
    const jt = filters.journal_type;
    if (!jt || jt === 'GeneralJournal') return entries;

    const ALLOWED: Record<string, Set<string>> = {
      CashJournal:       new Set(['CashJournal', 'DrawingsVoucher','CashReceipt','CashPayment', 'ExpenseVoucher','CashOpeningBalance','AccountOpeningBalance']),
      PurchaseJournal:   new Set(['PurchaseJournal','PurchaseCostsJournal']),
      PurchaseCostsJournal: new Set(['PurchaseCostsJournal']),
      CashSalesJournal:  new Set(['CashSalesJournal']),
      CreditSalesJournal: new Set(['CreditSalesJournal']),
    };

    const allowed = ALLOWED[jt];
    if (allowed) return entries.filter(e => allowed.has(e.journal_type));

    return entries;
  }, [entries, filters.journal_type]);

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
    { label: "إجمالي القيود", value: displayEntries.length, icon: FileText, color: "text-slate-900" },
    { label: "إجمالي الحركات", value: displayEntries.reduce((s, e) => s + (e.lines?.length || 0), 0), icon: Banknote, color: "text-indigo-600" },
  ], [displayEntries]);

  const journalTotals = useMemo(() => {
    const t = aggregateEntryTotals(displayEntries);
    return [
      { currencyCode: 'USD', currencySymbol: '$', debit: t.debitUSD, credit: t.creditUSD },
      { currencyCode: 'SYP', currencySymbol: 'ل.س', debit: t.debitUSD, credit: t.creditUSD },
    ];
  }, [displayEntries]);

  const journalTitle = JOURNAL_TYPES.find(t => t.value === (filters.journal_type || 'GeneralJournal'))?.label || 'القيود اليومية';

  return (
    <OperationalTableTemplate
      title={journalTitle}
      stats={stats}
      toolbar={<></>}
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
          <div className="flex-1 overflow-auto">
            <JournalTable
              key={`journal-table-${filters.journal_type || 'GeneralJournal'}`}
              entries={displayEntries}
              loading={loading}
              visibleColumns={visibleColumns}
              filters={filters as JournalFilters}
            />
          </div>
        </div>
      }
      summaryContent={
        <JournalSummaryFooter 
          totals={journalTotals} 
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
