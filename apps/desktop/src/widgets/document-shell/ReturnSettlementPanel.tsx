import { useMemo } from "react";

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
}: ReturnSettlementPanelProps) {
  const minCash = useMemo(() => {
    if (totalAmount > partnerBalance) return totalAmount - partnerBalance;
    return 0;
  }, [totalAmount, partnerBalance]);

  const partnerLabel = isSales ? "العميل" : "المورد";
  const paymentLabel = isSales ? "سند دفع لعميل" : "سند قبض من مورد";

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
    <div className="bg-card border border-border rounded-lg shadow-sm p-4 select-none" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 bg-muted rounded-md border border-border">
            <span className="text-[10px] font-bold text-muted-foreground">العملة:</span>
            <span className="text-xs font-black text-blue-600">ر.س</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-muted px-2.5 py-1 rounded-md border border-border h-7 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>قيمة المرتجع:</span>
            <span className="font-black text-slate-800 tabular-nums">{totalAmount.toFixed(2)}</span>
          </div>

          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className={`flex items-center gap-2 text-[10px] font-bold px-2.5 py-1 rounded-md border h-7 shrink-0 ${
            partnerBalance > 0
              ? "text-rose-600 bg-rose-50/40 border-rose-100"
              : "text-emerald-600 bg-emerald-50/40 border-emerald-100"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${partnerBalance > 0 ? "bg-rose-400" : "bg-emerald-400"}`} />
            <span>رصيد {partnerLabel}:</span>
            <span className="font-black tabular-nums">{partnerBalance.toFixed(2)}</span>
          </div>

          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex flex-col items-center bg-muted px-2.5 py-1 rounded-md border border-border h-[42px] justify-center shrink-0">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">
              طريقة التسوية
            </span>
            <select
              value={effectiveMode}
              onChange={(e) => {
                const val = e.target.value as typeof settlementMode;
                if (partnerBalance <= 0 && val !== "full_cash_return") return;
                onSettlementModeChange(val);
              }}
              className="h-6 px-1 bg-transparent font-black text-[10px] outline-none cursor-pointer border-none text-slate-800 focus:ring-0"
            >
              {showFullCashReturn && (
                <option value="full_cash_return">إرجاع نقدي كامل</option>
              )}
              {showDeductFromDebt && (
                <option value="deduct_from_debt">تسوية الدين</option>
              )}
              {showPartialSettlement && (
                <option value="partial_settlement">تسوية جزئية</option>
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
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                  حالة الدفعة
                </span>
                <select
                  value={isPaid ? "paid" : "unpaid"}
                  onChange={(e) => onIsPaidChange(e.target.value === "paid")}
                  className="h-6 px-1 bg-transparent font-black text-[10px] outline-none cursor-pointer border-none text-slate-800 focus:ring-0"
                >
                  <option value="paid">تم الدفع مباشر</option>
                  <option value="unpaid">لم يتم الدفع بعد</option>
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
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/40 px-2.5 py-1 rounded-md border border-emerald-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>خصم من الرصيد:</span>
                  <span className="font-black tabular-nums">{Math.min(totalAmount, partnerBalance).toFixed(2)}</span>
                </div>
              )}
              {!hasDebt && totalAmount > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>{paymentLabel}:</span>
                  <span className="font-black tabular-nums">{totalAmount.toFixed(2)}</span>
                </div>
              )}
              {totalAmount > partnerBalance && partnerBalance > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>{paymentLabel}:</span>
                  <span className="font-black tabular-nums">{(totalAmount - partnerBalance).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {effectiveMode === "full_cash_return" && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>{isPaid ? paymentLabel : "إرجاع مؤجل"} {isPaid ? "" : "(لم يسدد بعد)"}:</span>
              <span className="font-black tabular-nums">{totalAmount.toFixed(2)}</span>
            </div>
          )}

          {effectiveMode === "partial_settlement" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>{isPaid ? paymentLabel : "دفعة مؤجلة"}:</span>
                <input
                  type="number"
                  value={settlementCash}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    const clamped = Math.max(minCash, Math.min(totalAmount, v));
                    onSettlementCashChange(clamped.toFixed(2));
                  }}
                  className="h-5 w-16 font-black text-[10px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded-md border outline-none text-center"
                  min={minCash}
                  max={totalAmount}
                  step="0.01"
                />
              </div>
              {(totalAmount - parseFloat(settlementCash || "0")) > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/40 px-2.5 py-1 rounded-md border border-emerald-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>خصم من الرصيد:</span>
                  <span className="font-black tabular-nums">{(totalAmount - parseFloat(settlementCash || "0")).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end px-4 py-1.5 mr-auto shrink-0 bg-muted rounded-md border border-border">
          <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${
            effectiveMode === "full_cash_return"
              ? "text-emerald-600"
              : (partnerBalance - Math.min(totalAmount, partnerBalance)) <= 0
                ? "text-emerald-600"
                : "text-rose-600"
          }`}>
            الرصيد بعد التسوية
          </span>
          <span className={`text-sm font-black tabular-nums tracking-tight ${
            effectiveMode === "full_cash_return"
              ? "text-emerald-600"
              : effectiveMode === "deduct_from_debt"
                ? (Math.max(0, partnerBalance - totalAmount) <= 0 ? "text-emerald-600" : "text-rose-600")
                : ((partnerBalance - (totalAmount - parseFloat(settlementCash || "0"))) <= 0 ? "text-emerald-600" : "text-rose-600")
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
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>الحد الأدنى للدفع النقدي: {minCash.toFixed(2)}</span>
            <span>الحد الأقصى: {totalAmount.toFixed(2)}</span>
          </div>
          <input
            type="range"
            value={parseFloat(settlementCash || "0")}
            onChange={(e) => onSettlementCashChange(e.target.value)}
            min={minCash}
            max={totalAmount}
            step={0.01}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span className="text-blue-600 font-bold">نقداً: {parseFloat(settlementCash || "0").toFixed(2)}</span>
            <span className="text-emerald-600 font-bold">خصم من الرصيد: {(totalAmount - parseFloat(settlementCash || "0")).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
