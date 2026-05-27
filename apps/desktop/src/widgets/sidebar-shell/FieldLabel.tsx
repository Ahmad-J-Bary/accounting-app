import type { ReactNode } from "react";
import type { FieldLabelProps } from "./types";

export function FieldLabel({
  children,
  required,
  className = "",
}: FieldLabelProps) {
  return (
    <label
      className={`font-bold text-slate-600 ${className}`}
      style={{ fontSize: "var(--sidebar-label-size)", display: "block" }}
    >
      {children}
      {required && <span className="text-red-500 mr-1">*</span>}
    </label>
  );
}
