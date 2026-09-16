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
          className="bg-card border-success/20 text-success hover:bg-success/10 dark:border-success dark:text-success dark:hover:bg-success"
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
            className="bg-success hover:bg-success shadow-lg shadow-success/20 dark:shadow-success/30 font-bold"
          >
            <Send className="w-4 h-4 ms-2" /> {t('labels.saveAndPostEdits', )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReopen}
            className="border-destructive/20 text-destructive hover:bg-destructive/10 dark:border-destructive dark:text-destructive dark:hover:bg-destructive font-bold"
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
            className="bg-primary hover:bg-primary shadow-lg shadow-primary/20 dark:shadow-primary/30 font-bold"
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
