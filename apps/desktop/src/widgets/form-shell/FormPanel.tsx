import { ReactNode } from "react";
import { Button } from "@shared/ui/button";
import { X, Save } from "lucide-react";
import { cn } from '@shared/lib/utils';

interface FormPanelProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
}

export function FormPanel({
  title,
  icon,
  onClose,
  onSave,
  isSaving = false,
  children,
  footer,
  className,
  saveLabel = "حفظ البيانات",
  saveDisabled = false,
}: FormPanelProps) {
  return (
    <div className={cn("flex flex-col h-full bg-white", className)} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50">
        <div className="flex items-center gap-3">
          {icon && <div className="text-slate-500">{icon}</div>}
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {children}
      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-end gap-3 mt-auto">
        {footer ? footer : (
          <>
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              إلغاء
            </Button>
            {onSave && (
              <Button onClick={onSave} disabled={isSaving || saveDisabled} className="gap-2">
                <Save className="w-4 h-4" />
                {isSaving ? "جاري الحفظ..." : saveLabel}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
