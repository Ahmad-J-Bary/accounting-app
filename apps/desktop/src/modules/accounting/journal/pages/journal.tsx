import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, LayoutList, LayoutGrid } from "lucide-react";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/journal/components/JournalTable';
import { JOURNAL_TYPES } from "@modules/accounting/journal/lib/journal-config";

type DisplayMode = "two-line" | "one-line";

export default function Journal() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as JournalType | null;
  
  const [filters, setFilters] = useState<JournalFilters>({
    journal_type: typeParam || 'GeneralJournal',
    from_date: undefined,
    to_date: undefined,
  });

  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    () => (localStorage.getItem("journal-display-mode") as DisplayMode) || "two-line"
  );

  useEffect(() => {
    localStorage.setItem("journal-display-mode", displayMode);
  }, [displayMode]);

  useEffect(() => {
    // Sync from URL only when the query param exists.
    // Do not force-reset user selection back to GeneralJournal.
    if (typeParam && typeParam !== (filters.journal_type || 'GeneralJournal')) {
      setFilters(f => ({ ...f, journal_type: typeParam }));
    }
  }, [typeParam, filters.journal_type]);

  const fetchData = useCallback(() => {
    return journalEntryService.listJournalEntries(filters);
  }, [filters]);

  const {
    filtered: entries,
    loading,
    search,
    setSearch,
  } = useDataTable<JournalEntryDto>({
    queryKey: ["journal-entries", JSON.stringify(filters)],
    fetchData,
    searchFields: ["entry_number", "description"],
  });

  const displayEntries = useMemo(() => {
    const jt = filters.journal_type;
    if (!jt || jt === 'GeneralJournal') return entries;

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
    if (allowed) return entries.filter(e => allowed.has(e.journal_type));

    return entries;
  }, [entries, filters.journal_type]);

  const journalTitle = JOURNAL_TYPES.find(t => t.value === (filters.journal_type || 'GeneralJournal'))?.label || 'القيود اليومية';

  return (
    <OperationalTableTemplate
      title={journalTitle}
      toolbar={<></>}
      tableContent={
        <JournalTable
          key={`journal-table-${filters.journal_type || 'GeneralJournal'}-${displayMode}`}
          entries={displayEntries}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filters={filters as JournalFilters}
          displayMode={displayMode}
          filterBar={
            <div className="flex flex-wrap items-center gap-2">
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
