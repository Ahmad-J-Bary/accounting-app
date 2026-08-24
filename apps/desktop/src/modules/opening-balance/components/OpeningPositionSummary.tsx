import type { ReactNode } from "react";
import { cn } from "@shared/lib/utils";
import { Card, CardContent } from "@shared/ui/card";
import { Scale, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney } from "@shared/lib/format";

export interface OpeningPositionSummaryProps {
  cash: number;
  bank: number;
  receivables: number;
  inventory: number;
  fixedAssets: number;
  suppliers: number;
  loans: number;
  otherLiabilities: number;
  partnerCapital: number;
  partnerCurrent: number;
  otherEquity: number;
  /** Net Assets − Recognized Equity (debit − credit before any plug). */
  residual: number;
  /** > 0 when the residual has been classified onto the OBE (53) control. */
  plugAmount: number;
  balanced: boolean;
  /** Smart, section-targeted Arabic hints (empty when everything is clean). */
  hints?: string[];
}

function Row({ label, value, strong }: { label: ReactNode; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={strong ? "font-bold text-slate-700" : "text-slate-500 font-medium"}>{label}</span>
      <span className={cn("tabular-nums", strong ? "font-black text-slate-800" : "font-semibold text-slate-700")}>
        {fmtMoney(value)}
      </span>
    </div>
  );
}

function SectionLabel({ children, color }: { children: ReactNode; color: string }) {
  return <div className={cn("text-2xs font-bold", color)}>{children}</div>;
}

/**
 * Live Opening Position summary derived directly from wizard state (never from
 * the backend — the migration may not be saved yet). Renders the §13 balance
 * sheet structure with the exact difference and balance status, updating on
 * every keystroke via normal React re-render.
 */
export function OpeningPositionSummary({
  cash,
  bank,
  receivables,
  inventory,
  fixedAssets,
  suppliers,
  loans,
  otherLiabilities,
  partnerCapital,
  partnerCurrent,
  otherEquity,
  residual,
  plugAmount,
  balanced,
  hints = [],
}: OpeningPositionSummaryProps) {
  const totalAssets = cash + bank + receivables + inventory + fixedAssets;
  const totalLiabilities = suppliers + loans + otherLiabilities;
  const netAssets = totalAssets - totalLiabilities;
  const recognizedEquity = partnerCapital + partnerCurrent + otherEquity;
  const equityWithPlug = recognizedEquity + Math.max(plugAmount, 0);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-2.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-blue-600" />
            المركز الافتتاحي
          </span>
          <StatusBadge
            status={balanced ? "متوازن" : "فرق"}
            label={balanced ? "متوازن ✓" : "يوجد فرق"}
            tone={balanced ? "green" : "red"}
          />
        </div>

        {hints.length > 0 && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 space-y-1">
            {hints.map((h, i) => (
              <p key={i} className="text-2xs text-red-700 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {h}
              </p>
            ))}
          </div>
        )}

        <div className="border border-blue-100 rounded-lg p-2 space-y-1 bg-blue-50/40">
          <SectionLabel color="text-blue-700">الأصول (A)</SectionLabel>
          <Row label="النقد والصندوق" value={cash} />
          <Row label="البنوك" value={bank} />
          <Row label="الذمم المدينة (العملاء)" value={receivables} />
          <Row label="رصيد المخزون" value={inventory} />
          <Row label="الأصول الثابتة (صافي)" value={fixedAssets} />
          <div className="pt-1 border-t border-blue-100">
            <Row label="إجمالي الأصول" value={totalAssets} strong />
          </div>
        </div>

        <div className="border border-emerald-100 rounded-lg p-2 space-y-1 bg-emerald-50/40">
          <SectionLabel color="text-emerald-700">الخصوم (L)</SectionLabel>
          <Row label="الذمم الدائنة (الموردون)" value={suppliers} />
          <Row label="قروض وتسليفات" value={loans} />
          <Row label="خصوم أخرى" value={otherLiabilities} />
          <div className="pt-1 border-t border-emerald-100">
            <Row label="إجمالي الخصوم" value={totalLiabilities} strong />
          </div>
        </div>

        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-2 py-1.5">
          <Row label="صافي الأصول (A − L)" value={netAssets} strong />
        </div>

        <div className="border border-indigo-100 rounded-lg p-2 space-y-1 bg-indigo-50/40">
          <SectionLabel color="text-indigo-700">حقوق الملكية (E)</SectionLabel>
          <Row label="رأس مال الشركاء" value={partnerCapital} />
          <Row label="الحسابات الجارية" value={partnerCurrent} />
          <Row label="حقوق ملكية أخرى" value={otherEquity} />
          {plugAmount > 0 && <Row label="تسوية الرصيد الافتتاحي (53)" value={plugAmount} />}
          <div className="pt-1 border-t border-indigo-100">
            <Row label="إجمالي حقوق الملكية (المصنّف)" value={equityWithPlug} strong />
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg px-2.5 py-2 text-xs font-bold flex items-center justify-between",
            balanced ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200",
          )}
        >
          <span>{balanced ? "الفرق = 0 — متوازن ✓" : "الفرق (رصيد غير مصنّف):"}</span>
          <span className="tabular-nums font-black">{fmtMoney(balanced ? 0 : residual)}</span>
        </div>

        <p className="text-2xs text-slate-400">
          الفرق = صافي الأصول − حقوق الملكية المعترف بها — لا يُسوى تلقائياً؛ صُنّفه صراحةً من
          تصنيفات الرصيد المتبقي.
        </p>
      </CardContent>
    </Card>
  );
}