import type { BalanceSheetComputed, BalanceSheetRow, BalanceSheetSection } from "@modules/reports/lib/balanceSheet";
import { cn } from "@shared/lib/utils";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronLeft, Building2, Wallet, Users, Scale } from "lucide-react";
import { useState } from "react";
import { ReportMeta } from "@widgets/reports";
import { StatCard } from "@widgets/stats/StatCard";
import { useLocalization } from "@app/providers/LocalizationProvider";

type BalanceSheetViewProps = {
  computed: BalanceSheetComputed;
  filters: { from_date: string; to_date: string };
  formatValue: (value: number) => string;
};

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-base font-black text-foreground">{title}</h3>;
}

function SummaryCards({ computed, formatValue }: { computed: BalanceSheetComputed; formatValue: (value: number) => string }) {
  const isBalanced = computed.isBalanced;
  const diff = Math.abs(computed.totalAssets - computed.totalLiabilitiesEquity);
  const { t } = useLocalization();

  return (
    <div className="grid grid-cols-1 gap-2 px-4 pt-4 pb-2 md:grid-cols-2 xl:grid-cols-5">
      <StatCard label={t("balanceSheet.statTotalAssets", { namespace: "reports",  })} value={formatValue(computed.totalAssets)} icon={Building2} />
      <StatCard label={t("balanceSheet.statTotalLiabilities", { namespace: "reports",  })} value={formatValue(computed.totalLiabilities)} icon={Wallet} />
      <StatCard label={t("balanceSheet.statTotalEquity", { namespace: "reports",  })} value={formatValue(computed.totalEquity)} icon={Users} />
      <StatCard label={t("balanceSheet.statTotalLiabilitiesEquity", { namespace: "reports",  })} value={formatValue(computed.totalLiabilitiesEquity)} icon={Scale} />
      {isBalanced ? (
        <StatCard label={t("balanceSheet.statBalanced", { namespace: "reports",  })} value="" icon={CheckCircle2} variant="positive" />
      ) : (
        <StatCard label={t("balanceSheet.statUnbalanced", { namespace: "reports",  })} value={t("balanceSheet.differenceLabel", { namespace: "reports", vars: { value: formatValue(diff) } })} icon={AlertCircle} variant="negative" />
      )}
    </div>
  );
}

function TreeRow({ row, formatValue, t }: { row: BalanceSheetRow; formatValue: (value: number) => string; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = row.children && row.children.length > 0;
  const isNested = row.depth > 0;
  const displayLabel = row.label.startsWith("reports.") ? t(row.label.replace(/^reports\./, ""), { namespace: "reports" }) : row.label;

  return (
    <div className="relative">
      {isNested && (
        <div className="absolute start-0 top-1/2 w-3 h-px bg-border -translate-y-1/2 pointer-events-none" />
      )}

      <div className={cn(
        "flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors",
        isNested && "ps-5",
      )}>
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors focus:outline-none"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isNested ? <span className="w-1.5 h-1.5 rounded-full bg-border" /> : null}
          </span>
        )}
        <span className={cn("text-sm", hasChildren ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
          {displayLabel}
        </span>
        <span className="me-auto text-sm font-bold tabular-nums text-foreground">
          {formatValue(row.value)}
        </span>
      </div>

      {hasChildren && expanded && (
        <div className="relative ms-5 border-s-2 border-border">
          {row.children!.map((child, i) => (
            <TreeRow key={`${child.label}-${i}`} row={child} formatValue={formatValue} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, formatValue, t }: {
  section: BalanceSheetSection;
  formatValue: (value: number) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const sectionTitle = section.title.startsWith("reports.") ? t(section.title.replace(/^reports\./, ""), { namespace: "reports" }) : section.title;
  const totalLabel = section.totalLabel.startsWith("reports.") ? t(section.totalLabel.replace(/^reports\./, ""), { namespace: "reports" }) : section.totalLabel;
  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <SectionHeader title={sectionTitle} />
      <div className="mt-2 space-y-0.5">
        {section.rows.map((row, i) => (
          <TreeRow key={`${row.label}-${i}`} row={row} formatValue={formatValue} t={t} />
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between px-2">
        <span className="text-xs font-black text-muted-foreground">{totalLabel}</span>
        <span className="text-base font-black tabular-nums text-foreground">
          {formatValue(section.totalValue)}
        </span>
      </div>
    </section>
  );
}

function TotalRow({ label, value, formatValue, highlight, className }: {
  label: string;
  value: number;
  formatValue: (value: number) => string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between rounded-xl px-3 py-2.5",
      highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/40 border border-border",
      className,
    )}>
      <span className={cn("font-black", highlight ? "text-primary text-lg" : "text-foreground text-base")}>
        {label}
      </span>
      <span className={cn("font-black tabular-nums", highlight ? "text-primary text-xl" : "text-foreground text-lg")}>
        {formatValue(value)}
      </span>
    </div>
  );
}

export function BalanceSheetView(props: BalanceSheetViewProps) {
  const { computed, formatValue } = props;
  const { t } = useLocalization();

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title={t("balanceSheet.title", { namespace: "reports",  })} description={t("balanceSheet.metaDescription", { namespace: "reports",  })} />
      <SummaryCards computed={computed} formatValue={formatValue} />

      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 pb-4 custom-scrollbar">
        <div className="flex flex-col gap-2 h-full">
          <div className="flex-1 space-y-2">
            {computed.sections.slice(0, 1).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} t={t} />
            ))}
            {computed.sections.slice(1, 2).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} t={t} />
            ))}
          </div>
          <TotalRow label={t("balanceSheet.statTotalAssets", { namespace: "reports",  })} value={computed.totalAssets} formatValue={formatValue} highlight />
        </div>

        <div className="flex flex-col gap-2 h-full">
          <div className="flex-1 space-y-2">
            {computed.sections.slice(2, 3).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} t={t} />
            ))}
            {computed.sections.slice(3, 4).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} t={t} />
            ))}
            {computed.sections.slice(4, 5).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} t={t} />
            ))}
          </div>
          <TotalRow label={t("balanceSheet.totalLiabilitiesEquity", { namespace: "reports",  })} value={computed.totalLiabilitiesEquity} formatValue={formatValue} highlight />
        </div>
      </div>

    </div>
  );
}
