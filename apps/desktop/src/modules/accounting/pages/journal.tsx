import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

const JOURNAL_TYPES: { value: JournalType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'الكل' },
  { value: 'GeneralJournal', label: 'يومية عامة' },
  { value: 'CashJournal', label: 'يومية الصندوق' },
  { value: 'CashSalesJournal', label: 'مبيعات نقدية' },
  { value: 'CreditSalesJournal', label: 'مبيعات آجلة' },
  { value: 'PurchaseJournal', label: 'مشتريات' },
  { value: 'PurchaseCostsJournal', label: 'تكاليف إضافية للمشتريات' },
];

export default function Journal() {
  const navigate = useNavigate();
  const { currencies, baseCurrency } = useCurrencyContext();
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  const [filters, setFilters] = useState<JournalFilters>({
    journal_type: undefined,
    from_date: undefined,
    to_date: undefined,
  });

  useEffect(() => {
    const handler = () => navigate("/journal/new");
    window.addEventListener("erp:open-new-journal", handler);
    return () => window.removeEventListener("erp:open-new-journal", handler);
  }, [navigate]);

  const {
    filtered: entries,
    loading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<JournalEntryDto>({
    fetchData: () => journalEntryService.listJournalEntries(filters),
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
      { id: "total_debit", label: "عليه / مدين" },
      { id: "total_credit", label: "له / دائن" },
      { id: "status", label: "الحالة" },
    ];
  }, []);

  const defaultVisibleColumns = useMemo(() => {
    return ["entry_date", "entry_number", "journal_type", "description", "debit_account", "credit_account", "total_debit", "total_credit", "status"];
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
    { label: "قيود مسودة", value: entries.filter(e => e.status === 'Draft').length, icon: FileEdit, color: "text-blue-600" },
    { label: "قيود مرحلة", value: entries.filter(e => e.status === 'Posted').length, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "إجمالي الحركات", value: entries.reduce((s, e) => s + (e.lines?.length || 0), 0), icon: Banknote, color: "text-indigo-600" },
  ], [entries]);

  return (
    <OperationalTableTemplate
      title="القيود اليومية"
      stats={stats}
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white border-slate-200 h-9">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => navigate("/journal/new")} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-9 px-4 font-bold">
            <Plus className="w-4 h-4 ml-2" />إنشاء قيد يومية
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
            value={filters.journal_type || 'ALL'} 
            onValueChange={(val) => setFilters(f => ({ ...f, journal_type: val === 'ALL' ? undefined : val as JournalType }))}
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
              onPost={handlePost}
              onView={handleView}
              visibleColumns={visibleColumns}
            />
          </div>
        </div>
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