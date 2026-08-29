import { AlertTriangle, Coins, RefreshCw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { ProfitDistributionWorkflow } from "./ProfitDistributionWorkflow";
import { useDistributionSource } from "../hooks/useDistributionSource";
import { useDistributionPool } from "../hooks/useDistributionPool";
import type { ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";

interface ProfitDistributionSidePanelProps {
  onClose: () => void;
  source?: ProfitDistributionSource | null;
  sourceLabel?: string;
  windowStart?: string;
  windowEnd?: string;
}

export function ProfitDistributionSidePanel({
  onClose,
  source: externalSource,
  sourceLabel: externalLabel,
  windowStart: externalStart,
  windowEnd: externalEnd,
}: ProfitDistributionSidePanelProps) {
  const { source: autoSource, sourceLabel: autoLabel, windowStart: autoStart, windowEnd: autoEnd, isLoading: sourceLoading } = useDistributionSource();

  const source = externalSource ?? autoSource;
  const sourceLabel = externalLabel ?? autoLabel;
  const windowStart = externalStart ?? autoStart;
  const windowEnd = externalEnd ?? autoEnd;

  const { pool, isLoading: poolLoading, isError, error, refetch } = useDistributionPool(source, windowStart, windowEnd);

  return (
    <FormPanel
      title="توزيع الأرباح"
      subtitle={sourceLabel}
      icon={<Coins className="w-4 h-4" />}
      onClose={onClose}
      width="lg"
      forceOverlay
      footer={
        <Button
          variant="outline"
          onClick={onClose}
          className="h-9 px-4 rounded-lg text-slate-600 border-slate-200 text-xs font-bold"
        >
          إغلاق
        </Button>
      }
    >
      {sourceLoading || poolLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-6 h-6 mb-3 animate-spin" />
          <p className="text-sm">جارٍ تحميل البيانات...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
          <p className="text-sm font-semibold text-red-600 mb-2">تعذر تحميل بيانات الأرباح القابلة للتوزيع.</p>
          <p className="text-xs text-slate-500 mb-4">{String(error)}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="border-red-200 text-red-700 hover:bg-red-50">
            <RefreshCw className="w-3 h-3 me-1" />
            إعادة المحاولة
          </Button>
        </div>
      ) : !source ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">
            لا توجد أرباح قابلة للتوزيع حالياً. تأكد من ترحيل الرصيد الافتتاحي أو إغلاق فترة مالية.
          </p>
        </div>
      ) : pool ? (
        <ProfitDistributionWorkflow
          source={source}
          windowStart={windowStart}
          windowEnd={windowEnd}
          sourceLabel={sourceLabel}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-slate-500">
            لا توجد أرباح قابلة للتوزيع حالياً.
          </p>
        </div>
      )}
    </FormPanel>
  );
}
