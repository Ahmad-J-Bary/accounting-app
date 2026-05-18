import { useMemo, useState } from 'react';
import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { type Currency } from '@modules/core/api/currencyService';
import { resolveCurrencySymbol } from "@modules/invoicing/lib/constants";

interface SummaryPanelProps {
  subtotal: number;
  discount?: number;
  tax?: number;
  extraCosts?: number;
  net: number;
  paid?: number;
  currency?: string;
  compact?: boolean;
  invoiceType?: "Sales" | "Purchase" | "OpeningBalance";
  children?: React.ReactNode;
  currencies?: Currency[];
  onCurrencyChange?: (code: string) => void;
  exchangeRate?: number;
  isReadOnly?: boolean;
  paymentMethod?: string;
  onPaymentMethodChange?: (method: string) => void;
  paidAmount?: string;
  onPaidAmountChange?: (amount: string) => void;
  onExtraCostsChange?: (value: string) => void;
  extraPaidAmount?: string;
  onExtraPaidAmountChange?: (amount: string) => void;
}

export function SummaryPanel({
  subtotal, discount = 0, tax = 0, extraCosts, net, paid = 0,
  currency = "ل.س", compact = false, invoiceType, children,
  currencies, onCurrencyChange, exchangeRate = 1, isReadOnly = false,
  paymentMethod, onPaymentMethodChange, paidAmount, onPaidAmountChange, onExtraCostsChange,
  extraPaidAmount, onExtraPaidAmountChange,
}: SummaryPanelProps) {
  const safeExtra = extraCosts ?? 0;
  const displayCurrency = resolveCurrencySymbol(currency);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

  const clampPaidSafe = (val: string, max: number) => {
    const clamped = clamp(parseFloat(val) || 0, 0, max);
    return Number.isFinite(clamped) ? clamped.toString() : "0";
  };

  // Independent selection state for each dropdown (not derived from overall paymentMethod)
  const [selInvoiceMethod, setSelInvoiceMethod] = useState<string>(() => {
    if (paymentMethod === "cash") return "cash";
    if (paymentMethod === "credit") return "credit";
    const pAmt = parseFloat(paidAmount || "0") || 0;
    if (pAmt === subtotal && subtotal > 0) return "cash";
    if (pAmt === 0) return "credit";
    return "partial";
  });

  const [selExtraMethod, setSelExtraMethod] = useState<string>(() => {
    if (paymentMethod === "cash") return "cash";
    if (paymentMethod === "credit") return "credit";
    const exPaid = parseFloat(extraPaidAmount || "0") || 0;
    if (exPaid === safeExtra && safeExtra > 0) return "cash";
    if (exPaid === 0) return "credit";
    return "partial";
  });

  // Handlers for split payment methods
  const handleInvoicePaymentMethodChange = (method: string) => {
    setSelInvoiceMethod(method);
    if (!onPaymentMethodChange || !onPaidAmountChange) return;

    let newPaidAmount: string;
    if (method === "cash") {
      newPaidAmount = subtotal.toString();
    } else if (method === "credit") {
      newPaidAmount = "0";
    } else {
      newPaidAmount = clampPaidSafe(paidAmount || "0", subtotal);
    }

    onPaidAmountChange(newPaidAmount);

    let overallMethod = "partial";
    if (method === "cash" && selExtraMethod === "cash") {
      overallMethod = "cash";
    } else if (method === "credit" && selExtraMethod === "credit") {
      overallMethod = "credit";
    }

    onPaymentMethodChange(overallMethod);
  };

  const handleExtraPaymentMethodChange = (method: string) => {
    setSelExtraMethod(method);
    if (!onPaymentMethodChange || !onExtraPaidAmountChange) return;

    let newExtraPaid: string;
    if (method === "cash") {
      newExtraPaid = safeExtra.toString();
    } else if (method === "credit") {
      newExtraPaid = "0";
    } else {
      newExtraPaid = clampPaidSafe(extraPaidAmount || "0", safeExtra);
    }

    onExtraPaidAmountChange(newExtraPaid);

    let overallMethod = "partial";
    if (selInvoiceMethod === "cash" && method === "cash") {
      overallMethod = "cash";
    } else if (selInvoiceMethod === "credit" && method === "credit") {
      overallMethod = "credit";
    }

    onPaymentMethodChange(overallMethod);
  };

  const totalPaid = useMemo(() => {
    if (paymentMethod === "cash") {
      return net;
    }
    if (paymentMethod === "credit") {
      return 0;
    }
    const basePaid = parseFloat(paidAmount || "0") || 0;
    const extraPaid = invoiceType === "Purchase" ? (parseFloat(extraPaidAmount || "0") || 0) : 0;
    return basePaid + extraPaid;
  }, [paymentMethod, net, paidAmount, extraPaidAmount, invoiceType]);

  const remaining = Math.max(net - totalPaid, 0);

  return (
    <div className="bg-card border-t border-border shadow-md px-4 py-2 select-none" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Trees & Values */}
        <div className="flex flex-wrap items-center gap-4 overflow-x-auto no-scrollbar py-1">
          {/* Currency Selector */}
          <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 bg-muted rounded border border-border">
            <span className="text-[10px] font-bold text-muted-foreground">العملة:</span>
            {onCurrencyChange && currencies ? (
              <select value={currency} disabled={isReadOnly} onChange={e => onCurrencyChange(e.target.value)}
                className="h-7 px-1 rounded border-none bg-transparent font-black text-primary text-[11px] outline-none focus:ring-0 cursor-pointer">
                {currencies.map(c => (
                  <option key={c.code} value={c.code} className="text-foreground font-bold">
                    {c.name_ar} ({resolveCurrencySymbol(c.code)})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-black text-primary">{displayCurrency}</span>
            )}
          </div>

          {/* PURCHASE INVOICE TREE FLOW */}
          {invoiceType === "Purchase" && (
            <div className="flex items-center gap-2">
              {/* Tree Part 1: مجموع الفاتورة & تكاليف اضافية */}
              <div className="flex flex-col justify-center gap-1.5">
                {/* مجموع الفاتورة */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 h-6 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-slate-400" />
                  <span>مجموع الفاتورة:</span>
                  <span className="font-black text-slate-800 tabular-nums">{formatCurrency(subtotal, displayCurrency)}</span>
                </div>

                {/* تكاليف إضافية */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 bg-indigo-50/20 px-2 py-0.5 rounded border border-indigo-100/30 h-6 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-indigo-400" />
                  <span>تكاليف إضافية:</span>
                  {onExtraCostsChange && !isReadOnly ? (
                    <input
                      type="number"
                      value={safeExtra}
                      onChange={e => onExtraCostsChange(e.target.value)}
                      className="h-5 w-16 font-black text-[11px] border-indigo-200 focus:ring-indigo-500 bg-white py-0 px-1 rounded border outline-none text-indigo-600 text-center"
                    />
                  ) : (
                    <span className="font-black tabular-nums">{formatCurrency(safeExtra, displayCurrency)}</span>
                  )}
                </div>
              </div>

              {/* Bracket merging into المبلغ كاملاً */}
              <div className="flex items-center select-none text-indigo-300 font-light -mx-1 shrink-0">
                <svg className="w-3.5 h-12" viewBox="0 0 16 48" fill="none">
                  <path d="M0 6C6 6 8 14 8 24C8 34 6 42 0 42M8 24H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* المبلغ كاملاً */}
              <div className="flex flex-col items-center bg-indigo-600 text-white px-3 py-1 rounded-xl shadow-sm h-[38px] justify-center shrink-0">
                <span className="text-[8px] font-black uppercase tracking-wider opacity-90">المبلغ كاملاً</span>
                <span className="text-xs font-black tabular-nums">{formatCurrency(subtotal + safeExtra, displayCurrency)}</span>
              </div>

              {/* Payment details branching */}
              {onPaymentMethodChange && (
                <>
                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* BRANCHING SCENARIO BASED ON EXTRA COSTS AMOUNT */}
                  {safeExtra > 0 ? (
                    <>
                      {/* Connection branching out to مدفوع الفاتورة & مدفوع التكاليف */}
                      <div className="flex items-center select-none text-blue-300 font-light -mx-1 shrink-0">
                        <svg className="w-3.5 h-12" viewBox="0 0 16 48" fill="none">
                          <path d="M0 24H8M8 24C8 14 10 6 16 6M8 24C8 34 10 42 16 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* The two target branches with split payment methods */}
                      <div className="flex flex-col justify-center gap-1.5">
                        {/* دفع الفاتورة */}
                        <div className="flex items-center gap-2 bg-blue-50/20 px-2 py-0.5 rounded-lg border border-blue-100/30 h-6 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider shrink-0">دفع الفاتورة:</span>
                          <select
                            value={selInvoiceMethod}
                            onChange={e => handleInvoicePaymentMethodChange(e.target.value)}
                            disabled={isReadOnly}
                            className="h-5 px-1 bg-white border border-blue-200 rounded font-black text-[9px] outline-none cursor-pointer text-blue-700 focus:ring-0"
                          >
                            <option value="cash">نقداً</option>
                            <option value="credit">آجل</option>
                            <option value="partial">جزئي</option>
                          </select>
                          {selInvoiceMethod === "partial" && onPaidAmountChange && !isReadOnly ? (
                            <input
                              type="number"
                              min={0}
                              max={subtotal}
                              value={paidAmount || "0"}
                              onChange={e => onPaidAmountChange(clampPaidSafe(e.target.value, subtotal))}
                              className="h-4.5 w-14 font-black text-[10px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded border outline-none text-center"
                            />
                          ) : (
                            <span className="font-black text-[10px] tabular-nums text-blue-800">
                              {formatCurrency(selInvoiceMethod === "cash" ? subtotal : 0, displayCurrency)}
                            </span>
                          )}
                        </div>

                        {/* دفع التكاليف */}
                        <div className="flex items-center gap-2 bg-violet-50/20 px-2 py-0.5 rounded-lg border border-violet-100/30 h-6 shrink-0">
                          <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-[9px] font-black text-violet-500 uppercase tracking-wider shrink-0">دفع التكاليف:</span>
                          <select
                            value={selExtraMethod}
                            onChange={e => handleExtraPaymentMethodChange(e.target.value)}
                            disabled={isReadOnly}
                            className="h-5 px-1 bg-white border border-violet-200 rounded font-black text-[9px] outline-none cursor-pointer text-violet-700 focus:ring-0"
                          >
                            <option value="cash">نقداً</option>
                            <option value="credit">آجل</option>
                            <option value="partial">جزئي</option>
                          </select>
                          {selExtraMethod === "partial" && onExtraPaidAmountChange && !isReadOnly ? (
                            <input
                              type="number"
                              min={0}
                              max={safeExtra}
                              value={extraPaidAmount || "0"}
                              onChange={e => onExtraPaidAmountChange(clampPaidSafe(e.target.value, safeExtra))}
                              className="h-4.5 w-14 font-black text-[10px] border-violet-200 focus:ring-violet-500 bg-white py-0 px-1 rounded border outline-none text-violet-600 text-center"
                            />
                          ) : (
                            <span className="font-black text-[10px] tabular-nums text-violet-800">
                              {formatCurrency(selExtraMethod === "cash" ? safeExtra : 0, displayCurrency)}
                            </span>
                          )}
                        </div>
                      </div>


                    </>
                  ) : (
                    // Simple branch when extraCosts is 0
                    <>
                      {/* Connection Indicator */}
                      <div className="text-slate-300 font-light select-none shrink-0">
                        <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                          <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* دفع الفاتورة */}
                      <div className="flex items-center gap-2 bg-blue-50/20 px-2 py-0.5 rounded-lg border border-blue-100/30 h-[38px] justify-center shrink-0">
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider">طريقة دفع الفاتورة</span>
                        <select
                          value={selInvoiceMethod}
                          onChange={e => handleInvoicePaymentMethodChange(e.target.value)}
                          disabled={isReadOnly}
                          className="h-6 px-1 bg-transparent font-black text-[10px] outline-none cursor-pointer border-none text-blue-700 focus:ring-0"
                        >
                          <option value="cash">نقداً</option>
                          <option value="credit">آجل</option>
                          <option value="partial">جزئي</option>
                        </select>
                        {selInvoiceMethod === "partial" && onPaidAmountChange && !isReadOnly ? (
                          <input
                            type="number"
                            min={0}
                            max={subtotal}
                            value={paidAmount || "0"}
                            onChange={e => onPaidAmountChange(clampPaidSafe(e.target.value, subtotal))}
                            className="h-5 w-16 font-black text-[11px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded border outline-none text-center"
                          />
                        ) : (
                          <span className="font-black text-xs tabular-nums text-blue-800 px-1">
                            {formatCurrency(selInvoiceMethod === "cash" ? subtotal : 0, displayCurrency)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* SALES INVOICE & OPENING BALANCE STREAMLINED FLOW */}
          {(invoiceType === "Sales" || invoiceType === "OpeningBalance") && (
            <div className="flex items-center gap-2">
              {/* المبلغ كاملاً */}
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 h-6 shrink-0">
                <span className="w-1 h-1 rounded-full bg-slate-400" />
                <span>المبلغ كاملاً:</span>
                <span className="font-black text-slate-800 tabular-nums">{formatCurrency(subtotal, displayCurrency)}</span>
              </div>

              {invoiceType === "Sales" && onPaymentMethodChange && (
                <>
                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* طريقة الدفع */}
                  <div className="flex flex-col items-center bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 h-[38px] justify-center shrink-0">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">طريقة الدفع</span>
                    <select
                      value={paymentMethod || "cash"}
                      onChange={e => onPaymentMethodChange(e.target.value)}
                      disabled={isReadOnly}
                      className="h-6 px-1 bg-transparent font-bold text-[10px] outline-none cursor-pointer border-none text-slate-800 focus:ring-0"
                    >
                      <option value="cash">نقداً</option>
                      <option value="credit">آجل</option>
                      <option value="partial">جزئي</option>
                    </select>
                  </div>

                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path d="M0 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>

                  {/* مدفوع الفاتورة */}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/20 px-2 py-0.5 rounded border border-blue-100/30 h-6 shrink-0">
                    <span className="w-1 h-1 rounded-full bg-blue-400" />
                    <span>مدفوع الفاتورة:</span>
                    {paymentMethod === "partial" && onPaidAmountChange && !isReadOnly ? (
                      <input
                        type="number"
                        min={0}
                        max={subtotal}
                        value={paidAmount || "0"}
                        onChange={e => onPaidAmountChange(clampPaidSafe(e.target.value, subtotal))}
                        className="h-5 w-16 font-black text-[11px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded border outline-none text-center"
                      />
                    ) : (
                      <span className="font-black tabular-nums">
                        {formatCurrency(paymentMethod === "cash" ? subtotal : 0, displayCurrency)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Children / Extra Actions */}
          {children && (
            <div className="flex items-center gap-2 border-r border-border pr-2 shrink-0">{children}</div>
          )}
        </div>

        {/* Right Side: Remaining Balance (Always Unified & Highlighted) */}
        {(invoiceType === "Sales" || invoiceType === "Purchase") && (
          <div className="flex flex-col items-end pr-4 mr-auto py-1 shrink-0">
            <span className={cn("text-[9px] font-black uppercase tracking-wider", remaining <= 0 ? "text-emerald-500" : "text-rose-500")}>المتبقي</span>
            <span className={cn("text-sm font-black tabular-nums", remaining <= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatCurrency(remaining, displayCurrency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
