import type { PartnerProfitShareComputed } from "@modules/accounting/lib/partnerProfitShare";
import { cn } from "@shared/lib/utils";
import { Users, TrendingUp, Package, CreditCard } from "lucide-react";

type PartnerProfitShareViewProps = {
  computed: PartnerProfitShareComputed;
  formatValue: (value: number) => string;
};

const summaryCards = [
  { label: "رأس المال", key: "totalCapital" as const, icon: Users, color: "text-blue-700", bg: "bg-blue-50" },
  { label: "صافي الأرباح", key: "netProfit" as const, icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-50" },
  { label: "قيمة البضاعة المتوفرة حاليا", key: "inventoryValue" as const, icon: Package, color: "text-amber-700", bg: "bg-amber-50" },
  { label: "مجموع الدين المترتبة على العملاء", key: "totalCustomerDebts" as const, icon: CreditCard, color: "text-rose-700", bg: "bg-rose-50" },
];

function SummaryCards({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm")}>
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                <Icon className={cn("w-5 h-5", card.color)} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{card.label}</div>
                <div className={cn("mt-0.5 text-lg font-black tabular-nums", card.color)}>
                  {formatValue(computed[card.key])}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-black text-slate-500 border-b border-slate-200">{children}</th>;
}

function TableCell({ children, highlight, className }: { children: React.ReactNode; highlight?: boolean; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 text-sm border-b border-slate-100", highlight ? "font-bold text-slate-900" : "font-medium text-slate-700", className)}>{children}</td>;
}

function PartnerTable({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50/80">
            <TableHeader>اسم الشريك</TableHeader>
            <TableHeader>نسبة المشاركة برأس المال</TableHeader>
            <TableHeader>المبلغ المشارك به في رأس المال</TableHeader>
            <TableHeader>نسبة تقاسم الأرباح</TableHeader>
            <TableHeader>حصته من الأرباح</TableHeader>
            <TableHeader>المسحوبات</TableHeader>
            <TableHeader>المبلغ النهائي للشريك</TableHeader>
            <TableHeader>حصته من البضاعة المتوفرة</TableHeader>
          </tr>
        </thead>
        <tbody>
          {computed.rows.map((row) => (
            <tr key={row.partnerId} className="hover:bg-slate-50/50 transition-colors">
              <TableCell highlight>{row.partnerName}</TableCell>
              <TableCell>{row.capitalRatio.toFixed(2)}%</TableCell>
              <TableCell>{formatValue(row.capitalAmount)}</TableCell>
              <TableCell>{row.profitShareRatio.toFixed(2)}%</TableCell>
              <TableCell>{formatValue(row.profitShareAmount)}</TableCell>
              <TableCell className="text-rose-600 font-bold">{formatValue(row.drawings)}</TableCell>
              <TableCell highlight>{formatValue(row.finalAmount)}</TableCell>
              <TableCell>{formatValue(row.inventoryShare)}</TableCell>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/80 border-t-2 border-slate-200">
            <TableCell highlight>الإجمالي</TableCell>
            <TableCell highlight>{computed.rows.reduce((s, r) => s + r.capitalRatio, 0).toFixed(2)}%</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.capitalAmount, 0))}</TableCell>
            <TableCell highlight>-</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.profitShareAmount, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.drawings, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.finalAmount, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.inventoryShare, 0))}</TableCell>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function PartnerProfitShareView(props: PartnerProfitShareViewProps) {
  const { computed, formatValue } = props;

  return (
    <div className="space-y-6">
      <SummaryCards computed={computed} formatValue={formatValue} />
      <PartnerTable computed={computed} formatValue={formatValue} />
    </div>
  );
}
