import { useMemo, useEffect, useCallback } from "react";
import { cn } from "@shared/lib/utils";
import { type Currency } from "@modules/core/api/currencyService";
import { resolveCurrencySymbol } from "@modules/invoicing/lib/constants";
import {
  formatWithLocale,
  useCurrencyContext,
} from "@app/providers/CurrencyContext";

interface SummaryPanelProps {
  subtotal: number;
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
  docCurrency?: string;
  docSubtotal?: number;
  isReadOnly?: boolean;
  paymentMethod?: string;
  onPaymentMethodChange?: (method: string) => void;
  paidAmount?: string;
  onPaidAmountChange?: (amount: string) => void;
  onExtraCostsChange?: (value: string) => void;
  extraPaidAmount?: string;
  onExtraPaidAmountChange?: (amount: string) => void;
  isCashParty?: boolean;
}

export function SummaryPanel({
  subtotal,
  tax = 0,
  extraCosts,
  net,
  paid = 0,
  currency,
  compact = false,
  invoiceType,
  children,
  currencies,
  onCurrencyChange,
  exchangeRate = 1,
  isReadOnly = false,
  paymentMethod,
  onPaymentMethodChange,
  paidAmount,
  onPaidAmountChange,
  onExtraCostsChange,
  extraPaidAmount,
  onExtraPaidAmountChange,
  docCurrency,
  isCashParty = false,
}: SummaryPanelProps) {
  const { baseCurrency, currencies: contextCurrencies, convertBetween } = useCurrencyContext();
  const safeExtra = extraCosts ?? 0;
  const availableCurrencies = currencies ?? contextCurrencies;
  const safeCurrency = currency || baseCurrency?.code || (availableCurrencies[0]?.code ?? "");

  const safeDocCurrency = docCurrency || safeCurrency;

  const isDisplayDifferentFromDoc = safeDocCurrency !== safeCurrency && !!convertBetween;

  const resolveCurrencyMeta = (code?: string) =>
    availableCurrencies.find((c) => c.code === (code || safeCurrency)) ||
    (code === baseCurrency?.code ? baseCurrency : null);
  const formatRawAmount = (amount: number, code?: string) => {
    const effectiveCode = code || safeCurrency;
    const currencyMeta = availableCurrencies.find((c) => c.code === effectiveCode) ||
      (effectiveCode === baseCurrency?.code ? baseCurrency : null);
    const formatted = formatWithLocale(amount, currencyMeta?.decimals ?? 2);
    return currencyMeta
      ? `${formatted} ${currencyMeta.symbol || currencyMeta.code}`
      : formatted;
  };

  const docToDisplay = useCallback((amount: number): number => {
    if (!isDisplayDifferentFromDoc) return amount;
    return convertBetween!(amount, safeDocCurrency, safeCurrency);
  }, [isDisplayDifferentFromDoc, convertBetween, safeDocCurrency, safeCurrency]);

  const displayToDoc = useCallback((amount: number): number => {
    if (!isDisplayDifferentFromDoc) return amount;
    return convertBetween!(amount, safeCurrency, safeDocCurrency);
  }, [isDisplayDifferentFromDoc, convertBetween, safeCurrency, safeDocCurrency]);

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(val, max));

  const clampPaidSafe = (val: string, max: number) => {
    const clamped = clamp(parseFloat(val) || 0, 0, max);
    return Number.isFinite(clamped) ? clamped.toString() : "0";
  };

  const invoiceMaxDisplay = useMemo(() => {
    if (invoiceType === "Purchase" && safeExtra > 0) return subtotal;
    return net;
  }, [invoiceType, safeExtra, subtotal, net]);

  const invoiceMaxDoc = useMemo(() => {
    return displayToDoc(invoiceMaxDisplay);
  }, [invoiceMaxDisplay, displayToDoc]);

  const safeExtraDisplay = docToDisplay(safeExtra);

  const derivedInvoiceMethod = useMemo(() => {
    const pAmtDoc = parseFloat(paidAmount || "0") || 0;
    const pAmtDisplay = docToDisplay(pAmtDoc);
    if (pAmtDisplay <= 0) return "credit";
    if (pAmtDisplay >= invoiceMaxDisplay && invoiceMaxDisplay > 0) return "cash";
    return "partial";
  }, [paidAmount, invoiceMaxDisplay, docToDisplay]);

  const derivedExtraMethod = useMemo(() => {
    const exPaidDoc = parseFloat(extraPaidAmount || "0") || 0;
    const exPaidDisplay = docToDisplay(exPaidDoc);
    if (exPaidDisplay <= 0) return "credit";
    if (exPaidDisplay >= safeExtraDisplay && safeExtraDisplay > 0) return "cash";
    return "partial";
  }, [extraPaidAmount, safeExtraDisplay, docToDisplay]);

  const currentOverallMethod = useMemo(() => {
    if (derivedInvoiceMethod === "cash" && derivedExtraMethod === "cash") return "cash";
    if (derivedInvoiceMethod === "credit" && derivedExtraMethod === "credit") return "credit";
    return "partial";
  }, [derivedInvoiceMethod, derivedExtraMethod]);

  useEffect(() => {
    if (safeExtra > 0 && invoiceType === "Purchase" && paymentMethod !== currentOverallMethod) {
      onPaymentMethodChange?.(currentOverallMethod);
    }
  }, [currentOverallMethod, safeExtra, invoiceType, paymentMethod, onPaymentMethodChange]);

  useEffect(() => {
    if (isCashParty && paymentMethod !== "cash") {
      onPaymentMethodChange?.("cash");
    }
  }, [isCashParty, paymentMethod, onPaymentMethodChange]);

  const handleInvoicePaymentMethodChange = (method: string) => {
    if (!onPaidAmountChange || !onPaymentMethodChange) return;

    let newPaidAmountDoc: string;
    if (method === "cash") {
      newPaidAmountDoc = invoiceMaxDoc.toFixed(2);
    } else if (method === "credit") {
      newPaidAmountDoc = "0";
    } else {
      const currentDoc = parseFloat(paidAmount || "0") || 0;
      const halfMaxDoc = invoiceMaxDoc / 2;
      newPaidAmountDoc = (currentDoc > 0 && currentDoc < invoiceMaxDoc)
        ? currentDoc.toFixed(2)
        : halfMaxDoc.toFixed(2);
    }
    const maxDoc = invoiceMaxDoc;
    const clamped = clamp(parseFloat(newPaidAmountDoc) || 0, 0, maxDoc);
    onPaidAmountChange(clamped.toFixed(2));

    if (safeExtra <= 0 || invoiceType !== "Purchase") {
      onPaymentMethodChange(method);
    }
  };

  const handleExtraPaymentMethodChange = (method: string) => {
    if (!onExtraPaidAmountChange || !onPaymentMethodChange) return;

    let newExtraPaidDoc: string;
    if (method === "cash") {
      newExtraPaidDoc = safeExtra.toFixed(2);
    } else if (method === "credit") {
      newExtraPaidDoc = "0";
    } else {
      const currentDoc = parseFloat(extraPaidAmount || "0") || 0;
      const halfDoc = safeExtra / 2;
      newExtraPaidDoc = (currentDoc > 0 && currentDoc < safeExtra)
        ? currentDoc.toFixed(2)
        : halfDoc.toFixed(2);
    }
    const clamped = clamp(parseFloat(newExtraPaidDoc) || 0, 0, safeExtra);
    onExtraPaidAmountChange(clamped.toFixed(2));
  };

  const totalPaid = useMemo(() => {
    if (isCashParty) return net;
    if (invoiceType === "Sales" && paymentMethod) {
      if (paymentMethod === "cash") return net;
      if (paymentMethod === "credit") return 0;
    }
    const basePaid = parseFloat(paidAmount || "0") || 0;
    const extraPaid =
      invoiceType === "Purchase" ? parseFloat(extraPaidAmount || "0") || 0 : 0;
    const rawTotal = basePaid + extraPaid;
    if (rawTotal === 0) return 0;
    if (docCurrency && safeCurrency && docCurrency !== safeCurrency && convertBetween) {
      return convertBetween(rawTotal, docCurrency, safeCurrency);
    }
    return rawTotal;
  }, [paidAmount, extraPaidAmount, invoiceType, docCurrency, safeCurrency, convertBetween, paymentMethod, net, isCashParty]);

  const remaining = Math.max(net - totalPaid, 0);

  return (
    <div
      className="bg-card border border-border rounded-lg shadow-sm p-4 select-none"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 overflow-x-auto no-scrollbar py-1">
          {/* Currency Selector */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 bg-muted rounded-md border border-border">
            <span className="text-[10px] font-bold text-muted-foreground">
              العملة:
            </span>
            {onCurrencyChange && currencies ? (
              <select
                value={safeCurrency}
                disabled={isReadOnly}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="h-7 px-1 rounded border-none bg-transparent font-black text-blue-600 text-[11px] outline-none focus:ring-0 cursor-pointer"
              >
                {currencies.map((c) => (
                  <option
                    key={c.code}
                    value={c.code}
                    className="text-slate-800 font-bold"
                  >
                    {c.name_ar} ({c.symbol || resolveCurrencySymbol(c.code)})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-black text-blue-600">
                {resolveCurrencyMeta(safeCurrency)?.symbol || safeCurrency}
              </span>
            )}
          </div>

          {/* PURCHASE INVOICE TREE FLOW */}
          {invoiceType === "Purchase" && (
            <div className="flex items-center gap-2">
              {/* Tree Part 1: مجموع الفاتورة & تكاليف اضافية */}
              <div className="flex flex-col justify-center gap-1.5">
                {/* مجموع الفاتورة */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-muted px-2.5 py-1 rounded-md border border-border h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>مجموع الفاتورة:</span>
                  <span className="font-black text-slate-800 tabular-nums">
                    {formatRawAmount(subtotal, currency)}
                  </span>
                </div>

                {/* تكاليف إضافية */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-500 bg-indigo-50/40 px-2.5 py-1 rounded-md border border-indigo-100/60 h-7 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>تكاليف إضافية:</span>
                  {onExtraCostsChange && !isReadOnly ? (
                    <input
                      type="number"
                      value={safeExtra}
                      onChange={(e) => onExtraCostsChange(e.target.value)}
                      className="h-5.5 w-16 font-black text-[11px] border-indigo-200 focus:ring-indigo-500 bg-white py-0 px-1 rounded-md border outline-none text-indigo-600 text-center"
                    />
                  ) : (
                    <span className="font-black tabular-nums">
                      {formatRawAmount(safeExtra, currency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Bracket merging into المبلغ كاملاً */}
              <div className="flex items-center select-none text-indigo-300 font-light -mx-1 shrink-0">
                <svg className="w-3.5 h-12" viewBox="0 0 16 48" fill="none">
                  <path
                    d="M0 6C6 6 8 14 8 24C8 34 6 42 0 42M8 24H16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* المبلغ كاملاً */}
              <div className="flex flex-col items-center bg-indigo-600 text-white px-4 py-1.5 rounded-xl shadow-md h-[42px] justify-center shrink-0">
                <span className="text-[8px] font-black uppercase tracking-wider opacity-90">
                  المبلغ كاملاً
                </span>
                <span className="text-xs font-black tabular-nums">
                  {formatRawAmount(net, currency)}
                </span>
              </div>

              {/* Payment details branching */}
              {onPaymentMethodChange && (
                <>
                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path
                        d="M0 12H16"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* BRANCHING SCENARIO BASED ON EXTRA COSTS AMOUNT */}
                  {safeExtra > 0 ? (
                    <>
                      {/* Connection branching out to مدفوع الفاتورة & مدفوع التكاليف */}
                      <div className="flex items-center select-none text-blue-300 font-light -mx-1 shrink-0">
                        <svg
                          className="w-3.5 h-12"
                          viewBox="0 0 16 48"
                          fill="none"
                        >
                          <path
                            d="M0 24H8M8 24C8 14 10 6 16 6M8 24C8 34 10 42 16 42"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* The two target branches with split payment methods */}
                      <div className="flex flex-col justify-center gap-1.5">
                        {/* دفع الفاتورة */}
                        <div className="flex items-center gap-2 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider shrink-0">
                            دفع الفاتورة:
                          </span>
                          {isCashParty ? (
                            <span className="h-5 px-1 font-black text-[9px] text-emerald-600 flex items-center">
                              نقداً
                            </span>
                          ) : (
                            <select
                              value={derivedInvoiceMethod}
                              onChange={(e) =>
                                handleInvoicePaymentMethodChange(e.target.value)
                              }
                              disabled={isReadOnly}
                              className="h-5 px-1 bg-white border border-blue-200 rounded font-black text-[9px] outline-none cursor-pointer text-blue-700 focus:ring-0"
                            >
                              <option value="cash">نقداً</option>
                              <option value="credit">آجل</option>
                              <option value="partial">جزئي</option>
                            </select>
                          )}
                          {derivedInvoiceMethod === "partial" &&
                          onPaidAmountChange &&
                          !isReadOnly ? (
                            <input
                              type="number"
                              min={0}
                              max={invoiceMaxDisplay}
                              value={docToDisplay(parseFloat(paidAmount || "0") || 0)}
                              onChange={(e) => {
                                const valDisplay = parseFloat(e.target.value) || 0;
                                const clampedDisplay = clamp(valDisplay, 0, invoiceMaxDisplay);
                                const valDoc = displayToDoc(clampedDisplay);
                                onPaidAmountChange(valDoc.toFixed(2));
                              }}
                              className="h-4.5 w-14 font-black text-[10px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded-md border outline-none text-center"
                            />
                          ) : (
                            <span className="font-black text-[10px] tabular-nums text-blue-800">
                              {formatRawAmount(
                                derivedInvoiceMethod === "cash" ? invoiceMaxDisplay : 0,
                                safeCurrency,
                              )}
                            </span>
                          )}
                        </div>

                        {/* دفع التكاليف */}
                        <div className="flex items-center gap-2 bg-violet-50/40 px-2.5 py-1 rounded-md border border-violet-100/60 h-7 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-[9px] font-black text-violet-500 uppercase tracking-wider shrink-0">
                            دفع التكاليف:
                          </span>
                          {isCashParty ? (
                            <span className="h-5 px-1 font-black text-[9px] text-emerald-600 flex items-center">
                              نقداً
                            </span>
                          ) : (
                            <select
                              value={derivedExtraMethod}
                              onChange={(e) =>
                                handleExtraPaymentMethodChange(e.target.value)
                              }
                              disabled={isReadOnly}
                              className="h-5 px-1 bg-white border border-violet-200 rounded font-black text-[9px] outline-none cursor-pointer text-violet-700 focus:ring-0"
                            >
                              <option value="cash">نقداً</option>
                              <option value="credit">آجل</option>
                              <option value="partial">جزئي</option>
                            </select>
                          )}
                          {derivedExtraMethod === "partial" &&
                          onExtraPaidAmountChange &&
                          !isReadOnly ? (
                            <input
                              type="number"
                              min={0}
                              max={safeExtraDisplay}
                              value={docToDisplay(parseFloat(extraPaidAmount || "0") || 0)}
                              onChange={(e) => {
                                const valDisplay = parseFloat(e.target.value) || 0;
                                const clampedDisplay = clamp(valDisplay, 0, safeExtraDisplay);
                                const valDoc = displayToDoc(clampedDisplay);
                                onExtraPaidAmountChange(valDoc.toFixed(2));
                              }}
                              className="h-4.5 w-14 font-black text-[10px] border-violet-200 focus:ring-violet-500 bg-white py-0 px-1 rounded-md border outline-none text-violet-600 text-center"
                            />
                          ) : (
                            <span className="font-black text-[10px] tabular-nums text-violet-800">
                              {formatRawAmount(
                                derivedExtraMethod === "cash" ? safeExtraDisplay : 0,
                                safeCurrency,
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Connection Indicator */}
                      <div className="text-slate-300 font-light select-none shrink-0">
                        <svg
                          className="w-3.5 h-6"
                          viewBox="0 0 16 24"
                          fill="none"
                        >
                          <path
                            d="M0 12H16"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* دفع الفاتورة */}
                      <div className="flex items-center gap-2 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-[42px] justify-center shrink-0">
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-wider">
                          طريقة دفع الفاتورة
                        </span>
                        {isCashParty ? (
                          <span className="h-6 px-1 font-black text-[10px] text-emerald-600 flex items-center">
                            نقداً
                          </span>
                        ) : (
                          <select
                            value={derivedInvoiceMethod}
                            onChange={(e) =>
                              handleInvoicePaymentMethodChange(e.target.value)
                            }
                            disabled={isReadOnly}
                            className="h-6 px-1 bg-transparent font-black text-[10px] outline-none cursor-pointer border-none text-blue-700 focus:ring-0"
                          >
                            <option value="cash">نقداً</option>
                            <option value="credit">آجل</option>
                            <option value="partial">جزئي</option>
                          </select>
                        )}
                          {derivedInvoiceMethod === "partial" &&
                          onPaidAmountChange &&
                          !isReadOnly ? (
                            <input
                              type="number"
                              min={0}
                              max={invoiceMaxDisplay}
                              value={docToDisplay(parseFloat(paidAmount || "0") || 0)}
                              onChange={(e) => {
                                const valDisplay = parseFloat(e.target.value) || 0;
                                const clampedDisplay = clamp(valDisplay, 0, invoiceMaxDisplay);
                                const valDoc = displayToDoc(clampedDisplay);
                                onPaidAmountChange(valDoc.toFixed(2));
                              }}
                              className="h-4.5 w-14 font-black text-[10px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded-md border outline-none text-center"
                            />
                          ) : (
                            <span className="font-black text-[10px] tabular-nums text-blue-800">
                              {formatRawAmount(
                                derivedInvoiceMethod === "cash" ? invoiceMaxDisplay : 0,
                                safeCurrency,
                              )}
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
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-muted px-2.5 py-1 rounded-md border border-border h-7 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>المبلغ كاملاً:</span>
                <span className="font-black text-slate-800 tabular-nums">
                  {formatRawAmount(net, currency)}
                </span>
              </div>

              {invoiceType === "Sales" && onPaymentMethodChange && (
                <>
                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path
                        d="M0 12H16"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* طريقة الدفع */}
                  <div className="flex flex-col items-center bg-muted px-2.5 py-1 rounded-md border border-border h-[42px] justify-center shrink-0">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-wider">
                      طريقة الدفع
                    </span>
                    {isCashParty ? (
                      <span className="h-6 px-1 font-black text-[11px] text-emerald-600 flex items-center">
                        نقداً
                      </span>
                    ) : (
                      <select
                        value={paymentMethod || "cash"}
                        onChange={(e) => onPaymentMethodChange(e.target.value)}
                        disabled={isReadOnly}
                        className="h-6 px-1 bg-transparent font-black text-[11px] outline-none cursor-pointer border-none text-slate-800 focus:ring-0"
                      >
                        <option value="cash">نقداً</option>
                        <option value="credit">آجل</option>
                        <option value="partial">جزئي</option>
                      </select>
                    )}
                  </div>

                  {/* Connection Indicator */}
                  <div className="text-slate-300 font-light select-none shrink-0">
                    <svg className="w-3.5 h-6" viewBox="0 0 16 24" fill="none">
                      <path
                        d="M0 12H16"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* مدفوع الفاتورة */}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50/40 px-2.5 py-1 rounded-md border border-blue-100/60 h-7 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span>مدفوع الفاتورة:</span>
                    {paymentMethod === "partial" &&
                    onPaidAmountChange &&
                    !isReadOnly ? (
                      <input
                        type="number"
                        min={0}
                        max={net}
                        value={paidAmount || "0"}
                        onChange={(e) =>
                          onPaidAmountChange(
                            clampPaidSafe(e.target.value, net),
                          )
                        }
                        className="h-5 w-16 font-black text-[11px] border-blue-200 focus:ring-blue-500 bg-white py-0 px-1 rounded-md border outline-none text-center"
                      />
                    ) : (
                      <span className="font-black tabular-nums">
                        {formatRawAmount(totalPaid, currency)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Children / Extra Actions */}
          {children && (
            <div className="flex items-center gap-2 border-r border-border pr-2 shrink-0">
              {children}
            </div>
          )}
        </div>

        {/* Right Side: Remaining Balance */}
        {(invoiceType === "Sales" || invoiceType === "Purchase") && (
          <div className="flex flex-col items-end px-4 py-1.5 mr-auto shrink-0 bg-muted rounded-md border border-border">
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-widest mb-0.5",
                remaining <= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              المبلغ المتبقي
            </span>
            <span
              className={cn(
                "text-sm font-black tabular-nums tracking-tight",
                remaining <= 0 ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {formatRawAmount(remaining, currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
