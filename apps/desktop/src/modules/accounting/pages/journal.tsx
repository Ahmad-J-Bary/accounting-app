import { useState, useMemo, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, FileText, CheckCircle2, FileEdit, Banknote, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, CreateJournalEntryRequest } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { useDataTable, useColumnPreferences } from '@shared/hooks';
import { JournalForm } from '@modules/accounting/components/JournalForm';
import { JournalTable } from '@modules/accounting/components/JournalTable';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function Journal() {
  const { currencies, baseCurrency } = useCurrencyContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener("erp:open-new-journal", handler);
    return () => window.removeEventListener("erp:open-new-journal", handler);
  }, []);

  const {
    filtered: entries,
    loading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<JournalEntryDto>({
    fetchData: () => journalEntryService.listJournalEntries(),
    searchFields: ["entry_number", "description"],
  });

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "entry_number", label: "رقم القيد" },
      { id: "entry_date", label: "التاريخ" },
      { id: "description", label: "البيان" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `amount_${curr.code}`, label: `المبلغ (${s})` });
    });

    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["entry_number", "entry_date", "description"];
    if (baseCurrency) {
      base.push(`amount_${baseCurrency.code}`);
    }
    return base;
  }, [baseCurrency]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("journal_entries", defaultVisibleColumns);

  const isLoading = loading || refreshing;

  const handleCreate = async (payload: CreateJournalEntryRequest) => {
    if (!payload.description?.trim()) {
      toast.error("الرجاء إدخال رقم القيد والبيان");
      return;
    }
    setSaving(true);
    try {
      await journalEntryService.createJournalEntry(payload);
      setCreateOpen(false);
      refresh(true);
      toast.success("تم تسجيل القيد بنجاح");
    } catch (e: unknown) {
      toast.error("فشل حفظ القيد: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    if (!confirm('هل أنت متأكد من ترحيل القيد؟ لا يمكن التعديل بعد الترحيل.')) return;
    try {
      await journalEntryService.postJournalEntry(id);
      refresh(true);
      toast.success("تم ترحيل القيد بنجاح");
    } catch (e: unknown) {
      toast.error("فشل ترحيل القيد: " + e);
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
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white border-slate-200">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />قيد جديد
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث برقم القيد أو البيان..."
              className="pr-10 h-10 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      tableContent={
        <JournalTable 
          entries={entries} 
          loading={loading} 
          onPost={handlePost} 
          onView={(id) => toast.info("سيتم إضافة عرض تفاصيل القيد قريباً")}
          visibleColumns={visibleColumns}
        />
      }
    >
      <JournalForm 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        onSave={handleCreate} 
        saving={saving} 
      />
    </OperationalTableTemplate>
  );
}