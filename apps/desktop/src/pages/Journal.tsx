import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { journalEntryService } from "@/services/journalEntryService";
import type { JournalEntryDto, CreateJournalEntryRequest } from "@erp/shared-types";

// Refactored Components & Hooks
import { useDataTable } from "@/hooks/useDataTable";
import { JournalForm } from "@/components/erp/journal/JournalForm";
import { JournalTable } from "@/components/erp/journal/JournalTable";

export default function Journal() {
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    filtered: entries,
    loading,
    search,
    setSearch,
    refresh,
  } = useDataTable<JournalEntryDto>({
    fetchData: () => journalEntryService.listJournalEntries(),
    searchFields: ["entry_number", "description"],
    errorLabel: "فشل تحميل القيود اليومية",
  });

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
    } catch (e) {
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
    } catch (e) {
      toast.error("فشل ترحيل القيد: " + e);
    }
  };

  return (
    <>
      <PageHeader
        title="القيود اليومية"
        subtitle="إدارة القيود المحاسبية اليومية"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "القيود اليومية" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${loading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />قيد جديد
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="بحث برقم القيد أو البيان..." 
              className="pr-10" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <JournalTable 
          entries={entries} 
          loading={loading} 
          onPost={handlePost} 
          onView={(id) => toast.info("سيتم إضافة عرض تفاصيل القيد قريباً")} 
        />
      </Card>

      <JournalForm 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
        onSave={handleCreate} 
        saving={saving} 
      />
    </>
  );
}