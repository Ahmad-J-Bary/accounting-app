import { useState, useMemo, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, FileText, CheckCircle2, FileEdit, Banknote } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService } from '@modules/accounting/api/journalEntryService';
import type { JournalEntryDto, CreateJournalEntryRequest } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { useDataTable } from '@shared/hooks';
import { JournalForm } from '@modules/accounting/components/JournalForm';
import { JournalTable } from '@modules/accounting/components/JournalTable';

export default function Journal() {
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
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />قيد جديد
          </Button>
        </div>
      }
      headerWidgets={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <div className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</div>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث برقم القيد أو البيان..."
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      }
      tableContent={
        <JournalTable 
          entries={entries} 
          loading={loading} 
          onPost={handlePost} 
          onView={(id) => toast.info("سيتم إضافة عرض تفاصيل القيد قريباً")} 
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