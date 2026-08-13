import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import {
  fiscalPeriodService,
  periodWindowFromDateInput,
} from "@modules/accounting/api/fiscalPeriodService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Input } from "@shared/ui/input";
import { StatusBadge } from "@shared/ui/status-badge";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { cn } from "@shared/lib/utils";
import type { FiscalPeriodDto } from "@erp/shared-types";

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

const POSTING_BLOCKED: Array<FiscalPeriodDto["status"]> = ["Closing", "Closed", "Locked", "Cancelled"];

export default function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirm, setConfirm] = useState<{ type: "close" | "lock" | "reopen"; period: FiscalPeriodDto } | null>(null);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["fiscal-periods"],
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    invalidateAccountingMutationQueries(qc);
  }, [qc]);

  const create = useMutation({
    mutationFn: () => {
      const window = periodWindowFromDateInput(start, end);
      return fiscalPeriodService.createFiscalPeriod(window);
    },
    onSuccess: () => {
      setStart("");
      setEnd("");
      toast.success("تم إنشاء الفترة المالية");
      invalidate();
    },
    onError: (e) => toast.error("فشل الإنشاء: " + e),
  });

  const act = useMutation({
    mutationFn: ({ type, period }: { type: "close" | "lock" | "reopen"; period: FiscalPeriodDto }) => {
      if (type === "close") {
        return fiscalPeriodService.closeFiscalPeriod({ period_id: period.id, closed_by: "user", finalize: true });
      }
      if (type === "lock") {
        return fiscalPeriodService.lockFiscalPeriod({ period_id: period.id, locked_by: "user" });
      }
      return fiscalPeriodService.reopenFiscalPeriod({ period_id: period.id });
    },
    onSuccess: (_dto, vars) => {
      toast.success(
        vars.type === "close"
          ? "تم إغلاق الفترة — لن تقبل حركات جديدة"
          : vars.type === "lock"
            ? "تم قفل الفترة بشكل نهائي — لا يمكن فتحها بعد الآن"
            : "تم إعادة فتح الفترة",
      );
      invalidate();
    },
    onError: (e) => toast.error("فشلت العملية: " + e),
  });

  // Current period is DERIVED from the date: the Open/Reopened period whose
  // window contains today (fallback: first Open/Reopened period).
  const current = useMemo(() => {
    const now = Date.now();
    const byDate = periods.find(
      (p) =>
        (p.status === "Open" || p.status === "Reopened") &&
        now >= new Date(p.start_date).getTime() &&
        now <= new Date(p.end_date).getTime(),
    );
    return byDate ?? periods.find((p) => p.status === "Open" || p.status === "Reopened");
  }, [periods]);

  const { data: distributable } = useQuery({
    queryKey: ["distributable-profit", current?.start_date, current?.end_date],
    queryFn: () =>
      fiscalPeriodService.getDistributableProfit(current!.start_date, current!.end_date),
    enabled: !!current,
  });

  const show = useCallback(
    (v?: string) =>
      v !== undefined && v !== null
        ? formatAmount(parseFloat(v), { currencyCode: baseCurrency?.code || "" })
        : "—",
    [formatAmount, baseCurrency],
  );

  const canCreate = start && end && new Date(start) < new Date(end);

  const confirmCopy = confirm
    ? {
        close: {
          title: "إغلاق الفترة المالية",
          description: (
            <p>
              ستغلق الفترة من {toDateInput(confirm.period.start_date)} إلى{" "}
              {toDateInput(confirm.period.end_date)}. لن تُقبل أي حركات جديدة بتاريخ ضمنها إلا عبر
              قيد تراجع أو رصيد افتتاحي.
            </p>
          ),
          confirmLabel: "إغلاق",
        },
        lock: {
          title: "قفل الفترة المالية نهائياً",
          description: (
            <p>
              القفل يمنع أي حركة في الفترة بشكل نهائي ولا يمكن فتح الفترة بعد القفل. هذا إجراء لا
              يُرجع إلا عبر mechanism صريح.
            </p>
          ),
          confirmLabel: "قفل نهائي",
        },
        reopen: {
          title: "إعادة فتح الفترة المالية",
          description: (
            <p>
              ستعاد الفترة إلى حالة «مُعاد فتحها» لتسجيل تصحيحات صريحة. لا يمكن فتح فترة مقفلة أو
              ملغاة.
            </p>
          ),
          confirmLabel: "إعادة الفتح",
        },
      }[confirm.type]
    : null;

  return (
    <OperationalTableTemplate
      title="الفترات المالية"
      toolbar={
        <p className="text-xs text-slate-500">
          الفترة المالية بنية أساسية للمحاسبة لكل الشركات: كل قيد مرحَّل يجب أن يقع ضمن فترة مفتوحة،
          والحركة في فترة مغلقة أو مقفلة مرفوضة إلا عبر mechanism صريح (قيد عكسي أو رصيد افتتاحي).
        </p>
      }
      tableContent={
        <div className="p-4 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">إنشاء فترة مالية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="fp-start" required>بداية الفترة</FieldLabel>
                  <Input id="fp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" aria-required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="fp-end" required>نهاية الفترة</FieldLabel>
                  <Input id="fp-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" aria-required />
                </div>
              </div>
              <Button
                onClick={() => create.mutate()}
                disabled={!canCreate || create.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {create.isPending ? "جارٍ الإنشاء..." : "إنشاء الفترة"}
              </Button>
              {start && end && !canCreate && (
                <p className="text-2xs text-red-600">نهاية الفترة يجب أن تكون بعد بدايتها.</p>
              )}
              {create.isError && <p className="text-xs text-red-500">{String(create.error)}</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">الفترة الحالية — الربح القابل للتوزيع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {current ? (
                <div className="space-y-1">
                  <p className="flex items-center gap-2">
                    <StatusBadge status={current.status} />
                    <span className="text-slate-600">
                      {toDateInput(current.start_date)} ← {toDateInput(current.end_date)}
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
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">القائمة</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading && (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              )}
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
                          <td className="px-4 py-2 tabular-nums">{toDateInput(p.start_date)}</td>
                          <td className="px-4 py-2 tabular-nums">{toDateInput(p.end_date)}</td>
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
                                  disabled={act.isPending}
                                  onClick={() => setConfirm({ type: "close", period: p })}
                                >
                                  إغلاق
                                </Button>
                              )}
                              {canReopen && (
                                <Button
                                  variant="outline"
                                  className="h-8 text-xs border-blue-200 text-blue-700 font-bold"
                                  disabled={act.isPending}
                                  onClick={() => setConfirm({ type: "reopen", period: p })}
                                >
                                  <LockOpen className="h-3 w-3" />
                                  إعادة فتح
                                </Button>
                              )}
                              {canLock && (
                                <Button
                                  variant="outline"
                                  className="h-8 text-xs border-slate-200 text-slate-700 font-bold"
                                  disabled={act.isPending}
                                  onClick={() => setConfirm({ type: "lock", period: p })}
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
            </CardContent>
          </Card>
        </div>
      }
      children={
        confirm && confirmCopy ? (
          <ConfirmDialog
            open={!!confirm}
            onOpenChange={(open) => !open && setConfirm(null)}
            title={confirmCopy.title}
            description={confirmCopy.description}
            confirmLabel={confirmCopy.confirmLabel}
            destructive={confirm.type === "lock"}
            onConfirm={() => {
              act.mutate({ type: confirm.type, period: confirm.period });
              setConfirm(null);
            }}
          />
        ) : null
      }
    />
  );
}