import { Button } from "@shared/ui/button";
import { SectionCard } from "@shared/ui/section-card";
import { StatusBadge } from "@shared/ui/status-badge";
import { LoadingState } from "@widgets/table-shell/LoadingState";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { LockOpen } from "lucide-react";
import { toLocalDateStr } from "@shared/lib/format";
import type { FiscalYearDto } from "@erp/shared-types";

export type FiscalYearActionType = "close" | "reopen";

interface FiscalYearsTableProps {
  years: FiscalYearDto[];
  isLoading: boolean;
  actionBusy: boolean;
  onAction: (type: FiscalYearActionType, year: FiscalYearDto) => void;
}

export function FiscalYearsTable({ years, isLoading, actionBusy, onAction }: FiscalYearsTableProps) {
  return (
    <SectionCard title="القائمة" contentClassName="p-0 space-y-0 overflow-x-auto">
      {isLoading && <LoadingState rows={3} />}
      {!isLoading && years.length === 0 && (
        <div className="py-10">
          <EmptyState compact message="لا توجد سنوات مالية بعد" suggestion="أنشئ أول سنة مالية لإدارة الدورة المحاسبية" />
        </div>
      )}
      {!isLoading && years.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th scope="col" className="text-end px-4 py-2 font-semibold">التسمية</th>
              <th scope="col" className="text-end px-4 py-2 font-semibold">البداية</th>
              <th scope="col" className="text-end px-4 py-2 font-semibold">النهاية</th>
              <th scope="col" className="text-end px-4 py-2 font-semibold">الحالة</th>
              <th scope="col" className="text-end px-4 py-2 font-semibold">أُغلقت بواسطة</th>
              <th scope="col" className="text-end px-4 py-2 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {years.map((fy) => {
              const canClose = ["Open", "Reopened"].includes(fy.status);
              const canReopen = fy.status === "Closed";
              const isTerminal = fy.status === "Locked";
              return (
                <tr key={fy.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-bold text-slate-900">{fy.label}</td>
                  <td className="px-4 py-2 tabular-nums">{toLocalDateStr(fy.start_date)}</td>
                  <td className="px-4 py-2 tabular-nums">{toLocalDateStr(fy.end_date)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={fy.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{fy.closed_by || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {canClose && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-slate-200 text-slate-700 font-bold"
                          disabled={actionBusy}
                          onClick={() => onAction("close", fy)}
                        >
                          إغلاق
                        </Button>
                      )}
                      {canReopen && (
                        <Button
                          variant="outline"
                          className="h-8 text-xs border-blue-200 text-blue-700 font-bold"
                          disabled={actionBusy}
                          onClick={() => onAction("reopen", fy)}
                        >
                          <LockOpen className="h-3 w-3" />
                          إعادة فتح
                        </Button>
                      )}
                      {isTerminal && (
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
