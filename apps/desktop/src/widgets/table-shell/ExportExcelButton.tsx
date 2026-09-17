import React from "react";
import { Button } from "@shared/ui/button";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface ExportExcelButtonProps {
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  className,
  variant = "outline",
  size = "sm",
  showLabel = true,
}) => {
  const { t } = useLocalization();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || loading}
      title={t("labels.exportExcel", { namespace: "common" })}
      className={cn(
        "h-8 px-2 border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition-colors",
        className
      )}
    >
      {loading ? (
        <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : (
        <Download className="ms-1 h-3.5 w-3.5 text-slate-500" />
      )}
      {showLabel && (
        <span className="text-xs">{t("labels.exportExcel", { namespace: "common" })}</span>
      )}
    </Button>
  );
};
