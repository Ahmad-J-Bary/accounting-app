import { useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Settings2, Save, Send, History, Printer, Download } from "lucide-react";

export interface DocumentToolbarProps {
  status?: string;
  isReadOnly: boolean;
  saving: boolean;
  onNewMaterial?: () => void;
  onEdit?: () => void;
  onSaveDraft?: () => void;
  onSaveAndPost?: () => void;
  onReopen?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  saveAndPostLabel?: string;
}

export function DocumentToolbar({
  status,
  isReadOnly,
  saving,
  onNewMaterial,
  onEdit,
  onSaveDraft,
  onSaveAndPost,
  onReopen,
  onPrint,
  onExport,
  saveAndPostLabel = "ترحيل الفاتورة",
}: DocumentToolbarProps) {
  const defaultPrint = useCallback(() => {
    window.dispatchEvent(new Event("app:prepare-print"));
    requestAnimationFrame(() => {
      window.print();
      const endPrint = () => window.dispatchEvent(new Event("app:end-print"));
      window.addEventListener("afterprint", endPrint, { once: true });
      setTimeout(endPrint, 3000);
    });
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onNewMaterial && (
        <Button
          size="sm"
          variant="outline"
          onClick={onNewMaterial}
          className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        >
          <Plus className="w-4 h-4 ml-2" /> مادة جديدة
        </Button>
      )}

      {isReadOnly && onEdit && (
        <Button
          size="sm"
          onClick={onEdit}
          className="bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 font-bold"
        >
          <Settings2 className="w-4 h-4 ml-2" /> تعديل الفاتورة
        </Button>
      )}

      {!isReadOnly && status === "Posted" ? (
        <>
          <Button
            size="sm"
            onClick={onSaveAndPost}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 font-bold"
          >
            <Send className="w-4 h-4 ml-2" /> حفظ وترحيل التعديلات
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReopen}
            className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
          >
            <History className="w-4 h-4 ml-2" /> إلغاء الترحيل
          </Button>
        </>
      ) : !isReadOnly && status !== "Posted" ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={saving}
            className="bg-white border-slate-200 text-slate-700 font-bold"
          >
            <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ مسودة"}
          </Button>
          <Button
            size="sm"
            onClick={onSaveAndPost}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold"
          >
            <Send className="w-4 h-4 ml-2" /> {saveAndPostLabel}
          </Button>
        </>
      ) : null}

      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="bg-white">
          <Download className="w-4 h-4 ml-2" /> تصدير إكسل
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onPrint ?? defaultPrint} className="bg-white">
        <Printer className="w-4 h-4 ml-2" /> طباعة
      </Button>
    </div>
  );
}
