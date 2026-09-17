import { cn } from "@shared/lib/utils";
import { AlertCircle } from "lucide-react";
import type { SidebarValidationSummaryProps } from "./types";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function SidebarValidationSummary({
  errors,
  className,
}: SidebarValidationSummaryProps) {
  const { t } = useLocalization();
  if (!errors || errors.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-red-800 text-start",
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs font-black">{t("labels.fixErrors", { namespace: "common" })}</p>
        <ul className="list-disc list-inside text-[11px] font-medium space-y-0.5">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
