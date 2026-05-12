import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/lib/utils';

import { DocumentStatus } from "@modules/invoicing/components/DocumentStatusBadge";

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
}

const STATUS_LABELS: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  Draft:         { label: "مسودة",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  Saved:         { label: "محفوظ",        color: "text-blue-700",  bg: "bg-blue-50 border-blue-200" },
  Posted:        { label: "مرحّل",        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Cancelled:     { label: "ملغي",         color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  PartiallyPaid: { label: "مدفوع جزئياً", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  FullyPaid:     { label: "مدفوع بالكامل", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
};

export function SummaryPanel({
  subtotal,
  discount = 0,
  tax = 0,
  extraCosts = 0,
  net,
  paid = 0,
  currency = "ل.س",
  status,
  compact = false,
  invoiceType,
  children,
}: SummaryPanelProps) {
  const remaining = Math.max(net - paid, 0);
  const st = status ? STATUS_LABELS[status] : null;

  return (
    <div className="bg-slate-900 text-white rounded-lg overflow-hidden shadow-lg border border-slate-800" dir="rtl">
      <div className="flex items-center divide-x divide-x-reverse divide-slate-800">
        
        {/* 1. Status Section (Optional) */}
        {st && (
          <div className="px-4 py-2 bg-slate-800/50 flex items-center shrink-0">
            <span className={cn("text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter", st.color, st.bg)}>
              {st.label}
            </span>
          </div>
        )}

        {/* 2. Breakdown Section (Subtotal, Discount, etc) */}
        <div className="flex-1 flex items-center gap-6 px-4 py-2 overflow-x-auto no-scrollbar">
          <SummaryItem label="المجموع" value={subtotal} currency={currency} />
          {discount > 0 && <SummaryItem label="الخصم" value={-discount} currency={currency} color="text-red-400" />}
          {tax > 0 && <SummaryItem label="الضريبة" value={tax} currency={currency} color="text-orange-400" />}
          {extraCosts > 0 && <SummaryItem label="تكاليف" value={extraCosts} currency={currency} />}
          
          {children && (
            <div className="flex items-center gap-4 border-r border-slate-800 pr-4 mr-2 h-6">
              {children}
            </div>
          )}
        </div>

        {/* 3. Main Total (NET) */}
        <div className="bg-blue-600 px-6 py-2 flex flex-col items-center justify-center min-w-[160px] shrink-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-100 opacity-70">الصافي النهائي</span>
          <span className={cn("tabular-nums font-black leading-none", compact ? "text-xl" : "text-2xl")}>
            {formatCurrency(net, currency)}
          </span>
        </div>

        {/* 4. Payment Info (Paid/Remaining) */}
        {(paid > 0 || remaining > 0) && (
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/30 shrink-0">
            <div className="flex flex-col items-start">
              <span className="text-[8px] font-bold text-slate-400">المدفوع</span>
              <span className="text-xs font-black tabular-nums text-slate-200">{formatCurrency(paid, currency)}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-start">
              <span className={cn("text-[8px] font-bold", remaining <= 0 ? "text-emerald-400" : "text-red-400")}>
                {invoiceType === "Sales" ? "مدين" : invoiceType === "Purchase" ? "دائن" : "المتبقي"}
              </span>
              <span className={cn("text-xs font-black tabular-nums", remaining <= 0 ? "text-emerald-300" : "text-red-300")}>
                {formatCurrency(remaining, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value, currency, color = "text-slate-300" }: { label: string; value: number; currency: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">{label}:</span>
      <span className={cn("text-xs font-black tabular-nums", color)}>
        {value < 0 ? "-" : ""}
        {formatCurrency(Math.abs(value), currency)}
      </span>
    </div>
  );
}
