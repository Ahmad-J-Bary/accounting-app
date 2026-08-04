import { Fragment } from "react";
import type { IncomeStatementComputed, IncomeStatementSection } from "@modules/reports/lib/incomeStatement";
import { ReportMeta } from "@widgets/reports";
import { TrendingUp, TrendingDown, Coins, BarChart3 } from "lucide-react";
import { StatCard } from "@widgets/stats/StatCard";

type IncomeStatementViewProps = {
  computed: IncomeStatementComputed;
  filters: {
    from_date: string;
    to_date: string;
  };
  selectedCurrencyLabel: string;
  lastLoadedAt: Date | null;
  formatValue: (value: number) => string;
};

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-base font-black text-slate-900">{title}</h3>;
}

function SummaryCards({
  computed,
  formatValue,
}: {
  computed: IncomeStatementComputed;
  formatValue: (value: number) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 pt-4 pb-2 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="إجمالي الإيرادات" value={formatValue(computed.totalRevenue)} icon={TrendingUp} />
      <StatCard label="إجمالي التكاليف" value={formatValue(computed.totalLiabilities)} icon={TrendingDown} />
      <StatCard label="إجمالي الأرباح" value={formatValue(computed.grossProfit)} icon={Coins} />
      <StatCard label="صافي الأرباح" value={formatValue(computed.netProfit)} icon={BarChart3} variant={computed.netProfit >= 0 ? "positive" : "negative"} />
    </div>
  );
}

function TermBox({
  label,
  value,
  variant = "normal",
}: {
  label: string;
  value: string;
  variant?: "normal" | "total";
}) {
  return (
    <div className={`flex min-w-[120px] flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-2 shadow-sm ${variant === "total" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <span className={`text-center text-sm font-black leading-relaxed ${variant === "total" ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </span>
      <span className={`font-black tabular-nums leading-none ${variant === "total" ? "text-xl text-white" : "text-lg text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

function OperatorSign({ sign }: { sign: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xl font-black text-amber-600 ring-2 ring-amber-300">
      {sign}
    </span>
  );
}

function InlineSection({
  section,
  formatValue,
}: {
  section: IncomeStatementSection;
  formatValue: (value: number) => string;
}) {
  const rowSign = section.id === "trading" || section.id === "profit-loss" ? "-" : "+";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <SectionHeader title={section.title} />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
        {section.rows.map((row, idx) => {
          const isLast = idx === section.rows.length - 1;
          return (
            <Fragment key={row.label}>
              <TermBox label={row.label} value={formatValue(row.value)} />
              <OperatorSign sign={isLast ? "=" : rowSign} />
            </Fragment>
          );
        })}
        <TermBox label={section.totalLabel} value={formatValue(section.totalValue)} variant="total" />
      </div>
    </section>
  );
}

export function IncomeStatementView(props: IncomeStatementViewProps) {
  const { computed, formatValue } = props;
  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="قائمة الدخل" description="قائمة تبين إجمالي الأرباح وصافي الربح والنشاط التشغيلي، وتظهر فيها تكلفة المبيعات والمصروفات التشغيلية" />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-4 pb-4 custom-scrollbar">
        {computed.sections.map((section) => (
          <InlineSection key={section.id} section={section} formatValue={formatValue} />
        ))}
      </div>
    </div>
  );
}
