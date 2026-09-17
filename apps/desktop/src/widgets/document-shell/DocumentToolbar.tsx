import { useCallback } from "react";
import { useLocalization } from "@app/providers/LocalizationProvider";
import {
  ResponsiveActions,
} from "@widgets/page-header/ResponsiveActions";
import { buildDocumentToolbarActions } from "./documentToolbarActions";

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
  const defaultPrint = useCallback(() => {
    window.dispatchEvent(new Event("app:prepare-print"));
    requestAnimationFrame(() => {
      window.print();
      const endPrint = () => window.dispatchEvent(new Event("app:end-print"));
      window.addEventListener("afterprint", endPrint, { once: true });
      setTimeout(endPrint, 3000);
    });
  }, []);

  const actions = buildDocumentToolbarActions(
    {
      status,
      isReadOnly,
      saving,
      onNewMaterial,
      onEdit,
      onSaveDraft,
      onSaveAndPost,
      onReopen,
      onPrint: onPrint ?? defaultPrint,
      onExport,
      saveAndPostLabel,
    },
    t,
  );

  return (
    <ResponsiveActions actions={actions} />
  );
}
