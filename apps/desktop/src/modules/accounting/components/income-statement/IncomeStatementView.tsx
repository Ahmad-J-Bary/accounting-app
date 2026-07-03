import { Fragment } from "react";
import type { IncomeStatementComputed, IncomeStatementSection } from "@modules/accounting/lib/incomeStatement";

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

function ReportMeta({
  filters,
  selectedCurrencyLabel,
  lastLoadedAt,
}: Pick<IncomeStatementViewProps, "filters" | "selectedCurrencyLabel" | "lastLoadedAt">) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-sm text-slate-600">
      <span className="text-lg font-black text-slate-900">قائمة الدخل</span>
      <span className="mx-2 text-slate-300">|</span>
      <span>قائمة تبين مجمل الربح وصافي الربح والنشاط التشغيلي، وتظهر فيها تكلفة المبيعات والمصروفات التشغيلية</span>
    </div>
  );
}

function SummaryCards({
  computed,
  formatValue,
}: {
  computed: IncomeStatementComputed;
  formatValue: (value: number) => string;
}) {
  const cards = [
    { label: "إجمالي الإيرادات", value: computed.totalRevenue },
    { label: "إجمالي التكاليف", value: computed.totalLiabilities },
    { label: "مجمل الربح", value: computed.grossProfit },
    { label: "صافي الأرباح", value: computed.netProfit },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-black text-slate-400">{card.label}</div>
          <div className="mt-1 text-xl font-black tabular-nums text-slate-900">{formatValue(card.value)}</div>
        </div>
      ))}
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
  const rowSign = section.id === "trading" || section.id === "profit-loss" ? "−" : "+";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionHeader title={section.title} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm">
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
  const { computed, formatValue, filters, selectedCurrencyLabel, lastLoadedAt } = props;
  return (
    <div className="space-y-4">
      <ReportMeta filters={filters} selectedCurrencyLabel={selectedCurrencyLabel} lastLoadedAt={lastLoadedAt} />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="space-y-4">
        {computed.sections.map((section) => (
          <InlineSection key={section.id} section={section} formatValue={formatValue} />
        ))}
      </div>
    </div>
  );
}
