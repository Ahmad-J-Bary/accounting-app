import { useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Settings2, Save, Send, History, Printer, Download } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  saveAndPostLabel,
}: DocumentToolbarProps) {
  const { t } = useLocalization();
  const resolvedSaveAndPostLabel = saveAndPostLabel ?? t('actions.postInvoice', );
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
          className="bg-card border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          <Plus className="w-4 h-4 ms-2" /> {t('labels.newMaterial', )}
        </Button>
      )}

      {isReadOnly && onEdit && (
        <Button
          size="sm"
          onClick={onEdit}
          className="bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 dark:shadow-amber-900/30 font-bold"
        >
          <Settings2 className="w-4 h-4 ms-2" /> {t('labels.editInvoice', )}
        </Button>
      )}

      {!isReadOnly && status === "Posted" ? (
        <>
          <Button
            size="sm"
            onClick={onSaveAndPost}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30 font-bold"
          >
            <Send className="w-4 h-4 ms-2" /> {t('labels.saveAndPostEdits', )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReopen}
            className="border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950 font-bold"
          >
            <History className="w-4 h-4 ms-2" /> {t('actions.unpost', )}
          </Button>
        </>
      ) : !isReadOnly && status !== "Posted" ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={saving}
            className="bg-card border-border text-foreground font-bold"
          >
            <Save className="w-4 h-4 ms-2" /> {saving ? t('states.saving', ) : t('actions.saveDraft', )}
          </Button>
          <Button
            size="sm"
            onClick={onSaveAndPost}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 dark:shadow-blue-900/30 font-bold"
          >
            <Send className="w-4 h-4 ms-2" /> {resolvedSaveAndPostLabel}
          </Button>
        </>
      ) : null}

      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="bg-card">
          <Download className="w-4 h-4 ms-2" /> {t('actions.exportExcel', )}
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onPrint ?? defaultPrint} className="bg-card">
        <Printer className="w-4 h-4 ms-2" /> {t('actions.print', )}
      </Button>
    </div>
  );
}
