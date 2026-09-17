import { Download, History, Plus, Printer, Save, Send, Settings2 } from "lucide-react";
import type { LocalizationContextValue } from "@shared/types/i18n";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";
import type { DocumentToolbarProps } from "./DocumentToolbar";

export function buildDocumentToolbarActions(
  {
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
  }: DocumentToolbarProps,
  t: LocalizationContextValue["t"],
): ResponsiveActionItem[] {
  const resolvedSaveAndPostLabel = saveAndPostLabel ?? t("actions.postInvoice");

  const actions: ResponsiveActionItem[] = [];

  if (onNewMaterial) {
    actions.push({
      id: "new-material",
      label: t("labels.newMaterial"),
      icon: Plus,
      priority: "secondary",
      variant: "outline",
      onClick: onNewMaterial,
    });
  }

  if (isReadOnly && onEdit) {
    actions.push({
      id: "edit",
      label: t("labels.editInvoice"),
      icon: Settings2,
      priority: "primary",
      onClick: onEdit,
    });
  }

  if (!isReadOnly && status === "Posted") {
    if (onSaveAndPost) {
      actions.push({
        id: "save-posted-edits",
        label: t("labels.saveAndPostEdits"),
        icon: Send,
        priority: "primary",
        loading: saving,
        onClick: onSaveAndPost,
      });
    }

    if (onReopen) {
      actions.push({
        id: "reopen",
        label: t("actions.unpost"),
        icon: History,
        priority: "secondary",
        variant: "outline",
        destructive: true,
        onClick: onReopen,
      });
    }
  } else if (!isReadOnly && status !== "Posted") {
    if (onSaveDraft) {
      actions.push({
        id: "save-draft",
        label: saving ? t("states.saving") : t("actions.saveDraft"),
        icon: Save,
        priority: "secondary",
        variant: "outline",
        loading: saving,
        onClick: onSaveDraft,
      });
    }

    if (onSaveAndPost) {
      actions.push({
        id: "save-and-post",
        label: resolvedSaveAndPostLabel,
        icon: Send,
        priority: "primary",
        loading: saving,
        onClick: onSaveAndPost,
      });
    }
  }

  if (onExport) {
    actions.push({
      id: "export",
      label: t("actions.exportExcel"),
      icon: Download,
      priority: "tertiary",
      variant: "outline",
      onClick: onExport,
    });
  }

  actions.push({
    id: "print",
    label: t("actions.print"),
    icon: Printer,
    priority: "overflow",
    variant: "outline",
    onClick: onPrint,
  });

  return actions;
}
