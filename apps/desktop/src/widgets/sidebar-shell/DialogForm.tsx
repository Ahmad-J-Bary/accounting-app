import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@shared/ui/dialog";
import { Button } from "@shared/ui/button";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  saveLabel,
  children,
  description,
  className = "",
}: DialogFormProps) {
  const { t } = useLocalization();
  const resolvedSaveLabel = saveLabel ?? t('actions.save', );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-[600px] max-h-[90vh] overflow-y-auto ${className}`}
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </DialogHeader>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sidebar-content-gap)",
            padding: "var(--sidebar-container-py) var(--sidebar-container-px)",
          }}
        >
          {children}
        </div>
        {onSave && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t('actions.cancel', )}
            </Button>
            <Button
              onClick={onSave}
              disabled={isSaving || saveDisabled}
            >
              {isSaving ? t('states.saving', ) : resolvedSaveLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
