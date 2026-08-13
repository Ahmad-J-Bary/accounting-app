import { Button } from "@shared/ui/button";
import { SectionCard } from "@shared/ui/section-card";
import { StatusBadge } from "@shared/ui/status-badge";
import { LoadingState } from "@widgets/table-shell/LoadingState";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { Lock, LockOpen } from "lucide-react";
import { toLocalDateStr } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import type { FiscalPeriodDto } from "@erp/shared-types";

export type PeriodActionType = "close" | "lock" | "reopen";

const POSTING_BLOCKED: Array<FiscalPeriodDto["status"]> = ["Closing", "Closed", "Locked", "Cancelled"];

interface PeriodsTableProps {
  periods: FiscalPeriodDto[];
  current: FiscalPeriodDto | null;
  isLoading: boolean;
  actionBusy: boolean;
  onAction: (type: PeriodActionType, period: FiscalPeriodDto) => void;
}

export function PeriodsTable({ periods, current, isLoading, actionBusy, onAction }: PeriodsTableProps) {
  return (
    <SectionCard title="القائمة" contentClassName="p-0 space-y-0 overflow-x-auto">
      {isLoading && <LoadingState rows={3} />}
      {!isLoading && periods.length === 0 && (
        <div className="py-10">
          <EmptyState compact message="لا توجد فترات بعد" suggestion="أنشئ أول فترة مالية — تصبح إلزامية لترحيل أي قيد جديد" />
        </div>
      )}
      {!isLoading && periods.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th scope="col" className="text-right px-4 py-2 font-semibold">البداية</th>
              <th scope="col" className="text-right px-4 py-2 font-semibold">النهاية</th>
              <th scope="col" className="text-right px-4 py-2 font-semibold">الحالة</th>
              <th scope="col" className="text-right px-4 py-2 font-semibold">أُغلقت بواسطة</th>
              <th scope="col" className="text-right px-4 py-2 font-semibold">قُفلت بواسطة</th>
              <th scope="col" className="text-right px-4 py-2 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const isCurrent = current?.id === p.id;
              const blocked = POSTING_BLOCKED.includes(p.status);
              const canLock = !["Locked", "Cancelled"].includes(p.status);
              const canClose = ["Open", "Reopened", "Closing"].includes(p.status);
              const canReopen = p.status === "Closed";
              return (
                <tr
                  key={p.id}
                  className={cn("border-b border-slate-100", isCurrent && "bg-emerald-50/40")}
                >
                  <td className="px-4 py-2 tabular-nums">{toLocalDateStr(p.start_date)}</td>
                  <td className="px-4 py-2 tabular-nums">{toLocalDateStr(p.end_date)}</td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={p.status} />
                      {isCurrent && <span className="text-[10px] font-bold text-emerald-600">المركز الحالية</span>}
                      {blocked && <span className="text-[10px] font-bold text-slate-400">مرفوضة الحركة</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.closed_by || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{p.locked_by || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {canClose && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-slate-200 text-slate-700 font-bold"
                          disabled={actionBusy}
                          onClick={() => onAction("close", p)}
                        >
                          إغلاق
                        </Button>
                      )}
                      {canReopen && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-blue-200 text-blue-700 font-bold"
                          disabled={actionBusy}
                          onClick={() => onAction("reopen", p)}
                        >
                          <LockOpen className="h-3 w-3" />
                          إعادة فتح
                        </Button>
                      )}
                      {canLock && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-slate-200 text-slate-700 font-bold"
                          disabled={actionBusy}
                          onClick={() => onAction("lock", p)}
                        >
                          <Lock className="h-3 w-3" />
                          قفل نهائي
                        </Button>
                      )}
                      {!canClose && !canReopen && !canLock && (
                        <span className="text-2xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
