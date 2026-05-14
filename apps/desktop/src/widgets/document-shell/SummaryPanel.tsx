import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';
import { type Currency } from '@modules/core/api/currencyService';
import { type DocumentStatus } from "@modules/invoicing/components/DocumentStatusBadge";

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
}

const STATUS_LABELS: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  Draft:         { label: "مسودة",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  Saved:         { label: "محفوظ",        color: "text-blue-700",  bg: "bg-blue-50 border-blue-200" },
  Posted:        { label: "مرحّل",        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Cancelled:     { label: "ملغي",         color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  PartiallyPaid: { label: "مدفوع جزئياً", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  FullyPaid:     { label: "مدفوع بالكامل", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

const CURRENCY_MAP: Record<string, string> = {
  "USD": "$", "SYP": "ل.س", "EUR": "€", "TRY": "₺",
};

export function SummaryPanel({
  subtotal, discount = 0, tax = 0, extraCosts = 0, net, paid = 0,
  currency = "ل.س", status, compact = false, invoiceType, children,
  currencies, onCurrencyChange, exchangeRate = 1, isReadOnly = false,
  paymentMethod, onPaymentMethodChange, paidAmount, onPaidAmountChange,
}: SummaryPanelProps) {
  const displayCurrency = CURRENCY_MAP[currency] || currency;
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
                    {c.name_ar} ({CURRENCY_MAP[c.code] || c.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-black text-primary">{displayCurrency}</span>
            )}
          </div>

          <div className="flex items-center gap-4 border-r border-border pr-4">
            {(invoiceType === "Purchase" || invoiceType === "Sales" || invoiceType === "OpeningBalance") && (
              <SummaryItem label="إجمالي القيمة" value={subtotal} currency={displayCurrency} />
            )}
            {invoiceType === "Purchase" && extraCosts > 0 && (
              <SummaryItem label="تكاليف اضافية" value={extraCosts} currency={displayCurrency} color="text-indigo-600" />
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
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-1 duration-200">
                  <label className="text-[10px] font-black text-blue-500 uppercase whitespace-nowrap">المدفوع:</label>
                  <input
                    type="number"
                    readOnly={isReadOnly}
                    value={paidAmount || "0"}
                    onChange={e => onPaidAmountChange(e.target.value)}
                    className="h-8 w-24 font-black text-xs border-blue-200 focus:ring-blue-500 bg-blue-50/30 py-0 px-2 rounded border outline-none tabular-nums"
                    placeholder="0.00"
                  />
                </div>
              )}

              {paymentMethod === "partial" && (
                <div className="flex items-center gap-2">
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
