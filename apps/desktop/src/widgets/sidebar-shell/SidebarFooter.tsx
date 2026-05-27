import React, { ReactNode } from "react";
import { useSidebarSettings } from "@shared/hooks/useSidebarSettings";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import type { SidebarFooterProps } from "./types";

export function SidebarFooter({
  children,
  onCancel,
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel = "حفظ التغييرات",
  cancelLabel = "إلغاء",
  className,
}: SidebarFooterProps) {
  const { settings } = useSidebarSettings();

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
              {cancelLabel}
            </Button>
          )}
          {onSave && (
            <Button
              type="button"
              onClick={onSave}
              disabled={isSaving || saveDisabled}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-100"
            >
              {isSaving ? "جارى الحفظ..." : saveLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
