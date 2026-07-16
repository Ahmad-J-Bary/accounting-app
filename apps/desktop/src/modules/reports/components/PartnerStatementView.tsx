import type { PartnerStatementComputed } from "@modules/reports/lib/partnerStatement";
import { ReportTableHeader, ReportTableCell } from "@widgets/table-shell/ReportTableCells";
import { ReportTableWrapper } from "@widgets/table-shell/ReportTableWrapper";

type PartnerStatementViewProps = {
  computed: PartnerStatementComputed;
  formatValue: (value: number) => string;
};

export function PartnerStatementView({ computed, formatValue }: PartnerStatementViewProps) {
  return (
    <ReportTableWrapper>
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50/80">
            <ReportTableHeader>اسم الشريك</ReportTableHeader>
            <ReportTableHeader>مبلغ المشاركة برأس المال</ReportTableHeader>
            <ReportTableHeader>تراكم أرباح سنوات سابقة</ReportTableHeader>
            <ReportTableHeader>تراكم مسحوبات سنوات سابقة</ReportTableHeader>
            <ReportTableHeader>الحساب الجاري للشريك</ReportTableHeader>
            <ReportTableHeader>حصته من أرباح هذه السنة</ReportTableHeader>
            <ReportTableHeader>مسحوبات هذه السنة</ReportTableHeader>
            <ReportTableHeader>المبلغ النهائي</ReportTableHeader>
          </tr>
        </thead>
        <tbody>
          {computed.rows.map((row) => (
            <tr key={row.partnerId} className="hover:bg-slate-50/50 transition-colors">
              <ReportTableCell highlight>{row.partnerName}</ReportTableCell>
              <ReportTableCell>{formatValue(row.capitalAmount)}</ReportTableCell>
              <ReportTableCell>{formatValue(row.accumulatedProfits)}</ReportTableCell>
              <ReportTableCell className="text-rose-600 font-bold">{formatValue(row.accumulatedDrawings)}</ReportTableCell>
              <ReportTableCell highlight>{formatValue(row.currentAccount)}</ReportTableCell>
              <ReportTableCell className="text-emerald-600 font-bold">{formatValue(row.thisYearProfit)}</ReportTableCell>
              <ReportTableCell className="text-rose-600 font-bold">{formatValue(row.thisYearDrawings)}</ReportTableCell>
              <ReportTableCell highlight>{formatValue(row.finalAmount)}</ReportTableCell>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50/80 border-t-2 border-slate-200">
            <ReportTableCell highlight>الإجمالي</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.capitalAmount, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.accumulatedProfits, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.accumulatedDrawings, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.currentAccount, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.thisYearProfit, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.thisYearDrawings, 0))}</ReportTableCell>
            <ReportTableCell highlight>{formatValue(computed.rows.reduce((s, r) => s + r.finalAmount, 0))}</ReportTableCell>
          </tr>
        </tfoot>
      </table>
    </ReportTableWrapper>
  );
}
