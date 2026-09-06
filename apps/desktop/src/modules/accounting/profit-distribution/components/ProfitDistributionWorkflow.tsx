import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Calculator, CheckCircle2, Coins, RefreshCw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { Alert, AlertDescription } from "@shared/ui/alert";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableFooter,
} from "@shared/ui/table";
import { fmtMoney } from "@shared/lib/format";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { PROFIT_DISTRIBUTION_KEYS, invalidateKeys, QUERY_KEYS } from "@shared/hooks/queryClient";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import {
  openingBalanceService,
  type NetProfitAllocationDto,
  type ProfitDistributionSource,
} from "@modules/accounting/api/openingBalanceService";

interface ProfitDistributionWorkflowProps {
  source: ProfitDistributionSource | null | undefined;
  windowStart: string;
  windowEnd: string;
  sourceLabel: string;
  onClose: () => void;
  /** Passed from SidePanel — avoids double-fetching */
  pool: unknown;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
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
  onClose,
  pool,
  isLoading,
  isError,
  error,
  refetch,
}: ProfitDistributionWorkflowProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
    enabled: step === 2 && !!amount && amountNum > 0 && !overCap && !!source,
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
      await invalidateKeys(qc, PROFIT_DISTRIBUTION_KEYS);
      await refetchDistributable();
      setStep(3);
    },
    onError: (e) => {
      toast.error("فشل توزيع الأرباح: " + e);
    },
  });

  const renderFooter = () => {
    if (step === 1) {
      return (
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-slate-600 border-slate-200 text-xs font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={() => setStep(2)}
            disabled={overCap || isZero || amount === ""}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-100"
          >
            مراجعة
          </Button>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(1)}
            disabled={confirm.isPending}
            className="h-9 px-4 rounded-lg text-slate-600 border-slate-200 text-xs font-bold"
          >
            رجوع
          </Button>
          <Button
            type="button"
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending || preview.isLoading || preview.isError}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-100"
          >
            {confirm.isPending ? "جارٍ التوزيع..." : "تأكيد التوزيع"}
          </Button>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-slate-600 border-slate-200 text-xs font-bold"
          >
            إغلاق
          </Button>
        </div>
      );
    }

    return null;
  };

  const getSubtitle = () => {
    if (step === 1) return sourceLabel;
    if (step === 2) return "مراجعة ومعاينة التوزيع على الشركاء";
    return "تم التوزيع بنجاح";
  };

  return (
    <FormPanel
      title="توزيع الأرباح"
      subtitle={getSubtitle()}
      icon={<Coins className="w-5 h-5 text-blue-600" />}
      onClose={onClose}
      footer={renderFooter()}
    >
      <div className="space-y-6 text-end">
        {/* ── Loading ─────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 mb-3 animate-spin" />
            <p className="text-sm font-medium">جارٍ تحميل بيانات الأرباح...</p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-sm font-semibold text-red-600 mb-2">تعذر تحميل بيانات الأرباح.</p>
            <p className="text-xs text-slate-500 mb-4">{String(error)}</p>
            <Button size="sm" variant="outline" onClick={refetch} className="border-red-200 text-red-700 hover:bg-red-50">
              <RefreshCw className="w-3 h-3 me-1" />
              إعادة المحاولة
            </Button>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────────── */}
        {!isLoading && !isError && (!source || !pool) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coins className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">لا توجد أرباح قابلة للتوزيع حالياً.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
              تأكد من ترحيل الرصيد الافتتاحي أو إغلاق فترة مالية.
            </p>
          </div>
        )}

        {/* ── Steps (only when data is ready) ─────────────────────────── */}
        {!isLoading && !isError && source && pool && (
          <>
        {step === 1 && (
          <>
            <SidebarSection title="بيانات الأرباح المتاحة" icon={<Coins className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <span className="font-bold text-slate-700">المصدر: {sourceLabel}</span>
              </div>
            </SidebarSection>

            <SidebarSection title="مبلغ التوزيع" icon={<Calculator className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="distribution-amount">المبلغ المطلوب توزيعه</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="distribution-amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      type="number"
                      min={0}
                      max={available || undefined}
                      className="h-9 text-end tabular-nums bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAmount(String(available))}
                      disabled={available <= 0}
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold shrink-0 h-9"
                    >
                      توزيع كامل المتبقي
                    </Button>
                  </div>
                </div>

                {overCap && (
                  <Alert variant="destructive" className="p-3 bg-red-50 border-red-200 text-red-700 rounded-lg">
                    <AlertDescription className="text-xs font-semibold leading-relaxed">
                      المبلغ المطلوب توزيعه ({fmtMoney(amountNum)}) يتجاوز الأرباح المتاحة للتوزيع بمقدار{" "}
                      {fmtMoney(amountNum - available)} — لا يُسمح بتوزيع أكثر من المتاح.
                    </AlertDescription>
                  </Alert>
                )}

                {isZero && amount !== "" && (
                  <p className="text-xs text-slate-500 font-medium">مبلغ صفر لا يُنشئ قيداً ولا يسجَّل توزيعاً.</p>
                )}
              </div>
            </SidebarSection>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col items-center justify-center space-y-1 text-center">
              <span className="text-xs font-semibold text-blue-600">المبلغ المراد توزيعه</span>
              <span className="text-2xl font-black text-blue-800 tabular-nums">{fmtMoney(amountNum)}</span>
            </div>

            {preview.isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <RefreshCw className="w-6 h-6 mb-3 animate-spin" />
                <p className="text-sm font-medium">جارٍ احتساب المعاينة...</p>
              </div>
            )}

            {preview.isError && (
              <Alert variant="destructive" className="p-3 bg-red-50 border-red-200 text-red-700 rounded-lg">
                <AlertDescription className="text-xs font-semibold leading-relaxed">
                  فشل احتساب المعاينة: {String(preview.error)}
                </AlertDescription>
              </Alert>
            )}

            {preview.data && (
              <div className="space-y-4">
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="text-end text-xs font-bold text-slate-500 py-3">الشريك</TableHead>
                        <TableHead className="text-center text-xs font-bold text-slate-500 py-3">النسبة</TableHead>
                        <TableHead className="text-start text-xs font-bold text-slate-500 py-3">الحصة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.data.shares.map((s) => (
                        <TableRow key={s.partner_id} className="hover:bg-slate-50/30">
                          <TableCell className="text-end py-3 text-xs font-semibold text-slate-700">
                            {s.partner_name}
                          </TableCell>
                          <TableCell className="text-center py-3 text-xs text-slate-400 font-medium">
                            {fmtMoney(parseSafeNumber(s.ratio_percent))}%
                          </TableCell>
                          <TableCell className="text-start py-3 text-xs font-bold text-slate-800 tabular-nums">
                            {fmtMoney(parseSafeNumber(s.share))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-slate-50/30 font-bold border-t border-slate-100">
                      <TableRow>
                        <TableCell className="text-end py-3 text-xs text-slate-600">المجموع الموزع</TableCell>
                        <TableCell className="text-center py-3 text-xs text-slate-400">-</TableCell>
                        <TableCell className="text-start py-3 text-xs text-blue-700 font-extrabold tabular-nums">
                          {fmtMoney(parseSafeNumber(preview.data.allocated_total))}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-end py-3 text-xs text-slate-600">المبلغ المتبقي</TableCell>
                        <TableCell className="text-center py-3 text-xs text-slate-400">-</TableCell>
                        <TableCell className="text-start py-3 text-xs text-emerald-700 font-extrabold tabular-nums">
                          {fmtMoney(available - parseSafeNumber(preview.data.allocated_total))}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-500">
                  * يتم احتساب وتوزيع المبالغ بناءً على نسب رأس المال المعتمدة لكل شريك في النظام.
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <div className="p-3 bg-green-50 text-green-600 rounded-full border border-green-200 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-base font-extrabold text-green-700">تم توزيع الأرباح بنجاح</h3>
              <p className="text-xs text-slate-500 max-w-[280px] leading-relaxed">
                تم ترحيل قيد التوزيع بنجاح تحت رقم القيد{" "}
                <span className="font-extrabold text-slate-800">{postedResult?.entry_number}</span>.
              </p>
            </div>

            <div className="border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden divide-y divide-slate-100">
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">المبلغ الموزع</span>
                <span className="font-black text-slate-800 tabular-nums">
                  {fmtMoney(parseSafeNumber(postedResult?.allocated_total ?? "0"))}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">عدد الشركاء الموزع لهم</span>
                <span className="font-black text-slate-800 tabular-nums">
                  {postedResult?.shares.length ?? 0}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">المبلغ المتبقي</span>
                <span className="font-black text-emerald-700 tabular-nums">
                  {fmtMoney(available - parseSafeNumber(postedResult?.allocated_total ?? "0"))}
                </span>
              </div>
            </div>

            {postedResult && postedResult.shares.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-end text-xs font-bold text-slate-500 py-3">الشريك</TableHead>
                      <TableHead className="text-start text-xs font-bold text-slate-500 py-3">الحصة الموزعة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postedResult.shares.map((s) => (
                      <TableRow key={s.partner_id} className="hover:bg-slate-50/30">
                        <TableCell className="text-end py-3 text-xs font-semibold text-slate-700">
                          {s.partner_name}
                        </TableCell>
                        <TableCell className="text-start py-3 text-xs font-bold text-slate-800 tabular-nums">
                          {fmtMoney(parseSafeNumber(s.share))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </FormPanel>
  );
}