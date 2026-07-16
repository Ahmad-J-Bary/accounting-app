import type { BalanceSheetComputed, BalanceSheetRow, BalanceSheetSection } from "@modules/reports/lib/balanceSheet";
import { cn } from "@shared/lib/utils";
import { CheckCircle2, AlertCircle, ChevronDown, ChevronLeft } from "lucide-react";
import { useState } from "react";

type BalanceSheetViewProps = {
  computed: BalanceSheetComputed;
  filters: { from_date: string; to_date: string };
  formatValue: (value: number) => string;
};

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-base font-black text-slate-900">{title}</h3>;
}

function ReportMeta() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-sm text-slate-600">
      <span className="text-lg font-black text-slate-900">????????? ????????</span>
      <span className="mx-2 text-slate-300">|</span>
      <span>????? ???? ?????? ?????? ?????? ??? ???? (?????? = ?????? + ???? ???????)</span>
    </div>
  );
}

function SummaryCards({ computed, formatValue }: { computed: BalanceSheetComputed; formatValue: (value: number) => string }) {
  const cards = [
    { label: "?????? ??????", value: computed.totalAssets },
    { label: "?????? ??????", value: computed.totalLiabilities },
    { label: "???? ???????", value: computed.totalEquity },
    { label: "?????? + ???? ???????", value: computed.totalLiabilitiesEquity },
  ];

  const isBalanced = computed.isBalanced;
  const diff = Math.abs(computed.totalAssets - computed.totalLiabilitiesEquity);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-black text-slate-400">{card.label}</div>
          <div className={cn("mt-1 text-xl font-black tabular-nums", card.label === "?????? ??????" ? "text-blue-700" : "text-slate-900")}>
            {formatValue(card.value)}
          </div>
        </div>
      ))}

      <div
        className={cn(
          "rounded-xl p-3 shadow-sm flex items-center gap-2 border-2 transition-all duration-300",
          isBalanced
            ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-300 hover:shadow-md hover:border-emerald-400"
            : "bg-gradient-to-br from-rose-50 to-white border-rose-300 hover:shadow-md hover:border-rose-400",
        )}
      >
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
          isBalanced ? "bg-emerald-100" : "bg-rose-100",
        )}>
          {isBalanced
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            : <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          }
        </div>
        <span className={cn(
          "text-[11px] font-black leading-tight",
          isBalanced ? "text-emerald-800" : "text-rose-800",
        )}>
          {isBalanced ? "???????" : "??? ???????"}
        </span>
        {!isBalanced && (
          <span className="text-[9px] text-rose-500 font-bold">
            ??? {formatValue(diff)}
          </span>
        )}
      </div>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <SectionHeader title={section.title} />
      <div className="mt-3 space-y-0.5">
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
      "flex items-center justify-between rounded-xl px-4 py-3",
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
    <div className="space-y-4">
      <ReportMeta />
      <SummaryCards computed={computed} formatValue={formatValue} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 h-full">
          <div className="flex-1 space-y-3">
            {computed.sections.slice(0, 1).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
            {computed.sections.slice(1, 2).map(s => (
              <SectionCard key={s.id} section={s} formatValue={formatValue} />
            ))}
          </div>
          <TotalRow label="?????? ??????" value={computed.totalAssets} formatValue={formatValue} highlight />
        </div>

        <div className="flex flex-col gap-3 h-full">
          <div className="flex-1 space-y-3">
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
          <TotalRow label="?????? ?????? + ???? ???????" value={computed.totalLiabilitiesEquity} formatValue={formatValue} highlight />
        </div>
      </div>

    </div>
  );
}
