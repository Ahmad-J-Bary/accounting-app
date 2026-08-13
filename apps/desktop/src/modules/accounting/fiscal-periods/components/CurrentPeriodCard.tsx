import { SectionCard } from "@shared/ui/section-card";
import { StatusBadge } from "@shared/ui/status-badge";
import { toLocalDateStr } from "@shared/lib/format";
import type { FiscalPeriodDto } from "@erp/shared-types";

interface DistributableProfit {
  current_period_profit: string;
  retained_earnings_balance: string;
  allocated_to_date: string;
  distributable: string;
}

interface CurrentPeriodCardProps {
  current: FiscalPeriodDto | null;
  distributable: DistributableProfit | null;
  show: (v?: string) => string;
}

export function CurrentPeriodCard({ current, distributable, show }: CurrentPeriodCardProps) {
  return (
    <SectionCard title="الفترة الحالية — الربح القابل للتوزيع">
      {current ? (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <StatusBadge status={current.status} />
            <span className="text-slate-600">
              {toLocalDateStr(current.start_date)} ← {toLocalDateStr(current.end_date)}
            </span>
          </p>
          {distributable && (
            <div className="space-y-1 border-t border-slate-200 pt-2">
              <p>صافي ربح الفترة: <span className="font-bold text-emerald-700">{show(distributable.current_period_profit)}</span></p>
              <p>رصيد الأرباح المبقاة: <span className="font-bold text-slate-700">{show(distributable.retained_earnings_balance)}</span></p>
              <p>المُوزَّع سابقاً: <span className="font-bold text-red-600">{show(distributable.allocated_to_date)}</span></p>
              <p className="border-t border-slate-200 pt-2">الربح القابل للتوزيع: <span className="font-black text-indigo-700">{show(distributable.distributable)}</span></p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          لا توجد فترة نشطة. أنشئ فترة مالية لتتمكن الحركات الجديدة من الترحيب فيها.
        </p>
      )}
    </SectionCard>
  );
}
