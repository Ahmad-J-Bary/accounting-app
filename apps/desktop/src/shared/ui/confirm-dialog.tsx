import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLocalization();
  const resolvedConfirmLabel = confirmLabel ?? t('actions.confirm', );
  const resolvedCancelLabel = cancelLabel ?? t('actions.cancel', );
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="space-y-2">{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{resolvedCancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && "bg-red-600 hover:bg-red-700 text-white font-bold")}
          >
            {resolvedConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}