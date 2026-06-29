import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@shared/ui/input";
import { Search, Filter } from "lucide-react";
import { journalEntryService, type JournalFilters } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, JournalType } from "@erp/shared-types";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalTable } from '@modules/accounting/components/JournalTable';
import { JOURNAL_TYPES, getJournalColumnsByType } from "@modules/accounting/lib/journal-config";

export default function Journal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') as JournalType | null;
  
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
          key={`journal-table-${filters.journal_type || 'GeneralJournal'}`}
          entries={displayEntries}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filters={filters as JournalFilters}
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
            </div>
          }
        />
      }
    >
    </OperationalTableTemplate>
  );
}
