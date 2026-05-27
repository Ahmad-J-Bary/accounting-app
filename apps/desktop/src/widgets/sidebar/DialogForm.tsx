import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";

interface DialogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSave?: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  children: ReactNode;
  description?: string;
  className?: string;
}

export function DialogForm({
  open,
  onOpenChange,
  title,
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel = "حفظ",
  children,
  description,
  className = "",
}: DialogFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[600px] max-h-[90vh] overflow-y-auto ${className}`} dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--sidebar-content-gap)",
          padding: "var(--sidebar-container-py) var(--sidebar-container-px)"
        }}>
          {children}
        </div>
        {onSave && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              إلغاء
            </Button>
            <Button onClick={onSave} disabled={isSaving || saveDisabled}>
              {isSaving ? "جاري الحفظ..." : saveLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
