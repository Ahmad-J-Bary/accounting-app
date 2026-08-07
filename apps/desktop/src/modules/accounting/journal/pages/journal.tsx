import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Filter, LayoutList, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { DateRangePicker } from "@widgets/reports";
import { useReportFilters } from "@shared/hooks/useReportFilters";
import { toLocalDateStr } from "@shared/lib/format";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/journal/components/JournalTable';
import { JOURNAL_TYPES } from "@modules/accounting/journal/lib/journal-config";

type DisplayMode = "two-line" | "one-line";

export default function Journal() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as JournalType | null;

  // Date range: same defaults + URL sync as the Account Movements page
  const { filters: dateFilters, setFilters: setDateFilters } = useReportFilters();

  const [journalType, setJournalType] = useState<JournalType>(typeParam || 'GeneralJournal');

  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => (localStorage.getItem("journal-display-mode") as DisplayMode) || "two-line"
  );

  const [reversingId, setReversingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem("journal-display-mode", displayMode);
  }, [displayMode]);

  useEffect(() => {
    // Sync from URL only when the query param exists.
    // Do not force-reset user selection back to GeneralJournal.
    if (typeParam && typeParam !== (journalType || 'GeneralJournal')) {
      setJournalType(typeParam);
    }
  }, [typeParam, journalType]);

  // Fetch all entries; the date range is applied client-side (local dates),
  // mirroring the Account Movements page for consistent behavior.
  const queryFilters = useMemo<JournalFilters>(() => ({}), []);

  const fetchData = useCallback(() => {
    return journalEntryService.listJournalEntries(queryFilters);
  }, [queryFilters]);

  const {
    filtered: entries,
    loading,
    search,
    setSearch,
  } = useDataTable<JournalEntryDto>({
    queryKey: ["journal-entries", JSON.stringify(queryFilters)],
    fetchData,
    searchFields: ["entry_number", "description"],
  });

  const displayEntries = useMemo(() => {
    let list = entries;

    // Apply date range filter (local date strings, same as Account Movements)
    if (dateFilters.from_date && dateFilters.to_date) {
      list = list.filter((e) => {
        const d = toLocalDateStr(e.entry_date);
        return d >= dateFilters.from_date && d <= dateFilters.to_date;
      });
    }

    const jt = journalType;
    if (!jt || jt === 'GeneralJournal') return list;

    const ALLOWED: Record<string, Set<string>> = {
      CashJournal:          new Set(['CashJournal', 'DrawingsVoucher', 'CashReceipt', 'CashPayment', 'ExpenseVoucher', 'CashOpeningBalance', 'AccountOpeningBalance', 'SupplierReceiptJournal', 'CustomerPaymentJournal']),
      PurchaseJournal:      new Set(['PurchaseJournal', 'PurchaseCostsJournal']),
      PurchaseCostsJournal: new Set(['PurchaseCostsJournal']),
      CashSalesJournal:     new Set(['CashSalesJournal']),
      CreditSalesJournal:   new Set(['CreditSalesJournal']),
      // مرتجعات المبيعات: قيد المرتجع + أي سند دفع لعميل مرتبط به
      SalesReturnJournal:   new Set(['SalesReturnJournal']),
      // مرتجعات المشتريات: قيد المرتجع + أي سند قبض من مورد مرتبط به
      PurchaseReturnJournal: new Set(['PurchaseReturnJournal']),
    };

    const allowed = ALLOWED[jt];
    if (allowed) return list.filter(e => allowed.has(e.journal_type));

    return list;
  }, [entries, journalType, dateFilters.from_date, dateFilters.to_date]);

  const journalTitle = JOURNAL_TYPES.find(t => t.value === (journalType || 'GeneralJournal'))?.label || 'القيود اليومية';

  const handleReverse = useCallback(async (id: string) => {
    if (!window.confirm("سيتم ترحيل قيد عكسي (معاكس) يُلغي أثر القيد ويحدد القيد الأصلي كمعكوس. هل تريد المتابعة؟")) {
      return;
    }
    setReversingId(id);
    try {
      const reversal = await journalEntryService.reverseJournalEntry(id);
      toast.success(`تم ترحيل القيد العكسي ${reversal.entry_number}`);
      await queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    } catch (e) {
      toast.error("فشل عكس القيد: " + e);
    } finally {
      setReversingId(null);
    }
  }, [queryClient]);

  return (
    <OperationalTableTemplate
      title={journalTitle}
      toolbar={
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            from={dateFilters.from_date}
            to={dateFilters.to_date}
            onFromChange={(v) => setDateFilters({ from_date: v })}
            onToChange={(v) => setDateFilters({ to_date: v })}
          />
        </div>
      }
      tableContent={
        <JournalTable
          key={`journal-table-${journalType || 'GeneralJournal'}-${displayMode}`}
          entries={displayEntries}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filters={queryFilters}
          displayMode={displayMode}
          onReverse={handleReverse}
          reversingId={reversingId}
          filterBar={
            <div className="flex flex-wrap items-center gap-2">
              <Select 
                value={journalType} 
                onValueChange={(val) => setJournalType(val as JournalType)}
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
              
              <div className="flex items-center gap-1 ml-2 border-slate-200 border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDisplayMode("two-line")}
                  className={`p-2 transition-colors ${
                    displayMode === "two-line"
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="شكل السطرين (افتراضي)"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("one-line")}
                  className={`p-2 transition-colors ${
                    displayMode === "one-line"
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                  title="شكل السطر الواحد"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          }
        />
      }
    >
    </OperationalTableTemplate>
  );
}
