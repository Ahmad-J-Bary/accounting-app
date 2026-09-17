import { useMemo } from "react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { type Currency } from "@modules/core/api/currencyService";
import { resolveCurrencySymbol } from "@modules/invoicing/lib/constants";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface ReturnSettlementPanelProps {
  totalAmount: number;
  partnerBalance: number;
  isSales: boolean;
  settlementMode: "deduct_from_debt" | "full_cash_return" | "partial_settlement";
  onSettlementModeChange: (mode: "deduct_from_debt" | "full_cash_return" | "partial_settlement") => void;
  settlementCash: string;
  onSettlementCashChange: (cash: string) => void;
  isPaid: boolean;
  onIsPaidChange: (paid: boolean) => void;
  currencies?: Currency[];
  selectedCurrency?: string;
  onCurrencyChange?: (code: string) => void;
}

export function ReturnSettlementPanel({
  totalAmount,
  partnerBalance,
  isSales,
  settlementMode,
  onSettlementModeChange,
  settlementCash,
  onSettlementCashChange,
  isPaid,
  onIsPaidChange,
  currencies: currenciesProp,
  selectedCurrency,
  onCurrencyChange,
}: ReturnSettlementPanelProps) {
  const { currencies: contextCurrencies, baseCurrency, hasMultipleCurrencies } = useCurrencyContext();
  const { t, language, direction } = useLocalization();
  const availableCurrencies = currenciesProp ?? contextCurrencies;
  const safeCurrency = selectedCurrency || baseCurrency?.code || (availableCurrencies[0]?.code ?? "");
  const minCash = useMemo(() => {
    if (totalAmount > partnerBalance) return totalAmount - partnerBalance;
    return 0;
  }, [totalAmount, partnerBalance]);

  const partnerLabel = isSales
    ? t("labels.customer", { namespace: "common" })
    : t("labels.supplier", { namespace: "common" });
  const paymentLabel = isSales
    ? t("labels.salesPaymentVoucher", { namespace: "common" })
    : t("labels.purchaseReceiptVoucher", { namespace: "common" });

  const hasDebt = partnerBalance > 0 && totalAmount > 0;
  const cashAmount = useMemo(() => {
    if (settlementMode === "full_cash_return") return totalAmount;
    if (settlementMode === "partial_settlement") return Math.min(Math.max(parseFloat(settlementCash || "0"), minCash), totalAmount);
    if (totalAmount > partnerBalance) return totalAmount - partnerBalance;
    return 0;
  }, [settlementMode, totalAmount, partnerBalance, settlementCash, minCash]);

  const hasCash = cashAmount > 0;

  // When balance is 0, only full cash return is feasible
  const effectiveMode = partnerBalance <= 0 ? "full_cash_return" : settlementMode;

  const showDeductFromDebt = partnerBalance > 0 && totalAmount > 0;
  const showPartialSettlement = partnerBalance > 0;
  const showFullCashReturn = true;

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4 select-none" dir={direction}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {hasMultipleCurrencies ? (
            <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 bg-muted rounded-md border border-border">
              <span className="text-2xs font-bold text-muted-foreground">{t("labels.currency", { namespace: "common" })}</span>
              {onCurrencyChange && availableCurrencies.length > 0 ? (
                <select
                  value={safeCurrency}
                  onChange={(e) => onCurrencyChange(e.target.value)}
                  className="h-7 px-1 rounded border-none bg-transparent font-black text-primary text-[11px] outline-none focus:ring-0 cursor-pointer"
                >
                  {availableCurrencies.map((c) => (
                    <option key={c.code} value={c.code} className="text-foreground font-bold">
                      {(language === "ar" ? c.name_ar : c.name_en) || c.name_ar} ({c.symbol || resolveCurrencySymbol(c.code)})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-black text-primary">
                  {availableCurrencies.find((c) => c.code === safeCurrency)?.symbol || baseCurrency?.symbol || safeCurrency}
                </span>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-2xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border h-7 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <span>{t("labels.returnValue", { namespace: "common" })}</span>
            <span className="font-black text-foreground tabular-nums">{totalAmount.toFixed(2)}</span>
          </div>

          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className={`flex items-center gap-2 text-2xs font-bold px-2.5 py-1 rounded-md border h-7 shrink-0 ${
            partnerBalance > 0
              ? "text-destructive bg-destructive/10 border-destructive/20"
              : "text-success bg-success/10 border-success/20"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${partnerBalance > 0 ? "bg-destructive" : "bg-success"}`} />
            <span>{t("labels.partnerBalance", { namespace: "common", vars: { partner: partnerLabel } })}</span>
            <span className="font-black tabular-nums">{partnerBalance.toFixed(2)}</span>
          </div>

          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex flex-col items-center bg-muted px-2.5 py-1 rounded-md border border-border h-[42px] justify-center shrink-0">
            <span className="text-4xs font-black text-muted-foreground uppercase tracking-wider">
              {t("labels.settlementMethod", { namespace: "common" })}
            </span>
            <select
              value={effectiveMode}
              onChange={(e) => {
                const val = e.target.value as typeof settlementMode;
                if (partnerBalance <= 0 && val !== "full_cash_return") return;
                onSettlementModeChange(val);
              }}
              className="h-6 px-1 bg-transparent font-black text-2xs outline-none cursor-pointer border-none text-foreground focus:ring-0"
            >
              {showFullCashReturn && (
                <option value="full_cash_return">{t("labels.fullCashReturn", { namespace: "common" })}</option>
              )}
              {showDeductFromDebt && (
                <option value="deduct_from_debt">{t("labels.deductFromDebt", { namespace: "common" })}</option>
              )}
              {showPartialSettlement && (
                <option value="partial_settlement">{t("labels.partialSettlement", { namespace: "common" })}</option>
              )}
            </select>
          </div>

          {/* Pay-now toggle — only when there's cash to pay */}
          {hasCash && (
            <>
              <div className="text-slate-300 font-light select-none shrink-0">
                <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                  <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-col items-center bg-muted px-2 py-1 rounded-md border border-border h-[42px] justify-center shrink-0">
                <span className="text-4xs font-black text-muted-foreground uppercase tracking-wider">
                  {t("labels.paymentStatus", { namespace: "common" })}
                </span>
                <select
                  value={isPaid ? "paid" : "unpaid"}
                  onChange={(e) => onIsPaidChange(e.target.value === "paid")}
                  className="h-6 px-1 bg-transparent font-black text-2xs outline-none cursor-pointer border-none text-foreground focus:ring-0"
                >
                  <option value="paid">{t("labels.paidDirectly", { namespace: "common" })}</option>
                  <option value="unpaid">{t("labels.notYetPaidAfter", { namespace: "common" })}</option>
                </select>
              </div>
            </>
          )}

          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {effectiveMode === "deduct_from_debt" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {Math.min(totalAmount, partnerBalance) > 0 && (
                <div className="flex items-center gap-2 text-2xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-md border border-success/20 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>{t("labels.deductedFromBalance", { namespace: "common" })}</span>
                  <span className="font-black tabular-nums">{Math.min(totalAmount, partnerBalance).toFixed(2)}</span>
                </div>
              )}
              {!hasDebt && totalAmount > 0 && (
                <div className="flex items-center gap-2 text-2xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{paymentLabel}:</span>
                  <span className="font-black tabular-nums">{totalAmount.toFixed(2)}</span>
                </div>
              )}
              {totalAmount > partnerBalance && partnerBalance > 0 && (
                <div className="flex items-center gap-2 text-2xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{paymentLabel}:</span>
                  <span className="font-black tabular-nums">{(totalAmount - partnerBalance).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {effectiveMode === "full_cash_return" && (
            <div className="flex items-center gap-2 text-2xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 h-7 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>{isPaid ? paymentLabel : t("labels.deferredReturn", { namespace: "common" })} {isPaid ? "" : `(${t("labels.notYetPaid", { namespace: "common" })})`}:</span>
              <span className="font-black tabular-nums">{totalAmount.toFixed(2)}</span>
            </div>
          )}

          {effectiveMode === "partial_settlement" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-2 text-2xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 h-7 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{isPaid ? paymentLabel : t("labels.deferredPayment", { namespace: "common" })}:</span>
                <input
                  type="number"
                  value={settlementCash}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    const clamped = Math.max(minCash, Math.min(totalAmount, v));
                    onSettlementCashChange(clamped.toFixed(2));
                  }}
                  className="h-5 w-16 font-black text-2xs border-primary/20 focus:ring-primary bg-card py-0 px-1 rounded-md border outline-none text-center"
                  min={minCash}
                  max={totalAmount}
                  step="0.01"
                />
              </div>
              {(totalAmount - parseFloat(settlementCash || "0")) > 0 && (
                <div className="flex items-center gap-2 text-2xs font-bold text-success bg-success/10 px-2.5 py-1 rounded-md border border-success/20 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>{t("labels.deductedFromBalance", { namespace: "common" })}</span>
                  <span className="font-black tabular-nums">{(totalAmount - parseFloat(settlementCash || "0")).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="me-auto flex shrink-0 flex-col items-end rounded-md border border-border bg-muted px-4 py-1.5">
          <span className={`text-3xs font-black uppercase tracking-widest mb-0.5 ${
            effectiveMode === "full_cash_return"
              ? "text-success"
              : (partnerBalance - Math.min(totalAmount, partnerBalance)) <= 0
                ? "text-success"
                : "text-destructive"
          }`}>
            {t("labels.balanceAfterSettlement", { namespace: "common" })}
          </span>
          <span className={`text-sm font-black tabular-nums tracking-tight ${
            effectiveMode === "full_cash_return"
              ? "text-success"
              : effectiveMode === "deduct_from_debt"
                ? (Math.max(0, partnerBalance - totalAmount) <= 0 ? "text-success" : "text-destructive")
                : ((partnerBalance - (totalAmount - parseFloat(settlementCash || "0"))) <= 0 ? "text-success" : "text-destructive")
          }`}>
            {effectiveMode === "full_cash_return"
              ? partnerBalance.toFixed(2)
              : effectiveMode === "deduct_from_debt"
                ? Math.max(0, partnerBalance - totalAmount).toFixed(2)
                : Math.max(0, partnerBalance - (totalAmount - parseFloat(settlementCash || "0"))).toFixed(2)
            }
          </span>
        </div>
      </div>

      {/* Slider for partial settlement */}
      {effectiveMode === "partial_settlement" && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span>{t("labels.minCashPayment", { namespace: "common" })} {minCash.toFixed(2)}</span>
            <span>{t("labels.maxAmount", { namespace: "common" })} {totalAmount.toFixed(2)}</span>
          </div>
          <input
            type="range"
            value={parseFloat(settlementCash || "0")}
            onChange={(e) => onSettlementCashChange(e.target.value)}
            min={minCash}
            max={totalAmount}
            step={0.01}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span className="text-primary font-bold">{t("labels.cashLabel", { namespace: "common" })} {parseFloat(settlementCash || "0").toFixed(2)}</span>
            <span className="text-success font-bold">{t("labels.deductedFromBalance", { namespace: "common" })} {(totalAmount - parseFloat(settlementCash || "0")).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
