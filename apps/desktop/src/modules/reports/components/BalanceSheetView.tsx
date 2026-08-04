import type { BalanceSheetComputed, BalanceSheetRow, BalanceSheetSection } from "@modules/reports/lib/balanceSheet";
import { cn } from "@shared/lib/utils";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronLeft, Building2, Wallet, Users, Scale } from "lucide-react";
import { useState } from "react";
import { ReportMeta } from "@widgets/reports";
import { StatCard } from "@widgets/stats/StatCard";

type BalanceSheetViewProps = {
  computed: BalanceSheetComputed;
  filters: { from_date: string; to_date: string };
  formatValue: (value: number) => string;
};

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-base font-black text-slate-900">{title}</h3>;
}

function SummaryCards({ computed, formatValue }: { computed: BalanceSheetComputed; formatValue: (value: number) => string }) {
  const isBalanced = computed.isBalanced;
  const diff = Math.abs(computed.totalAssets - computed.totalLiabilitiesEquity);

  return (
    <div className="grid grid-cols-1 gap-2 px-4 pt-4 pb-2 md:grid-cols-2 xl:grid-cols-5">
      <StatCard label="إجمالي الأصول" value={formatValue(computed.totalAssets)} icon={Building2} />
      <StatCard label="إجمالي الخصوم" value={formatValue(computed.totalLiabilities)} icon={Wallet} />
      <StatCard label="حقوق الملكية" value={formatValue(computed.totalEquity)} icon={Users} />
      <StatCard label="الخصوم + حقوق الملكية" value={formatValue(computed.totalLiabilitiesEquity)} icon={Scale} />
      {isBalanced ? (
        <StatCard label="الميزانية متوازنة" value="" icon={CheckCircle2} variant="positive" />
      ) : (
        <StatCard label="الميزانية غير متوازنة" value={`فرق ${formatValue(diff)}`} icon={AlertCircle} variant="negative" />
      )}
    </div>
  );
}

function TreeRow({ row, formatValue }: { row: BalanceSheetRow; formatValue: (value: number) => string }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = row.children && row.children.length > 0;
  const isNested = row.depth > 0;

  return (
    <div className="relative">
      {isNested && (
        <div className="absolute start-0 top-1/2 w-3 h-px bg-slate-300 -translate-y-1/2 pointer-events-none" />
      )}

      <div className={cn(
        "flex items-center gap-1.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors",
        isNested && "ps-5",
      )}>
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors focus:outline-none"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isNested ? <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> : null}
          </span>
        )}
        <span className={cn("text-sm", hasChildren ? "font-bold text-slate-800" : "font-medium text-slate-700")}>
          {row.label}
        </span>
        <span className="mr-auto text-sm font-bold tabular-nums text-slate-900">
          {formatValue(row.value)}
        </span>
      </div>

      {hasChildren && expanded && (
        <div className="relative ms-5 border-s-2 border-slate-200/80">
          {row.children!.map((child, i) => (
            <TreeRow key={`${child.label}-${i}`} row={child} formatValue={formatValue} />
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, formatValue }: {
  section: BalanceSheetSection;
  formatValue: (value: number) => string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <SectionHeader title={section.title} />
      <div className="mt-2 space-y-0.5">
        {section.rows.map((row, i) => (
          <TreeRow key={`${row.label}-${i}`} row={row} formatValue={formatValue} />
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between px-2">
        <span className="text-xs font-black text-slate-500">{section.totalLabel}</span>
        <span className="text-base font-black tabular-nums text-slate-900">
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
      highlight ? "bg-blue-50 border border-blue-200" : "bg-slate-50 border border-slate-200",
      className,
    )}>
      <span className={cn("font-black", highlight ? "text-blue-800 text-lg" : "text-slate-700 text-base")}>
        {label}
      </span>
      <span className={cn("font-black tabular-nums", highlight ? "text-blue-900 text-xl" : "text-slate-900 text-lg")}>
        {formatValue(value)}
      </span>
    </div>
  );
}

export function BalanceSheetView(props: BalanceSheetViewProps) {
  const { computed, formatValue } = props;

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="الميزانية العمومية" description="قائمة تبين الموقف المالي للشركة على مبدأ (الأصول = الخصوم + حقوق الملكية)" />
      <SummaryCards computed={computed} formatValue={formatValue} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2 h-full">
          <div className="flex-1 space-y-2">
            {computed.sections.slice(0, 1).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
            {computed.sections.slice(1, 2).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
          </div>
          <TotalRow label="إجمالي الأصول" value={computed.totalAssets} formatValue={formatValue} highlight />
        </div>

        <div className="flex flex-col gap-2 h-full">
          <div className="flex-1 space-y-2">
            {computed.sections.slice(2, 3).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
            {computed.sections.slice(3, 4).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
            {computed.sections.slice(4, 5).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
          </div>
          <TotalRow label="إجمالي الخصوم + حقوق الملكية" value={computed.totalLiabilitiesEquity} formatValue={formatValue} highlight />
        </div>
      </div>

    </div>
  );
}
