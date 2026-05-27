import { useMemo } from "react";
import { X, Hash, Pencil, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import type { PartnerDto, CurrencyDto } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { formatWithLocale } from "@app/providers/CurrencyContext";

interface PartnerViewPanelProps {
  partner: PartnerDto;
  currencies: CurrencyDto[];
  baseCurrency: CurrencyDto | null;
  formatAmount: (val: number, opts: { currencyCode: string }) => string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PartnerViewPanel({
  partner,
  currencies,
  baseCurrency,
  formatAmount,
  onClose,
  onEdit,
  onDelete,
}: PartnerViewPanelProps) {
  const amountInfo = useMemo(() => {
    const amt = Number(partner.amount_original || 0);
    const curr = currencies.find(c => c.code === partner.currency) || baseCurrency;
    const formatted = `${amt.toLocaleString("ar-SA", { maximumFractionDigits: curr?.decimals ?? 2 })} ${curr?.symbol || partner.currency || ""}`;
    return { formatted, amt };
  }, [partner, currencies, baseCurrency]);

  return (
    <div className="flex flex-col h-full bg-white" dir="rtl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50 shrink-0">
        <div className="flex flex-col gap-1 text-right">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {partner.name}
            <span className="text-xs font-normal text-muted-foreground bg-white border px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Hash className="w-3 h-3" /> {partner.code}
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">ملف الشريك</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ display: "flex", flexDirection: "column", gap: "var(--sidebar-content-gap)", padding: "var(--sidebar-container-py) var(--sidebar-container-px)" }}>
        <div className="space-y-3 text-right p-5 border border-slate-100 rounded-2xl bg-slate-50/30">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">معلومات الاستثمار</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{`المبلغ الأصلي (${partner.currency || baseCurrency?.code || ""})`}</div>
              <div className="text-lg font-black text-blue-600 tabular-nums">{amountInfo.formatted}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{`المبلغ (${baseCurrency?.symbol || ""})`}</div>
              <div className="text-lg font-black text-slate-900 tabular-nums">
                {formatAmount(Number((partner as any).displayAmountLocal || 0), { currencyCode: baseCurrency?.code || "" })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">نسبة رأس المال</div>
              <div className="text-sm font-black text-blue-700 tabular-nums">{(partner as any).calculatedCapitalRatio?.toFixed(2) || "0.00"}%</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">نسبة الأرباح</div>
              <div className="text-sm font-black text-emerald-700 tabular-nums">{(partner as any).calculatedRatio?.toFixed(2) || "0.00"}%</div>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-border bg-slate-50/50 shrink-0">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-amber-500 text-white hover:bg-amber-600 border-none h-10"
            onClick={onEdit}
          >
            <Pencil className="w-4 h-4 ml-2" /> تعديل
          </Button>
          <Button
            variant="outline"
            className="flex-1 bg-red-500 text-white hover:bg-red-600 border-none h-10"
            onClick={() => {
              if (confirm("هل أنت متأكد من حذف هذا الشريك؟")) onDelete();
            }}
          >
            <Trash2 className="w-4 h-4 ml-2" /> حذف
          </Button>
        </div>
      </div>
    </div>
  );
}
