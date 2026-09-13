import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FISCAL_MUTATION_KEYS, invalidateKeys, QUERY_KEYS } from "@shared/hooks/queryClient";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toLocalDateStr } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { fiscalPeriodService, periodWindowFromDateInput } from "@modules/accounting/api/fiscalPeriodService";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import type { FiscalPeriodDto } from "@erp/shared-types";
import { CreatePeriodCard } from "../components/CreatePeriodCard";
import { CurrentPeriodCard } from "../components/CurrentPeriodCard";
import { PeriodsTable, type PeriodActionType } from "../components/PeriodsTable";

interface ConfirmState {
  type: PeriodActionType;
  period: FiscalPeriodDto;
}

export default function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
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
      toast.success(t("fiscalPeriods.toast.created", { namespace: "accounting",  }));
      invalidate();
    },
    onError: (e) => toast.error(t("fiscalPeriods.toast.createFailed", { namespace: "accounting", vars: { error: e instanceof Error ? e.message : String(e) } })),
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
          ? t("fiscalPeriods.toast.closed", { namespace: "accounting",  })
          : vars.type === "lock"
            ? t("fiscalPeriods.toast.locked", { namespace: "accounting",  })
            : t("fiscalPeriods.toast.reopened", { namespace: "accounting",  }),
      );
      invalidate();
    },
    onError: (e) => toast.error(t("fiscalPeriods.toast.operationFailed", { namespace: "accounting", vars: { error: e instanceof Error ? e.message : String(e) } })),
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
        const keyPath = `fiscalPeriods.confirm.${confirm.type}` as const;
        return {
          title: t(`${keyPath}.title`, { namespace: "accounting"}),
          description: t(`${keyPath}.description`, { namespace: "accounting", vars: { start: toLocalDateStr(confirm.period.start_date), end: toLocalDateStr(confirm.period.end_date) }}),
          confirmLabel: t(`${keyPath}.confirm`, { namespace: "accounting"}),
        };
      })()
    : null;

  return (
    <ErrorBoundary>
    <OperationalTableTemplate
      title={t("fiscalPeriods.title", { namespace: "accounting",  })}
      toolbar={
        <p className="text-xs text-slate-500">
          {t("fiscalPeriods.description", { namespace: "accounting",  })}
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
    </ErrorBoundary>
  );
}
