import { cn } from "@shared/lib/utils";
import { Filter } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

interface ReportLayoutProps {
  title: string;
  subtitle?: string;
  filters?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ReportLayout({ title, subtitle, filters, children, actions, className }: ReportLayoutProps) {
  return (
    <div className={cn("flex flex-col h-full bg-muted/30", className)} dir="rtl">
      <PageHeader title={title} subtitle={subtitle} actions={actions} pinAction pinLabel={title} />

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10 space-y-6">
        {filters && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-bold text-foreground text-sm">تصفية التقرير</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {filters}
            </div>
          </section>
        )}

        <main className="flex flex-1 min-h-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:min-h-[500px]">
          {children}
        </main>
      </div>
    </div>
  );
}

export function ReportTable({ children }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm">
          <tr className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest border-b border-border">
            {children}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
        </tbody>
      </table>
    </div>
  );
}
