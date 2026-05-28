import { Pencil, Trash2 } from "lucide-react";
import type { PartnerDto } from "@erp/shared-types";
import type { Currency } from "@modules/core/api/currencyService";
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

type PartnerWithRatios = PartnerDto & {
  calculatedRatio: number;
  calculatedCapitalRatio: number;
  displayAmountBase: number;
};

interface PartnerDetailViewProps {
  partner: PartnerWithRatios;
  baseCurrency: Currency | null;
  currencies: Currency[];
  formatAmount: (val: number, opts: { currencyCode: string }) => string;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function PartnerDetailView({
  partner,
  baseCurrency,
  currencies,
  onEdit,
  onDelete,
  onClose,
}: PartnerDetailViewProps) {
  const { formatAmount } = useCurrencyContext();
  const actions: SidebarAction[] = [
    ...(onEdit
      ? [
          {
            label: "تعديل",
            icon: <Pencil className="w-4 h-4" />,
            variant: "warning" as const,
            onClick: () => onEdit(),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "حذف",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => {
              if (confirm("هل أنت متأكد من حذف هذا الشريك؟")) {
                onDelete(partner.id);
              }
            },
          },
        ]
      : []),
  ];

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader
        title={partner.name}
        subtitle={`${partner.code} · ملف الشريك`}
        onClose={onClose}
      />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="text-right space-y-6">
          <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/30">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-4">
              معلومات الاستثمار
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {currencies.map(curr => (
                <div key={curr.code} className="p-3 bg-white rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                    {`المبلغ (${curr.symbol || curr.code})`}
                  </div>
                  <div className="text-lg font-black text-slate-900 tabular-nums">
                    {formatAmount(partner.displayAmountBase, { currencyCode: curr.code })}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  نسبة رأس المال
                </div>
                <div className="text-sm font-black text-blue-700 tabular-nums">
                  {partner.calculatedCapitalRatio?.toFixed(2) || "0.00"}%
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                  نسبة الأرباح
                </div>
                <div className="text-sm font-black text-emerald-700 tabular-nums">
                  {partner.calculatedRatio?.toFixed(2) || "0.00"}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}