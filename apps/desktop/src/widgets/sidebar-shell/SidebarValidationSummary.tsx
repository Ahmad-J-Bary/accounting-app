import React from "react";
import { cn } from "@shared/lib/utils";
import { AlertCircle } from "lucide-react";
import type { SidebarValidationSummaryProps } from "./types";

export function SidebarValidationSummary({
  errors,
  className,
}: SidebarValidationSummaryProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3 text-right text-red-800",
        className
      )}
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs font-black">يرجى تصحيح الأخطاء التالية:</p>
        <ul className="list-disc list-inside text-[11px] font-medium space-y-0.5">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
