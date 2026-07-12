import type { PartnerStatementComputed } from "@modules/accounting/lib/partnerStatement";
import { cn } from "@shared/lib/utils";

type PartnerStatementViewProps = {
  computed: PartnerStatementComputed;
  formatValue: (value: number) => string;
};

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-black text-slate-500 border-b border-slate-200">{children}</th>;
}

function TableCell({ children, highlight, className }: { children: React.ReactNode; highlight?: boolean; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 text-sm border-b border-slate-100", highlight ? "font-bold text-slate-900" : "font-medium text-slate-700", className)}>{children}</td>;
}

export function PartnerStatementView({ computed, formatValue }: PartnerStatementViewProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50/80">
            <TableHeader>اسم الشريك</TableHeader>
            <TableHeader>مبلغ المشاركة برأس المال</TableHeader>
            <TableHeader>تراكم أرباح سنوات سابقة</TableHeader>
            <TableHeader>تراكم مسحوبات سنوات سابقة</TableHeader>
            <TableHeader>الحساب الجاري للشريك</TableHeader>
            <TableHeader>حصته من أرباح هذه السنة</TableHeader>
            <TableHeader>مسحوبات هذه السنة</TableHeader>
            <TableHeader>المبلغ النهائي</TableHeader>
          </tr>
        </thead>
        <tbody>
          {computed.rows.map((row) => (
            <tr key={row.partnerId} className="hover:bg-slate-50/50 transition-colors">
              <TableCell highlight>{row.partnerName}</TableCell>
              <TableCell>{formatValue(row.capitalAmount)}</TableCell>
              <TableCell>{formatValue(row.accumulatedProfits)}</TableCell>
              <TableCell className="text-rose-600 font-bold">{formatValue(row.accumulatedDrawings)}</TableCell>
              <TableCell highlight>{formatValue(row.currentAccount)}</TableCell>
              <TableCell className="text-emerald-600 font-bold">{formatValue(row.thisYearProfit)}</TableCell>
              <TableCell className="text-rose-600 font-bold">{formatValue(row.thisYearDrawings)}</TableCell>
              <TableCell highlight>{formatValue(row.finalAmount)}</TableCell>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/80 border-t-2 border-slate-200">
            <TableCell highlight>الإجمالي</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.capitalAmount, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.accumulatedProfits, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.accumulatedDrawings, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.currentAccount, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.thisYearProfit, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.thisYearDrawings, 0))}</TableCell>
            <TableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.finalAmount, 0))}</TableCell>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
