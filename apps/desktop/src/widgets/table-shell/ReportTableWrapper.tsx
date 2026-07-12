import type { ReactNode } from "react";

export function ReportTableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  );
}
