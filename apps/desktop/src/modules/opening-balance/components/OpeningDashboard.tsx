import { type ReactNode } from "react";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Badge } from "@shared/ui/badge";
import { cn } from "@shared/lib/utils";
import { toFixed } from "@shared/lib/format";
import { StatusBadge } from "@shared/ui/status-badge";
import type { OpeningSnapshot, OpeningSection } from "../lib/derive-opening-snapshot";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface OpeningDashboardProps {
  snapshot: OpeningSnapshot;
  onOpenSection?: (sectionKey: string) => void;
  loading?: boolean;
  footer?: ReactNode;
}

/**
 * Overview dashboard: shows the 8 opening sections with their booked
 * amounts and done-states, the accounting-equation totals, and any remaining
 * blockers before the position can be posted/locked.
 */
export function OpeningDashboard({ snapshot, onOpenSection, loading = false, footer }: OpeningDashboardProps) {
  const { t } = useLocalization();
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400 font-semibold">
        {t("openingBalance.loadingPosition", { namespace: "accounting", fallback: "جارٍ تحميل المركز الافتتاحي..." })}
      </div>
    );
  }

  if (!snapshot.hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
        <p className="text-sm font-bold text-slate-700">{t("openingBalance.noOpenBalances", { namespace: "accounting", fallback: "لا توجد أرصدة مفتوحة بعد" })}</p>
        <p className="text-xs text-slate-500">
          {t("openingBalance.noOpenBalancesDesc", { namespace: "accounting", fallback: "ابدأ من معالج التحويل الموجّه لأدخل أرصدة الأقسام واحداً تلو الآخر، ثم عد إلى هذه النظرة لمتابعة الجاهزية." })}
        </p>
        {footer}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Accounting-equation summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile label={t("openingBalance.totalAssets", { namespace: "accounting", fallback: "إجمالي الأصول" })} value={snapshot.totalAssets} tone="text-blue-700" />
        <SummaryTile label={t("openingBalance.totalLiabilities", { namespace: "accounting", fallback: "إجمالي الخصوم" })} value={snapshot.totalLiabilities} tone="text-emerald-700" />
        <SummaryTile label={t("openingBalance.totalEquity", { namespace: "accounting", fallback: "إجمالي حقوق الملكية" })} value={snapshot.totalEquity} tone="text-indigo-700" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {snapshot.status && <StatusBadge status={snapshot.status} />}
        <Badge className={cn("border font-bold", snapshot.balanced ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200")}>
          {snapshot.balanced ? t("openingBalance.balanced", { namespace: "accounting", fallback: "متوازن ✓" }) : t("openingBalance.unbalanced", { namespace: "accounting", fallback: "غير متوازن" })}
        </Badge>
        {snapshot.readyToLock && (
          <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold">{t("openingBalance.readyToPost", { namespace: "accounting", fallback: "جاهز للترحيل والقفل ✓" })}</Badge>
        )}
      </div>

      {snapshot.blockers.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1">
          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> {t("openingBalance.wizardBlockerHint", { namespace: "accounting", fallback: "المعالج لن يُقبل الترحيل حتى تُحل المعطيات التالية:" })}
          </p>
          <ul className="list-disc pe-5 space-y-0.5">
            {snapshot.blockers.map((b, i) => (
              <li key={i} className="text-xs text-amber-700">{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Eight-section grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {snapshot.sections.map((s) => (
          <SectionCard key={s.key} section={s} onOpen={() => onOpenSection?.(s.key)} />
        ))}
      </div>

      {footer}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={cn("text-xl font-black tabular-nums", tone)}>{toFixed(value, 2)}</div>
    </div>
  );
}

function SectionCard({ section, onOpen }: { section: OpeningSection; onOpen?: () => void }) {
  const { t } = useLocalization();
  const card = (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full text-end rounded-xl border bg-white p-3 space-y-1.5 transition-all",
        section.done
          ? "border-emerald-200 hover:border-emerald-300"
          : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">{section.label}</span>
        {section.done ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 shrink-0" />
        )}
      </div>
      <div className={cn("text-base font-black tabular-nums", section.done ? "text-slate-800" : "text-slate-300")}>
        {section.done ? toFixed(section.amount, 2) : "—"}
      </div>
      <div className="text-2xs font-semibold text-slate-400 truncate">
        {section.done
          ? section.lines.slice(0, 2).map((l) => `${l.code} ${l.name_ar}`).join(" · ")
          : t("openingBalance.waitingForData", { namespace: "accounting", fallback: "بانتظار إدخال الأرصدة" })}
      </div>
    </button>
  );

  if (!onOpen) return <div className="cursor-default">{card}</div>;
  return card;
}