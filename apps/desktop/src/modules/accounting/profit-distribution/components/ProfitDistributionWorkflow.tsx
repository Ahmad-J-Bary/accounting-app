import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, CheckCircle2, Coins } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { SectionCard } from "@shared/ui/section-card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { fmtMoney } from "@shared/lib/format";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { invalidateAccountingMutationQueries, QUERY_KEYS } from "@shared/hooks/queryClient";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import {
  openingBalanceService,
  type NetProfitAllocationDto,
  type ProfitDistributionSource,
} from "@modules/accounting/api/openingBalanceService";

interface ProfitDistributionWorkflowProps {
  source: ProfitDistributionSource;
  windowStart: string;
  windowEnd: string;
  sourceLabel: string;
  sourceDescription?: string;
}

/**
 * The ONE profit-distribution workflow (§ distribution phase). It projects the
 * availability figures over the given window, lets the user pick an amount
 * (capped at the available pool), previews the partner split through the same
 * read-only engine that posts it, and confirms with a client-supplied
 * idempotency key so re-submitting the same intent never double-posts.
 */
export function ProfitDistributionWorkflow({
  source,
  windowStart,
  windowEnd,
  sourceLabel,
  sourceDescription,
}: ProfitDistributionWorkflowProps) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [postedResult, setPostedResult] = useState<NetProfitAllocationDto | null>(null);

  // A NEW amount/source is a NEW distribution intent — regenerate the
  // idempotency key so only a retry of the SAME intent resolves the same
  // journal (the backend dedupes on the key).
  useEffect(() => {
    setIdemKey(crypto.randomUUID());
    setPostedResult(null);
  }, [source, amount]);

  const { data: distributable, refetch: refetchDistributable } = useQuery({
    queryKey: QUERY_KEYS.distributableProfit(windowStart, windowEnd),
    queryFn: () => fiscalPeriodService.getDistributableProfit(windowStart, windowEnd),
    enabled: !!windowStart && !!windowEnd,
  });

  const retained = parseSafeNumber(distributable?.retained_earnings_balance ?? "0");
  const available = parseSafeNumber(distributable?.distributable ?? "0");
  const distributed = parseSafeNumber(distributable?.allocated_to_date ?? "0");

  const amountNum = parseSafeNumber(amount);
  const overCap = amountNum > available;
  const isZero = amountNum <= 0;

  const preview = useQuery({
    queryKey: ["profit-distribution", "preview", source, amount],
    queryFn: () =>
      openingBalanceService.previewProfitDistribution({ source, net_profit: amount }),
    enabled: !!amount && amountNum > 0 && !overCap,
  });

  const confirm = useMutation({
    mutationFn: () =>
      openingBalanceService.allocateNetProfit({
        source,
        net_profit: amount,
        idempotency_key: idemKey,
      }),
    onSuccess: async (res) => {
      setPostedResult(res);
      toast.success(`تم توزيع الأرباح على الشركاء — ${res.entry_number}`);
      await invalidateAccountingMutationQueries(qc);
      await refetchDistributable();
    },
    onError: (e) => {
      toast.error("فشل توزيع الأرباح: " + e);
    },
  });

  return (
    <SectionCard
      title="توزيع الأرباح"
      icon={<Coins className="w-4 h-4 text-blue-600" />}
      description={
        sourceDescription ??
        "وزّع الأرباح على حسابات الشركاء الجارية وفق نسب التقاسم المسجّلة — يُقيّد على حساب الأرباح المبقاة (52) دون المساس برأس المال."
      }
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <span className="font-bold text-slate-700">المصدر: {sourceLabel}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">الأرباح المبقاة</p>
          <p className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(retained)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-emerald-600">المتاح للتوزيع</p>
          <p className="text-lg font-black tabular-nums text-emerald-700">{fmtMoney(available)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">المُوزَّع سابقاً</p>
          <p className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(distributed)}</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-indigo-600">المتبقي للتوزيع</p>
          <p className="text-lg font-black tabular-nums text-indigo-700">{fmtMoney(available)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[280px_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="distribution-amount">مبلغ التوزيع</FieldLabel>
          <Input
            id="distribution-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            type="number"
            min={0}
            max={available || undefined}
            className="h-9 text-right tabular-nums"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAmount(String(available))}
            disabled={available <= 0}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold"
          >
            توزيع كامل المتبقي
          </Button>
          <Button
            size="sm"
            onClick={() => confirm.mutate()}
            disabled={overCap || isZero || confirm.isPending || available <= 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {confirm.isPending ? "جارٍ التوزيع..." : "تأكيد التوزيع"}
          </Button>
        </div>
      </div>

      {overCap && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          المبلغ المطلوب توزيعه ({fmtMoney(amountNum)}) يتجاوز الأرباح المتاحة للتوزيع بمقدار{" "}
          {fmtMoney(amountNum - available)} — لا يُسمح بتوزيع أكثر من المتاح.
        </p>
      )}
      {isZero && amount !== "" && (
        <p className="text-xs text-slate-500">مبلغ صفر لا يُنشئ قيداً ولا يسجَّل توزيعاً.</p>
      )}

      {preview.isLoading && <p className="text-xs text-slate-400">جارٍ احتساب المعاينة...</p>}
      {preview.data && (
        <div className="border border-indigo-200 bg-indigo-50/60 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-indigo-700">
            معاينة التوزيع (لم يُرحَّل بعد) — الموزع: {fmtMoney(preview.data.allocated_total)}
          </div>
          <div className="divide-y divide-indigo-100">
            {preview.data.shares.map((s) => (
              <div key={s.partner_id} className="flex items-center justify-between py-1 text-xs text-slate-700">
                <span className="font-semibold">{s.partner_name}</span>
                <span className="text-slate-400">رأس المال {fmtMoney(s.capital)} · نسبة {fmtMoney(s.ratio_percent)}%</span>
                <span className="font-bold tabular-nums">{fmtMoney(s.share)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {postedResult && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            تم الترحيل — قيد رقم {postedResult.entry_number}
          </div>
          <div className="divide-y divide-green-100">
            {postedResult.shares.map((s) => (
              <div key={s.partner_id} className="flex items-center justify-between py-1 text-xs text-slate-700">
                <span className="font-semibold">{s.partner_name}</span>
                <span className="text-slate-400">النسبة {fmtMoney(s.ratio_percent)}%</span>
                <span className="font-bold tabular-nums">{fmtMoney(s.share)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Calculator className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">
              أُعيد احتساب المتاح — إن بقي مبلغ فيمكن توزيعه عبر توزيع جزئي جديد.
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  );
}