import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type DocStatus = "Draft" | "Posted" | "Cancelled" | "PartiallyPaid" | "Paid";

interface SummaryPanelProps {
  subtotal: number;
  discount?: number;
  tax?: number;
  extraCosts?: number;
  net: number;
  paid?: number;
  currency?: string;
  status?: DocStatus;
  compact?: boolean;
}

const STATUS_LABELS: Record<DocStatus, { label: string; color: string; bg: string }> = {
  Draft:         { label: "مسودة",        color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  Posted:        { label: "مرحّل",        color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  Cancelled:     { label: "ملغي",         color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  PartiallyPaid: { label: "مدفوع جزئياً", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  Paid:          { label: "مدفوع بالكامل", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
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
}: SummaryPanelProps) {
  const remaining = Math.max(net - paid, 0);
  const st = status ? STATUS_LABELS[status] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ملخص المستند</span>
        {st && (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", st.color, st.bg)}>
            {st.label}
          </span>
        )}
      </div>

      {/* Breakdown rows */}
      <div className="px-3 py-2.5 space-y-1.5">
        <SummaryRow label="المجموع الفرعي" value={subtotal} />
        {discount > 0 && <SummaryRow label="الخصم" value={-discount} valueClass="text-red-600" />}
        {tax > 0 && <SummaryRow label="الضريبة / الرسوم" value={tax} valueClass="text-orange-600" />}
        {extraCosts > 0 && <SummaryRow label="تكاليف إضافية" value={extraCosts} />}
      </div>

      {/* NET — prominent */}
      <div className="mx-3 mb-2.5 bg-gradient-to-l from-blue-600 to-blue-700 rounded-lg px-3 py-2.5 text-white">
        <div className="text-[10px] font-medium opacity-75 mb-0.5">الصافي النهائي</div>
        <div className="flex items-baseline gap-2">
          <span className={cn("tabular-nums font-black", compact ? "text-xl" : "text-2xl")}>
            {formatCurrency(net)}
          </span>
          <span className="text-xs opacity-60">{currency}</span>
        </div>
      </div>

      {/* Paid / Remaining */}
      {(paid > 0 || remaining > 0) && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
            <div className="text-[10px] text-green-600 font-bold mb-0.5">المدفوع</div>
            <div className="text-sm font-black text-green-700 tabular-nums">{formatCurrency(paid)}</div>
          </div>
          <div className={cn(
            "rounded-lg p-2 text-center border",
            remaining <= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
          )}>
            <div className={cn("text-[10px] font-bold mb-0.5", remaining <= 0 ? "text-green-600" : "text-red-600")}>
              المتبقي
            </div>
            <div className={cn("text-sm font-black tabular-nums", remaining <= 0 ? "text-green-700" : "text-red-700")}>
              {formatCurrency(remaining)}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts reminder */}
      <div className="px-3 pb-2.5 space-y-1">
        {[
          ["Tab / Enter", "انتقال بين الخلايا"],
          ["↑ ↓", "التنقل بين الصفوف"],
          ["Ctrl+Del", "حذف السطر"],
          ["Insert", "تكرار السطر"],
        ].map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between text-[10px] text-slate-400">
            <span>{desc}</span>
            <kbd className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-500">{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass = "text-slate-800",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn("tabular-nums font-semibold", valueClass)}>
        {value < 0 ? "-" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
