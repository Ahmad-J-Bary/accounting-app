import { useMemo, useEffect } from "react";
import { Slider } from "@shared/ui/slider";

interface ReturnSettlementPanelProps {
  totalAmount: number;
  partnerBalance: number;
  isSales: boolean;
  settlementMode: "deduct_from_debt" | "full_cash_return" | "partial_settlement";
  onSettlementModeChange: (mode: "deduct_from_debt" | "full_cash_return" | "partial_settlement") => void;
  settlementCash: string;
  onSettlementCashChange: (cash: string) => void;
}

export function ReturnSettlementPanel({
  totalAmount,
  partnerBalance,
  isSales,
  settlementMode,
  onSettlementModeChange,
  settlementCash,
  onSettlementCashChange,
}: ReturnSettlementPanelProps) {
  const minCash = useMemo(() => {
    if (totalAmount > partnerBalance) return totalAmount - partnerBalance;
    return 0;
  }, [totalAmount, partnerBalance]);

  useEffect(() => {
    if (settlementMode === "partial_settlement") {
      const cur = parseFloat(settlementCash || "0");
      if (cur < minCash) {
        onSettlementCashChange(minCash.toFixed(2));
      } else if (cur > totalAmount) {
        onSettlementCashChange(totalAmount.toFixed(2));
      }
    }
  }, [settlementMode, minCash, totalAmount]);

  const partnerLabel = isSales ? "العميل" : "المورد";
  const paymentLabel = isSales ? "سند دفع لعميل" : "سند قبض من مورد";

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-4 select-none" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Currency badge */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 bg-muted rounded-md border border-border">
            <span className="text-[10px] font-bold text-muted-foreground">العملة:</span>
            <span className="text-xs font-black text-blue-600">ر.س</span>
          </div>

          {/* قيمة المرتجع */}
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-muted px-2.5 py-1 rounded-md border border-border h-7 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>قيمة المرتجع:</span>
            <span className="font-black text-slate-800 tabular-nums">{totalAmount.toFixed(2)}</span>
          </div>

          {/* Arrow */}
          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* رصيد الشريك */}
          <div className={`flex items-center gap-2 text-[10px] font-bold px-2.5 py-1 rounded-md border h-7 shrink-0 ${
            partnerBalance > 0
              ? "text-rose-600 bg-rose-50/40 border-rose-100"
              : "text-emerald-600 bg-emerald-50/40 border-emerald-100"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${partnerBalance > 0 ? "bg-rose-400" : "bg-emerald-400"}`} />
            <span>رصيد {partnerLabel}:</span>
            <span className="font-black tabular-nums">{partnerBalance.toFixed(2)}</span>
          </div>

          {/* Arrow */}
          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Settlement mode selector */}
          <div className="flex flex-col items-center bg-muted px-2.5 py-1 rounded-md border border-border h-[42px] justify-center shrink-0">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">
              طريقة التسوية
            </span>
            <select
              value={settlementMode}
              onChange={(e) => onSettlementModeChange(e.target.value as typeof settlementMode)}
              className="h-6 px-1 bg-transparent font-black text-[10px] outline-none cursor-pointer border-none text-slate-800 focus:ring-0"
            >
              <option value="deduct_from_debt">تسوية الدين</option>
              <option value="full_cash_return">إرجاع نقدي كامل</option>
              <option value="partial_settlement">تسوية جزئية</option>
            </select>
          </div>

          {/* Arrow */}
          <div className="text-slate-300 font-light select-none shrink-0">
            <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
              <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Settlement result */}
          {settlementMode === "deduct_from_debt" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              {Math.min(totalAmount, partnerBalance) > 0 && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50/40 px-2.5 py-1 rounded-md border border-emerald-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>خصم من الرصيد:</span>
                  <span className="font-black tabular-nums">{Math.min(totalAmount, partnerBalance).toFixed(2)}</span>
                </div>
              )}
              {partnerBalance <= 0 && totalAmount > 0 && (
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

          {settlementMode === "full_cash_return" && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span>{paymentLabel}:</span>
              <span className="font-black tabular-nums">{totalAmount.toFixed(2)}</span>
            </div>
          )}

          {settlementMode === "partial_settlement" && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>{paymentLabel}:</span>
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

        {/* الرصيد بعد التسوية */}
        <div className="flex flex-col items-end px-4 py-1.5 mr-auto shrink-0 bg-muted rounded-md border border-border">
          <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${
            settlementMode === "full_cash_return"
              ? "text-emerald-600"
              : (partnerBalance - Math.min(totalAmount, partnerBalance)) <= 0
                ? "text-emerald-600"
                : "text-rose-600"
          }`}>
            الرصيد بعد التسوية
          </span>
          <span className={`text-sm font-black tabular-nums tracking-tight ${
            settlementMode === "full_cash_return"
              ? "text-emerald-600"
              : settlementMode === "deduct_from_debt"
                ? (Math.max(0, partnerBalance - totalAmount) <= 0 ? "text-emerald-600" : "text-rose-600")
                : ((partnerBalance - (totalAmount - parseFloat(settlementCash || "0"))) <= 0 ? "text-emerald-600" : "text-rose-600")
          }`}>
            {settlementMode === "full_cash_return"
              ? partnerBalance.toFixed(2)
              : settlementMode === "deduct_from_debt"
                ? Math.max(0, partnerBalance - totalAmount).toFixed(2)
                : Math.max(0, partnerBalance - (totalAmount - parseFloat(settlementCash || "0"))).toFixed(2)
            }
          </span>
        </div>
      </div>

      {/* Slider for partial settlement */}
      {settlementMode === "partial_settlement" && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>الحد الأدنى للدفع النقدي: {minCash.toFixed(2)}</span>
            <span>الحد الأقصى: {totalAmount.toFixed(2)}</span>
          </div>
          <Slider
            value={[parseFloat(settlementCash || "0")]}
            onValueChange={([v]) => onSettlementCashChange(v.toFixed(2))}
            min={minCash}
            max={totalAmount}
            step={0.01}
            className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
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
