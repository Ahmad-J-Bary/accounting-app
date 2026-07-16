import type { PartnerProfitShareComputed } from "@modules/reports/lib/partnerProfitShare";
import { cn } from "@shared/lib/utils";
import { Users, TrendingUp, Package, CreditCard } from "lucide-react";
import { ReportTableHeader, ReportTableCell } from "@widgets/table-shell/ReportTableCells";
import { ReportTableWrapper } from "@widgets/table-shell/ReportTableWrapper";

type PartnerProfitShareViewProps = {
  computed: PartnerProfitShareComputed;
  formatValue: (value: number) => string;
};

const summaryCards = [
  { label: "رأس المال", key: "totalCapital" as const, icon: Users, color: "text-blue-700", bg: "bg-blue-50" },
  { label: "صافي الأرباح", key: "netProfit" as const, icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-50" },
  { label: "قيمة البضاعة المتوفرة حاليا", key: "inventoryValue" as const, icon: Package, color: "text-amber-700", bg: "bg-amber-50" },
  { label: "مجموع الدين المترتبة على العملاء", key: "totalCustomerDebts" as const, icon: CreditCard, color: "text-rose-700", bg: "bg-rose-50" },
  { label: "صافي الأصول الثابتة", key: "fixedAssetsValue" as const, icon: Package, color: "text-violet-700", bg: "bg-violet-50" },
  { label: "إجمالي الأصول التشغيلية", key: "totalOperationalAssets" as const, icon: TrendingUp, color: "text-slate-700", bg: "bg-slate-100" },
];

function SummaryCards({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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

function PartnerTable({ computed, formatValue }: { computed: PartnerProfitShareComputed; formatValue: (value: number) => string }) {
  return (
    <ReportTableWrapper>
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50/80">
            <ReportTableHeader>اسم الشريك</ReportTableHeader>
            <ReportTableHeader>نسبة المشاركة برأس المال</ReportTableHeader>
            <ReportTableHeader>المبلغ المشارك به في رأس المال</ReportTableHeader>
            <ReportTableHeader>نسبة تقاسم الأرباح</ReportTableHeader>
            <ReportTableHeader>حصته من الأرباح</ReportTableHeader>
            <ReportTableHeader>المسحوبات</ReportTableHeader>
            <ReportTableHeader>المبلغ النهائي للشريك</ReportTableHeader>
            <ReportTableHeader>حصته من البضاعة المتوفرة</ReportTableHeader>
            <ReportTableHeader>حصته من الأصول الثابتة</ReportTableHeader>
            <ReportTableHeader>حصته من الأصول التشغيلية</ReportTableHeader>
          </tr>
        </thead>
        <tbody>
          {computed.rows.map((row) => (
            <tr key={row.partnerId} className="hover:bg-slate-50/50 transition-colors">
              <ReportTableCell highlight>{row.partnerName}</ReportTableCell>
              <ReportTableCell>{row.capitalRatio.toFixed(2)}%</ReportTableCell>
              <ReportTableCell>{formatValue(row.capitalAmount)}</ReportTableCell>
              <ReportTableCell>{row.profitShareRatio.toFixed(2)}%</ReportTableCell>
              <ReportTableCell>{formatValue(row.profitShareAmount)}</ReportTableCell>
              <ReportTableCell className="text-rose-600 font-bold">{formatValue(row.drawings)}</ReportTableCell>
              <ReportTableCell highlight>{formatValue(row.finalAmount)}</ReportTableCell>
              <ReportTableCell>{formatValue(row.inventoryShare)}</ReportTableCell>
              <ReportTableCell>{formatValue(row.fixedAssetsShare)}</ReportTableCell>
              <ReportTableCell highlight>{formatValue(row.operationalAssetShare)}</ReportTableCell>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/80 border-t-2 border-slate-200">
            <ReportTableCell highlight>الإجمالي</ReportTableCell>
            <ReportTableCell highlight>{computed.rows.reduce((s, r) => s + r.capitalRatio, 0).toFixed(2)}%</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.capitalAmount, 0))}</ReportTableCell>
            <ReportTableCell highlight>-</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.profitShareAmount, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.drawings, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.finalAmount, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.inventoryShare, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.fixedAssetsShare, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.operationalAssetShare, 0))}</ReportTableCell>
          </tr>
        </tfoot>
      </table>
    </ReportTableWrapper>
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
