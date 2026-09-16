import { useSidePanelSettings } from "@shared/hooks/useSidePanelSettings";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import type { SidebarFooterProps } from "./types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function SidebarFooter({
  children,
  onCancel,
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel,
  cancelLabel,
  className,
}: SidebarFooterProps) {
  const { settings } = useSidePanelSettings();
  const { t } = useLocalization();
  const resolvedSaveLabel = saveLabel ?? t('actions.saveChanges', );
  const resolvedCancelLabel = cancelLabel ?? t('actions.cancel', );

  const footerPadding =
    settings.paddingPreset === "compact" ? "p-3" : "p-4";

  const layoutClass = {
    left: "justify-start flex-row-reverse",
    right: "justify-end",
    justify: "justify-between w-full",
  }[settings.saveButtonPlacement];

  return (
    <div
      className={cn(
        "border-t border-slate-200/60 bg-slate-50 flex items-center gap-3 shrink-0 mt-auto",
        footerPadding,
        layoutClass,
        settings.stickyHeaderFooter ? "sticky bottom-0 z-10" : "",
        className
      )}
    >
      {children ? (
        children
      ) : (
        <>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="h-9 px-4 rounded-lg text-slate-600 border-slate-200 text-xs font-bold"
            >
              {resolvedCancelLabel}
            </Button>
          )}
          {onSave && (
            <Button
              type="button"
              onClick={onSave}
              disabled={isSaving || saveDisabled}
              className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold shadow-md shadow-primary/20"
            >
              {isSaving ? t('states.saving', ) : resolvedSaveLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
