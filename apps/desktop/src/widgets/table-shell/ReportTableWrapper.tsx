import type { ReactNode } from "react";

export function ReportTableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      {children}
    </div>
  );
}
