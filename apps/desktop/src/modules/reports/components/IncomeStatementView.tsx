import { Fragment } from "react";
import type { IncomeStatementComputed, IncomeStatementSection } from "@modules/reports/lib/incomeStatement";
import { ReportMeta } from "@widgets/reports";
import { TrendingUp, TrendingDown, Coins, BarChart3 } from "lucide-react";
import { StatCard } from "@widgets/stats/StatCard";
import { useLocalization } from "@app/providers/LocalizationProvider";

type IncomeStatementViewProps = {
  computed: IncomeStatementComputed;
  filters: {
    from_date: string;
    to_date: string;
  };
  selectedCurrencyLabel: string;
  formatValue: (value: number) => string;
};

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-base font-black text-foreground">{title}</h3>;
}

function SummaryCards({
  computed,
  formatValue,
}: {
  computed: IncomeStatementComputed;
  formatValue: (value: number) => string;
}) {
  const { t } = useLocalization();
  return (
    <div className="grid grid-cols-1 gap-2 px-4 pt-4 pb-2 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label={t("incomeStatement.statTotalRevenue", { namespace: "reports",  })} value={formatValue(computed.totalRevenue)} icon={TrendingUp} />
      <StatCard label={t("incomeStatement.statTotalCosts", { namespace: "reports",  })} value={formatValue(computed.totalLiabilities)} icon={TrendingDown} />
      <StatCard label={t("incomeStatement.statTotalProfit", { namespace: "reports",  })} value={formatValue(computed.grossProfit)} icon={Coins} />
      <StatCard label={t("incomeStatement.statNetProfit", { namespace: "reports",  })} value={formatValue(computed.netProfit)} icon={BarChart3} variant={computed.netProfit >= 0 ? "positive" : "negative"} />
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
    <div className={`flex min-w-[120px] flex-col items-center gap-1.5 rounded-xl border px-4 py-2 shadow-sm ${variant === "total" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
      <span className={`text-center text-sm font-black leading-relaxed ${variant === "total" ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
        {label}
      </span>
      <span className={`font-black tabular-nums leading-none ${variant === "total" ? "text-xl text-primary-foreground" : "text-lg text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function OperatorSign({ sign }: { sign: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-xl font-black text-warning border border-warning/30">
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
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
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
  const { t } = useLocalization();
  return (
    <div className="flex flex-col h-full">
      <ReportMeta title={t("incomeStatement.title", { namespace: "reports",  })} description={t("incomeStatement.metaDescription", { namespace: "reports",  })} />
      <SummaryCards computed={computed} formatValue={formatValue} />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-4 pb-4 custom-scrollbar">
        {computed.sections.map((section) => (
          <InlineSection key={section.id} section={section} formatValue={formatValue} />
        ))}
      </div>
    </div>
  );
}
