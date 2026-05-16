import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { type Currency } from '@modules/core/api/currencyService';
import { type DocumentStatus } from "@modules/invoicing/components/DocumentStatusBadge";
import { STATUS_LABELS, resolveCurrencySymbol } from "@modules/invoicing/lib/constants";

interface SummaryPanelProps {
  subtotal: number;
  discount?: number;
  tax?: number;
  extraCosts?: number;
  net: number;
  paid?: number;
  currency?: string;
  status?: DocumentStatus;
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
  currency = "ل.س", status, compact = false, invoiceType, children,
  currencies, onCurrencyChange, exchangeRate = 1, isReadOnly = false,
  paymentMethod, onPaymentMethodChange, paidAmount, onPaidAmountChange, onExtraCostsChange,
  extraPaidAmount, onExtraPaidAmountChange,
}: SummaryPanelProps) {
  const safeExtra = extraCosts ?? 0;
  const displayCurrency = resolveCurrencySymbol(currency);
  const remaining = Math.max(net - paid, 0);
  const st = status ? STATUS_LABELS[status] : null;

  return (
    <div className="bg-card border-t border-border shadow-sm px-4 py-1.5" dir="rtl">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side */}
        <div className="flex items-center gap-5 overflow-x-auto no-scrollbar py-0.5">
          {st && (
            <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold border shrink-0", st.bg, st.color.replace('text-', 'border-').replace('700', '200'), st.color)}>
              {st.label}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0 px-2 bg-muted rounded border border-border">
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

          <div className="flex items-center gap-4 border-r border-border pr-4">
            {invoiceType === "Purchase" && (
              <>
                <SummaryItem label="مجموع الفاتورة" value={subtotal} currency={displayCurrency} />
                {onExtraCostsChange && !isReadOnly ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">تكاليف اضافية:</span>
                    <input
                      type="number"
                      value={safeExtra}
                      onChange={e => onExtraCostsChange(e.target.value)}
                      className="h-7 w-20 font-black text-xs border-indigo-200 focus:ring-indigo-500 bg-indigo-50/30 py-0 px-2 rounded border outline-none tabular-nums text-indigo-600"
                    />
                  </div>
                ) : (
                  <SummaryItem label="تكاليف اضافية" value={safeExtra} currency={displayCurrency} color="text-indigo-600" />
                )}
                <SummaryItem label="المبلغ كاملاً" value={subtotal + safeExtra} currency={displayCurrency} color="text-slate-900" />
              </>
            )}
            {(invoiceType === "Sales" || invoiceType === "OpeningBalance") && (
              <SummaryItem label="المبلغ كاملاً" value={subtotal} currency={displayCurrency} />
            )}
          </div>

          {/* Payment Method, Partial Payment & Remaining */}
          {(invoiceType === "Sales" || invoiceType === "Purchase") && onPaymentMethodChange && (
            <div className="flex items-center gap-3 border-r border-border pr-4">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">طريقة الدفع:</label>
                <select
                  value={paymentMethod || "cash"}
                  onChange={e => {
                    const method = e.target.value;
                    onPaymentMethodChange(method);
                  }}
                  disabled={isReadOnly}
                  className="h-8 px-2 rounded border border-slate-200 bg-white font-bold text-[11px] outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70"
                >
                  <option value="cash">نقداً</option>
                  <option value="credit">آجل</option>
                  <option value="partial">جزئي</option>
                </select>
              </div>

              {paymentMethod === "partial" && onPaidAmountChange && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-1 duration-200">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-black text-blue-500 uppercase whitespace-nowrap">مدفوع الفاتورة:</label>
                    <input
                      type="number"
                      readOnly={isReadOnly}
                      value={paidAmount || "0"}
                      onChange={e => onPaidAmountChange(e.target.value)}
                      className="h-8 w-20 font-black text-xs border-blue-200 focus:ring-blue-500 bg-blue-50/30 py-0 px-2 rounded border outline-none tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  {invoiceType === "Purchase" && onExtraPaidAmountChange && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-black text-indigo-500 uppercase whitespace-nowrap">مدفوع التكاليف:</label>
                      <input
                        type="number"
                        readOnly={isReadOnly}
                        value={extraPaidAmount || "0"}
                        onChange={e => onExtraPaidAmountChange(e.target.value)}
                        className="h-8 w-20 font-black text-xs border-indigo-200 focus:ring-indigo-500 bg-indigo-50/30 py-0 px-2 rounded border outline-none tabular-nums"
                        placeholder="0"
                      />
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "partial" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase whitespace-nowrap">إجمالي المدفوع:</span>
                  <span className="text-xs font-black tabular-nums text-slate-700">
                    {formatCurrency(
                      parseFloat(paidAmount || "0") + (invoiceType === "Purchase" ? parseFloat(extraPaidAmount || "0") : 0),
                      displayCurrency
                    )}
                  </span>
                  <span className="mx-1 text-slate-300">|</span>
                  <span className={cn("text-[10px] font-black uppercase whitespace-nowrap", remaining <= 0 ? "text-emerald-600" : "text-rose-600")}>المتبقي:</span>
                  <span className={cn("text-xs font-black tabular-nums", remaining <= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(remaining, displayCurrency)}</span>
                </div>
              )}
            </div>
          )}

          {children && (
            <div className="flex items-center gap-3 border-r border-border pr-4">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, currency, color = "text-foreground" }: { label: string; value: number; currency: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-bold text-muted-foreground">{label}:</span>
      <span className={cn("text-xs font-black tabular-nums", color)}>
        {value < 0 ? "-" : ""}{formatCurrency(Math.abs(value), currency)}
      </span>
    </div>
  );
}
