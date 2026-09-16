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
import { useLocalization } from "@app/providers/LocalizationProvider";
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
  const { t } = useLocalization();
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
      toast.success(
        t("profitDistribution.toast.distributed", {
          namespace: "accounting",
          vars: { number: res.entry_number },
          })
      );
      await invalidateKeys(qc, PROFIT_DISTRIBUTION_KEYS);
      await refetchDistributable();
      setStep(3);
    },
    onError: (e) => {
      toast.error(
        t("profitDistribution.toast.failed", {
          namespace: "accounting",
          vars: { error: String(e) },
        })
      );
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
            className="h-9 px-4 rounded-lg text-muted-foreground border-muted text-xs font-bold"
          >
            {t("profitDistribution.cancel", { namespace: "accounting",  })}
          </Button>
          <Button
            type="button"
            onClick={() => setStep(2)}
            disabled={overCap || isZero || amount === ""}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold shadow-md shadow-primary/20"
          >
            {t("profitDistribution.review", { namespace: "accounting",  })}
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
            className="h-9 px-4 rounded-lg text-muted-foreground border-muted text-xs font-bold"
          >
            {t("profitDistribution.back", { namespace: "accounting",  })}
          </Button>
          <Button
            type="button"
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending || preview.isLoading || preview.isError}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/80 text-white text-xs font-bold shadow-md shadow-primary/20"
          >
            {confirm.isPending
              ? t("profitDistribution.distributing", { namespace: "accounting",  })
              : t("profitDistribution.confirm", { namespace: "accounting",  })}
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
            className="h-9 px-4 rounded-lg text-muted-foreground border-muted text-xs font-bold"
          >
            {t("profitDistribution.close", { namespace: "accounting",  })}
          </Button>
        </div>
      );
    }

    return null;
  };

  const getSubtitle = () => {
    if (step === 1) return sourceLabel;
    if (step === 2)
      return t("profitDistribution.subtitle.step2", {
        namespace: "accounting",
        });
    return t("profitDistribution.subtitle.step3", {
      namespace: "accounting",
      });
  };

  return (
    <FormPanel
      title={t("profitDistribution.title", { namespace: "accounting",  })}
      subtitle={getSubtitle()}
      icon={<Coins className="w-5 h-5 text-primary" />}
      onClose={onClose}
      footer={renderFooter()}
    >
      <div className="space-y-6 text-end">
        {/* ── Loading ─────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 mb-3 animate-spin" />
            <p className="text-sm font-medium">
              {t("profitDistribution.loading", { namespace: "accounting",  })}
            </p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive/60 mb-3" />
            <p className="text-sm font-semibold text-destructive mb-2">
              {t("profitDistribution.loadError", { namespace: "accounting",  })}
            </p>
            <p className="text-xs text-muted-foreground mb-4">{String(error)}</p>
            <Button size="sm" variant="outline" onClick={refetch} className="border-destructive/20 text-destructive hover:bg-destructive/10">
              <RefreshCw className="w-3 h-3 me-1" />
              {t("profitDistribution.retry", { namespace: "accounting",  })}
            </Button>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────────── */}
        {!isLoading && !isError && (!source || !pool) && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coins className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">
              {t("profitDistribution.empty", { namespace: "accounting",  })}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px] leading-relaxed">
              {t("profitDistribution.emptyHint", {
                namespace: "accounting",
                })}
            </p>
          </div>
        )}

        {/* ── Steps (only when data is ready) ─────────────────────────── */}
        {!isLoading && !isError && source && pool && (
          <>
        {step === 1 && (
          <>
            <SidebarSection title={t("profitDistribution.sectionAvailable", { namespace: "accounting",  })} icon={<Coins className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-100 bg-muted/60 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("profitDistribution.retained", { namespace: "accounting",  })}</p>
                  <p className="text-lg font-black tabular-nums text-foreground">{fmtMoney(retained)}</p>
                </div>
                <div className="rounded-lg border border-success/20 bg-success/10/60 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-success">{t("profitDistribution.available", { namespace: "accounting",  })}</p>
                  <p className="text-lg font-black tabular-nums text-success">{fmtMoney(available)}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-muted/60 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("profitDistribution.allocatedSoFar", { namespace: "accounting",  })}</p>
                  <p className="text-lg font-black tabular-nums text-foreground">{fmtMoney(distributed)}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-indigo-600">{t("profitDistribution.remaining", { namespace: "accounting",  })}</p>
                  <p className="text-lg font-black tabular-nums text-indigo-700">{fmtMoney(available)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-muted bg-muted p-3 text-xs">
                <span className="font-bold text-foreground">
                  {t("profitDistribution.source", { namespace: "accounting", vars: { label: sourceLabel },  })}
                </span>
              </div>
            </SidebarSection>

            <SidebarSection title={t("profitDistribution.sectionAmount", { namespace: "accounting",  })} icon={<Calculator className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="distribution-amount">
                    {t("profitDistribution.amountField", { namespace: "accounting",  })}
                  </FieldLabel>
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
                      {t("profitDistribution.distributeAll", { namespace: "accounting",  })}
                    </Button>
                  </div>
                </div>

                {overCap && (
                  <Alert variant="destructive" className="p-3 bg-destructive/10 border-destructive/20 text-destructive rounded-lg">
                    <AlertDescription className="text-xs font-semibold leading-relaxed">
                      {t("profitDistribution.overCap", {
                        namespace: "accounting",
                        vars: { amount: fmtMoney(amountNum), excess: fmtMoney(amountNum - available) },
                        })}
                    </AlertDescription>
                  </Alert>
                )}

                {isZero && amount !== "" && (
                  <p className="text-xs text-muted-foreground font-medium">
                    {t("profitDistribution.zeroAmount", {
                      namespace: "accounting",
                      })}
                  </p>
                )}
              </div>
            </SidebarSection>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/10/50 p-4 flex flex-col items-center justify-center space-y-1 text-center">
              <span className="text-xs font-semibold text-primary">
                {t("profitDistribution.previewAmount", { namespace: "accounting",  })}
              </span>
              <span className="text-2xl font-black text-primary tabular-nums">{fmtMoney(amountNum)}</span>
            </div>

            {preview.isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <RefreshCw className="w-6 h-6 mb-3 animate-spin" />
                <p className="text-sm font-medium">
                  {t("profitDistribution.previewLoading", { namespace: "accounting",  })}
                </p>
              </div>
            )}

            {preview.isError && (
              <Alert variant="destructive" className="p-3 bg-destructive/10 border-destructive/20 text-destructive rounded-lg">
                <AlertDescription className="text-xs font-semibold leading-relaxed">
                  {t("profitDistribution.previewFailed", {
                    namespace: "accounting",
                    vars: { error: String(preview.error) },
                    })}
                </AlertDescription>
              </Alert>
            )}

            {preview.data && (
              <div className="space-y-4">
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-end text-xs font-bold text-muted-foreground py-3">{t("profitDistribution.colPartner", { namespace: "accounting",  })}</TableHead>
                        <TableHead className="text-center text-xs font-bold text-muted-foreground py-3">{t("profitDistribution.colRatio", { namespace: "accounting",  })}</TableHead>
                        <TableHead className="text-start text-xs font-bold text-muted-foreground py-3">{t("profitDistribution.colShare", { namespace: "accounting",  })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.data.shares.map((s) => (
                        <TableRow key={s.partner_id} className="hover:bg-muted/30">
                          <TableCell className="text-end py-3 text-xs font-semibold text-foreground">
                            {s.partner_name}
                          </TableCell>
                          <TableCell className="text-center py-3 text-xs text-muted-foreground font-medium">
                            {fmtMoney(parseSafeNumber(s.ratio_percent))}%
                          </TableCell>
                          <TableCell className="text-start py-3 text-xs font-bold text-foreground tabular-nums">
                            {fmtMoney(parseSafeNumber(s.share))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-muted/30 font-bold border-t border-slate-100">
                      <TableRow>
                        <TableCell className="text-end py-3 text-xs text-slate-600">{t("profitDistribution.totalAllocated", { namespace: "accounting",  })}</TableCell>
                        <TableCell className="text-center py-3 text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-start py-3 text-xs text-primary font-extrabold tabular-nums">
                          {fmtMoney(parseSafeNumber(preview.data.allocated_total))}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-end py-3 text-xs text-slate-600">{t("profitDistribution.remainingAmount", { namespace: "accounting",  })}</TableCell>
                        <TableCell className="text-center py-3 text-xs text-muted-foreground">-</TableCell>
                        <TableCell className="text-start py-3 text-xs text-success font-extrabold tabular-nums">
                          {fmtMoney(available - parseSafeNumber(preview.data.allocated_total))}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

                <div className="rounded-lg border border-slate-100 bg-muted/50 p-3 text-xs text-muted-foreground">
                  {t("profitDistribution.footnote", {
                    namespace: "accounting",
                    })}
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
              <h3 className="text-base font-extrabold text-green-700">
                {t("profitDistribution.successTitle", { namespace: "accounting",  })}
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                {t("profitDistribution.successDescription", {
                  namespace: "accounting",
                  })}{" "}
                <span className="font-extrabold text-foreground">{postedResult?.entry_number}</span>.
              </p>
            </div>

            <div className="border border-slate-100 rounded-xl bg-muted/30 overflow-hidden divide-y divide-slate-100">
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">{t("profitDistribution.allocatedAmount", { namespace: "accounting",  })}</span>
                <span className="font-black text-foreground tabular-nums">
                  {fmtMoney(parseSafeNumber(postedResult?.allocated_total ?? "0"))}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">{t("profitDistribution.partnerCount", { namespace: "accounting",  })}</span>
                <span className="font-black text-foreground tabular-nums">
                  {postedResult?.shares.length ?? 0}
                </span>
              </div>
              <div className="p-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">{t("profitDistribution.remainingSuccess", { namespace: "accounting",  })}</span>
                <span className="font-black text-success tabular-nums">
                  {fmtMoney(available - parseSafeNumber(postedResult?.allocated_total ?? "0"))}
                </span>
              </div>
            </div>

            {postedResult && postedResult.shares.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-end text-xs font-bold text-muted-foreground py-3">{t("profitDistribution.colPartner", { namespace: "accounting",  })}</TableHead>
                      <TableHead className="text-start text-xs font-bold text-muted-foreground py-3">{t("profitDistribution.shareCol", { namespace: "accounting",  })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postedResult.shares.map((s) => (
                      <TableRow key={s.partner_id} className="hover:bg-muted/30">
                        <TableCell className="text-end py-3 text-xs font-semibold text-foreground">
                          {s.partner_name}
                        </TableCell>
                        <TableCell className="text-start py-3 text-xs font-bold text-foreground tabular-nums">
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