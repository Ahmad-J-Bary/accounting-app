import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsLayout } from "@widgets/templates/SettingsLayout";
import { Button } from "@shared/ui/button";
import { JournalForm } from "@modules/accounting/components/JournalForm";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { toast } from "sonner";
import { CreateJournalEntryRequest } from "@erp/shared-types";
import { ArrowRight } from "lucide-react";

export default function JournalCreate() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const handleSave = async (payload: CreateJournalEntryRequest) => {
    setSaving(true);
    try {
      await journalEntryService.createJournalEntry(payload);
      toast.success("تم تسجيل القيد بنجاح");
      navigate("/journal");
    } catch (e: unknown) {
      toast.error("فشل حفظ القيد: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/journal")} className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">إنشاء قيد يومية جديد</h1>
            <p className="text-sm font-bold text-slate-400 mt-1">إدخال حركة محاسبية يدوية بشكل تفصيلي وموزون</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
           <JournalForm 
              open={true} 
              onOpenChange={() => {}} 
              onSave={handleSave} 
              saving={saving} 
              inline={true}
           />
        </div>
      </div>
    </div>
  );
}
