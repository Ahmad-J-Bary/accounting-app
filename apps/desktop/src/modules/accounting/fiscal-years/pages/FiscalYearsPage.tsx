import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QUERY_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toLocalDateStr } from "@shared/lib/format";
import { fiscalYearService } from "@modules/accounting/api/fiscalYearService";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import type { FiscalYearDto } from "@erp/shared-types";
import { CreateFiscalYearCard } from "../components/CreateFiscalYearCard";
import { FiscalYearsTable, type FiscalYearActionType } from "../components/FiscalYearsTable";

const FISCAL_YEAR_QUERY_KEYS = {
  fiscalYears: ["fiscal-years"] as const,
};

const FISCAL_YEAR_MUTATION_KEYS: readonly (readonly unknown[])[] = [
  ["fiscal-years"],
  QUERY_KEYS.fiscalPeriods,
];

interface ConfirmState {
  type: FiscalYearActionType;
  year: FiscalYearDto;
}

const CONFIRM_COPY: Record<FiscalYearActionType, { title: string; description: string; confirmLabel: string; destructive: boolean }> = {
  close: {
    title: "إغلاق السنة المالية",
    description:
      "ستُغلق السنة المالية «{label}» من {start} إلى {end}. يجب أن تكون جميع الفترات مغلقة أو مقفلة. لن تُقبل أي حركات جديدة في هذه السنة.",
    confirmLabel: "إغلاق",
    destructive: false,
  },
  reopen: {
    title: "إعادة فتح السنة المالية",
    description:
      "ستعاد السنة المالية «{label}» إلى حالة «مُعاد فتحها». يمكن تسجيل تصحيحات صريحة بعد إعادة الفتح.",
    confirmLabel: "إعادة الفتح",
    destructive: false,
  },
};

function periodWindowFromDateInput(start: string, end: string): { start_date: string; end_date: string } {
  return {
    start_date: new Date(`${start}T00:00:00Z`).toISOString(),
    end_date: new Date(`${end}T23:59:59Z`).toISOString(),
  };
}

export default function FiscalYearsPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const { data: years = [], isLoading } = useQuery({
    queryKey: FISCAL_YEAR_QUERY_KEYS.fiscalYears,
    queryFn: () => fiscalYearService.listFiscalYears(),
  });

  const invalidate = useCallback(() => {
    void invalidateKeys(qc, FISCAL_YEAR_MUTATION_KEYS);
  }, [qc]);

  const create = useMutation({
    mutationFn: () => {
      const window = periodWindowFromDateInput(start, end);
      return fiscalYearService.createFiscalYear({
        label,
        start_date: window.start_date,
        end_date: window.end_date,
      });
    },
    onSuccess: () => {
      setLabel("");
      setStart("");
      setEnd("");
      toast.success("تم إنشاء السنة المالية");
      invalidate();
    },
    onError: (e) => toast.error("فشل الإنشاء: " + e),
  });

  const act = useMutation({
    mutationFn: ({ type, year }: ConfirmState) => {
      if (type === "close") {
        return fiscalYearService.closeFiscalYear({
          fiscal_year_id: year.id,
          closing_period_id: year.closing_period_id ?? "",
          operation_key: `close-${year.id}-${Date.now()}`,
          finalize: true,
          context: { actor_id: "user" },
        });
      }
      return fiscalYearService.reopenFiscalYear({
        fiscal_year_id: year.id,
        context: { actor_id: "user" },
      });
    },
    onSuccess: (_dto, vars) => {
      toast.success(
        vars.type === "close"
          ? "تم إغلاق السنة المالية"
          : "تم إعادة فتح السنة المالية",
      );
      invalidate();
    },
    onError: (e) => toast.error("فشلت العملية: " + e),
  });

  const canCreate = label.trim().length > 0 && start && end && new Date(start) < new Date(end);

  const confirmCopy = confirm
    ? (() => {
        const copy = CONFIRM_COPY[confirm.type];
        return {
          ...copy,
          description: copy.description
            .replace("{label}", confirm.year.label)
            .replace("{start}", toLocalDateStr(confirm.year.start_date))
            .replace("{end}", toLocalDateStr(confirm.year.end_date)),
        };
      })()
    : null;

  return (
    <ErrorBoundary>
    <OperationalTableTemplate
      title="السنوات المالية"
      toolbar={
        <p className="text-xs text-slate-500">
          السنة المالية هي الفترة الزمنية الأساسية للتقارير المالية. تجمع الفترات المالية وتحكّم في دورة الإغلاق والترحيل.
        </p>
      }
      tableContent={
        <div className="p-4 space-y-4">
          <CreateFiscalYearCard
            label={label}
            start={start}
            end={end}
            onLabelChange={setLabel}
            onStartChange={setStart}
            onEndChange={setEnd}
            canCreate={!!canCreate}
            isPending={create.isPending}
            error={create.isError ? create.error : null}
            onCreate={() => create.mutate()}
          />
          <FiscalYearsTable
            years={years}
            isLoading={isLoading}
            actionBusy={act.isPending}
            onAction={(type, year) => setConfirm({ type, year })}
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
            destructive={confirmCopy.destructive}
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
