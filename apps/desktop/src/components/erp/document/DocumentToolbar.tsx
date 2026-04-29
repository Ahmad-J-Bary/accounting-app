import { Button } from "@/components/ui/button";
import {
  Plus, Save, Printer, Send, Trash2, X, RefreshCw, FileDown,
} from "lucide-react";

interface DocumentToolbarProps {
  docNumber: string;
  docDate: string;
  status: string;
  onNew?: () => void;
  onSave?: () => void;
  onSaveAndPrint?: () => void;
  onPost?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  saving?: boolean;
  posting?: boolean;
  canPost?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
}

export function DocumentToolbar({
  docNumber,
  docDate,
  status,
  onNew,
  onSave,
  onSaveAndPrint,
  onPost,
  onDelete,
  onClose,
  onExport,
  onRefresh,
  saving = false,
  posting = false,
  canPost = false,
  canDelete = true,
  canEdit = true,
}: DocumentToolbarProps) {
  return (
    <div
      dir="rtl"
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border-b border-slate-700 flex-wrap"
    >
      {/* Doc meta */}
      <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-600">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">رقم المستند</span>
          <span className="text-sm font-bold text-white font-mono">{docNumber}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">التاريخ</span>
          <span className="text-sm text-slate-200">{docDate}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">الحالة</span>
          <span className={`text-xs font-bold ${
            status === "Posted" ? "text-green-400" :
            status === "Draft" ? "text-amber-400" : "text-blue-400"
          }`}>
            {status === "Draft" ? "مسودة" : status === "Posted" ? "مرحّل" : status}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action Buttons */}
      {onNew && (
        <Button size="sm" variant="ghost" onClick={onNew}
          className="h-7 px-2.5 text-slate-200 hover:bg-slate-700 hover:text-white text-xs gap-1">
          <Plus className="w-3.5 h-3.5" /> جديد
        </Button>
      )}

      {onSave && canEdit && (
        <Button size="sm" variant="ghost" onClick={onSave} disabled={saving}
          className="h-7 px-2.5 text-slate-200 hover:bg-slate-700 hover:text-white text-xs gap-1">
          <Save className="w-3.5 h-3.5" />
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      )}

      {onSaveAndPrint && canEdit && (
        <Button size="sm" variant="ghost" onClick={onSaveAndPrint} disabled={saving}
          className="h-7 px-2.5 text-slate-200 hover:bg-slate-700 hover:text-white text-xs gap-1">
          <Printer className="w-3.5 h-3.5" /> حفظ وطباعة
        </Button>
      )}

      {onPost && canPost && (
        <Button size="sm" onClick={onPost} disabled={posting}
          className="h-7 px-2.5 bg-green-600 hover:bg-green-500 text-white text-xs gap-1 border-0">
          <Send className="w-3.5 h-3.5" />
          {posting ? "جاري الترحيل..." : "ترحيل"}
        </Button>
      )}

      {onRefresh && (
        <Button size="sm" variant="ghost" onClick={onRefresh}
          className="h-7 px-2 text-slate-400 hover:bg-slate-700 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      )}

      {onExport && (
        <Button size="sm" variant="ghost" onClick={onExport}
          className="h-7 px-2 text-slate-400 hover:bg-slate-700 hover:text-white">
          <FileDown className="w-3.5 h-3.5" />
        </Button>
      )}

      {onDelete && canDelete && (
        <Button size="sm" variant="ghost" onClick={onDelete}
          className="h-7 px-2 text-red-400 hover:bg-red-900/40 hover:text-red-300">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}

      {onClose && (
        <Button size="sm" variant="ghost" onClick={onClose}
          className="h-7 px-2 text-slate-400 hover:bg-slate-700 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
