import type { IncomeStatementComputed, IncomeStatementSection, IncomeStatementStyle } from "@modules/accounting/lib/incomeStatement";

type IncomeStatementViewProps = {
  computed: IncomeStatementComputed;
  style: IncomeStatementStyle;
  filters: {
    from_date: string;
    to_date: string;
  };
  selectedCurrencyLabel: string;
  lastLoadedAt: Date | null;
  formatValue: (value: number) => string;
};

function SectionHeader({ title, formula }: { title: string; formula: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      <p className="text-xs font-medium leading-6 text-slate-500">{formula}</p>
    </div>
  );
}

function ReportMeta({
  filters,
  selectedCurrencyLabel,
  lastLoadedAt,
}: Pick<IncomeStatementViewProps, "filters" | "selectedCurrencyLabel" | "lastLoadedAt">) {
  return (
    <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-right text-sm text-slate-600 sm:p-5">
      <div className="text-lg font-black text-slate-900">قائمة الدخل</div>
      <div>قائمة تبين مجمل الربح وصافي الربح المحقق، ويظهر فيها حساب المتاجرة وحساب الأرباح والخسائر.</div>
      <div>الفترة من {filters.from_date} إلى {filters.to_date}</div>
      <div>العملة: {selectedCurrencyLabel}</div>
      <div>آخر تحديث: {lastLoadedAt ? lastLoadedAt.toLocaleString("ar-SA") : "—"}</div>
    </div>
  );
}

function LedgerLine({
  label,
  value,
  bold = false,
  indent = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div className="grid gap-1.5 py-2 text-sm sm:grid-cols-[minmax(180px,220px)_1fr] sm:items-baseline sm:gap-8 sm:text-[15px]">
      <div className={`text-right tabular-nums sm:text-left ${bold ? "font-black text-slate-900" : "font-semibold text-slate-800"}`}>
        {value}
      </div>
      <div className={`${indent ? "pr-8" : ""} ${bold ? "font-black text-slate-900" : "font-medium text-slate-800"}`}>
        {label}
      </div>
    </div>
  );
}

function LedgerDivider({ label = "إجمالي" }: { label?: string }) {
  return (
    <div className="py-2 text-center text-sm font-bold tracking-[0.2em] text-slate-400">
      {label}
    </div>
  );
}

function LedgerSection({
  section,
  formatValue,
}: {
  section: IncomeStatementSection;
  formatValue: (value: number) => string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <SectionHeader title={section.title} formula={section.formula} />
      <div className="mt-5">
        {section.rows.map((row) => (
          <LedgerLine key={row.label} label={row.label} value={formatValue(row.value)} indent />
        ))}
        <LedgerDivider />
        <LedgerLine label={section.totalLabel} value={formatValue(section.totalValue)} bold />
      </div>
    </section>
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
    { label: "إجمالي الخصوم", value: computed.totalLiabilities },
    { label: "إجمالي الأرباح", value: computed.grossProfit },
    { label: "صافي الأرباح", value: computed.netProfit },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-black text-slate-400">{card.label}</div>
          <div className="mt-3 text-2xl font-black text-slate-900">{formatValue(card.value)}</div>
        </div>
      ))}
    </div>
  );
}

function IncomeStatementLedgerView(props: IncomeStatementViewProps) {
  const { computed, formatValue, filters, selectedCurrencyLabel, lastLoadedAt } = props;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 font-mono text-[15px] leading-8 text-slate-900">
      <ReportMeta filters={filters} selectedCurrencyLabel={selectedCurrencyLabel} lastLoadedAt={lastLoadedAt} />
      <div className="hidden grid-cols-[minmax(180px,220px)_1fr] gap-8 text-sm font-black text-slate-700 sm:grid">
        <div className="text-left">القيمة</div>
        <div className="text-right">البيان</div>
      </div>
      {computed.sections.map((section) => (
        <LedgerSection key={section.id} section={section} formatValue={formatValue} />
      ))}
    </div>
  );
}

function IncomeStatementTableView(props: IncomeStatementViewProps) {
  const { computed, formatValue, filters, selectedCurrencyLabel, lastLoadedAt } = props;
  return (
    <div className="space-y-6">
      <ReportMeta filters={filters} selectedCurrencyLabel={selectedCurrencyLabel} lastLoadedAt={lastLoadedAt} />
      {computed.sections.map((section) => (
        <section key={section.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <SectionHeader title={section.title} formula={section.formula} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-right font-black text-slate-500">البيان</th>
                  <th className="px-6 py-3 text-left font-black text-slate-500">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.label}</td>
                    <td className="px-6 py-4 text-left font-semibold tabular-nums text-slate-900">{formatValue(row.value)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-6 py-4 font-black text-slate-900">{section.totalLabel}</td>
                  <td className="px-6 py-4 text-left font-black tabular-nums text-slate-900">{formatValue(section.totalValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function IncomeStatementCardsView(props: IncomeStatementViewProps) {
  const { computed, formatValue, filters, selectedCurrencyLabel, lastLoadedAt } = props;
  return (
    <div className="space-y-6">
      <ReportMeta filters={filters} selectedCurrencyLabel={selectedCurrencyLabel} lastLoadedAt={lastLoadedAt} />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {computed.sections.map((section) => (
          <section key={section.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <SectionHeader title={section.title} formula={section.formula} />
            <div className="mt-6 space-y-3">
              {section.rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-2 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="font-black tabular-nums text-slate-900 sm:text-left">{formatValue(row.value)}</span>
                </div>
              ))}
              <div className="flex flex-col gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                <span className="font-black">{section.totalLabel}</span>
                <span className="font-black tabular-nums sm:text-left">{formatValue(section.totalValue)}</span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CompactSectionRow({
  section,
  formatValue,
}: {
  section: IncomeStatementSection;
  formatValue: (value: number) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="text-right">
          <div className="text-base font-black text-slate-900">{section.title}</div>
          <div className="mt-1 text-sm leading-7 text-slate-500">{section.formula}</div>
          <div className="mt-3 text-sm leading-7 text-slate-700">
            {section.rows.map((row) => row.label).join(" | ")}
          </div>
        </div>
        <div className="text-right lg:min-w-[220px] lg:text-left">
          <div className="text-xs font-black text-slate-400">{section.totalLabel}</div>
          <div className="mt-2 text-2xl font-black tabular-nums text-slate-900">{formatValue(section.totalValue)}</div>
        </div>
      </div>
    </div>
  );
}

function IncomeStatementCompactView(props: IncomeStatementViewProps) {
  const { computed, formatValue, filters, selectedCurrencyLabel, lastLoadedAt } = props;
  return (
    <div className="space-y-5">
      <ReportMeta filters={filters} selectedCurrencyLabel={selectedCurrencyLabel} lastLoadedAt={lastLoadedAt} />
      {computed.sections.map((section) => (
        <CompactSectionRow key={section.id} section={section} formatValue={formatValue} />
      ))}
    </div>
  );
}

export function IncomeStatementView(props: IncomeStatementViewProps) {
  switch (props.style) {
    case "table":
      return <IncomeStatementTableView {...props} />;
    case "cards":
      return <IncomeStatementCardsView {...props} />;
    case "compact":
      return <IncomeStatementCompactView {...props} />;
    case "ledger":
    default:
      return <IncomeStatementLedgerView {...props} />;
  }
}
