import type { FieldLabelProps } from "./types";

export function FieldLabel({
  children,
  required,
  htmlFor,
  className = "",
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`font-bold text-slate-600 block ${className}`}
      style={{ fontSize: "var(--sidebar-label-size)" }}
    >
      {children}
      {required && <span className="ms-1 text-red-500">*</span>}
    </label>
  );
}
