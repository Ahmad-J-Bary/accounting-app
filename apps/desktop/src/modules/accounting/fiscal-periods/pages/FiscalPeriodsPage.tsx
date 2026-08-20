import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FISCAL_MUTATION_KEYS, invalidateKeys, QUERY_KEYS } from "@shared/hooks/queryClient";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toLocalDateStr } from "@shared/lib/format";
import { fiscalPeriodService, periodWindowFromDateInput } from "@modules/accounting/api/fiscalPeriodService";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import type { FiscalPeriodDto } from "@erp/shared-types";
import { CreatePeriodCard } from "../components/CreatePeriodCard";
import { CurrentPeriodCard } from "../components/CurrentPeriodCard";
import { PeriodsTable, type PeriodActionType } from "../components/PeriodsTable";

interface ConfirmState {
  type: PeriodActionType;
  period: FiscalPeriodDto;
}

const CONFIRM_COPY: Record<PeriodActionType, { title: string; description: string; confirmLabel: string }> = {
  close: {
    title: "إغلاق الفترة المالية",
    description:
      "ستغلق الفترة من {start} إلى {end}. لن تُقبل أي حركات جديدة بتاريخ ضمنها إلا عبر قيد تراجع أو رصيد افتتاحي.",
    confirmLabel: "إغلاق",
  },
  lock: {
    title: "قفل الفترة المالية نهائياً",
    description:
      "القفل يمنع أي حركة في الفترة بشكل نهائي ولا يمكن فتح الفترة بعد القفل. هذا إجراء لا يُرجع إلا عبر mechanism صريح.",
    confirmLabel: "قفل نهائي",
  },
  reopen: {
    title: "إعادة فتح الفترة المالية",
    description:
      "ستعاد الفترة إلى حالة «مُعاد فتحها» لتسجيل تصحيحات صريحة. لا يمكن فتح فترة مقفلة أو ملغاة.",
    confirmLabel: "إعادة الفتح",
  },
};

export default function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.fiscalPeriods,
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  const invalidate = useCallback(() => {
    void invalidateKeys(qc, FISCAL_MUTATION_KEYS);
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
    mutationFn: ({ type, period }: ConfirmState) => {
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
    queryKey: QUERY_KEYS.distributableProfit(current?.start_date, current?.end_date),
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
    ? (() => {
        const copy = CONFIRM_COPY[confirm.type];
        return {
          ...copy,
          description: copy.description
            .replace("{start}", toLocalDateStr(confirm.period.start_date))
            .replace("{end}", toLocalDateStr(confirm.period.end_date)),
        };
      })()
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
          <CreatePeriodCard
            start={start}
            end={end}
            onStartChange={setStart}
            onEndChange={setEnd}
            canCreate={canCreate}
            isPending={create.isPending}
            error={create.isError ? create.error : null}
            onCreate={() => create.mutate()}
          />
          <CurrentPeriodCard current={current} distributable={distributable} show={show} />
          <PeriodsTable
            periods={periods}
            current={current}
            isLoading={isLoading}
            actionBusy={act.isPending}
            onAction={(type, period) => setConfirm({ type, period })}
          />
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
              act.mutate(confirm);
              setConfirm(null);
            }}
          />
        ) : null
      }
    />
  );
}
