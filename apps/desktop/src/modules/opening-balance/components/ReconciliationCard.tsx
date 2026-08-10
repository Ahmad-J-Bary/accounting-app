import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { STATUS_LABEL } from "@shared/ui/status";
import { toFixed } from "@shared/lib/format";
import { StatusBadge } from "@shared/ui/status-badge";
import { Scale } from "lucide-react";
import type { OpeningBalanceMigrationDto, OpeningReconciliationDto } from "../../accounting/api/openingBalanceService";
import { RECON_ROW_LABEL } from "../lib/migration-labels";

interface ReconciliationCardProps {
  candidates: OpeningBalanceMigrationDto[];
  reconId: string;
  onReconIdChange: (v: string) => void;
  loading: boolean;
  reconciliation: OpeningReconciliationDto | null;
  onCheck: () => void;
}

export function ReconciliationCard({
  candidates,
  reconId,
  onReconIdChange,
  loading,
  reconciliation,
  onCheck,
}: ReconciliationCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-600" /> التحقق من تسوية الرصيد الافتتاحي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          يقارن أرصدة السجل المساعد (AR/AP/Inventory/FA) بأرصدة دفتر الأستاذ العام، ويعرض رصيد حساب رصيد الافتتاح
          (53) ومدين/دائن القيد لفحص معادلة الميزانية: A = L + E.
        </p>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <FieldLabel>الترحيل</FieldLabel>
            <Select value={reconId} onValueChange={onReconIdChange}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                <SelectValue placeholder={candidates.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات"} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.cutover_date.split("T")[0]} — {STATUS_LABEL[m.status]} — {m.lines.length} بنود
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={onCheck} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            {loading ? "جارٍ الفحص..." : "تحقق من التسوية"}
          </Button>
        </div>

        {reconciliation && (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {reconciliation.rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="font-semibold text-slate-700">
                  {RECON_ROW_LABEL[r.key] || r.key}
                  <StatusBadge
                    status={r.reconciled ? "متطابق" : "فرق"}
                    label={r.reconciled ? "مطابق" : "فرق"}
                    tone={r.reconciled ? "green" : "red"}
                    className="mr-2"
                  />
                </div>
                <div className="tabular-nums text-slate-600">
                  السجل المساعد: {toFixed(parseFloat(r.subledger), 2)} ← دفتر الأستاذ: {toFixed(parseFloat(r.general_ledger), 2)}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
              <span className={"font-bold " + (reconciliation.all_reconciled ? "text-green-700" : "text-red-600")}>
                {reconciliation.all_reconciled ? "جميع الأرصدة متطابقة ✓" : "يوجد فرق في الأرصدة"}
              </span>
              <span className="tabular-nums text-slate-600">
                مدين: {toFixed(parseFloat(reconciliation.debit_total), 2)} · دائن: {toFixed(parseFloat(reconciliation.credit_total), 2)}
              </span>
              <span className="tabular-nums text-slate-700 font-semibold">
                رصيد الافتتاح (53): {toFixed(parseFloat(reconciliation.opening_control_balance), 2)}
                {reconciliation.opening_control_balance === "0" && " — متوازن ✓"}
              </span>
            </div>
            {(() => {
              const controlZero = parseFloat(reconciliation.opening_control_balance) === 0;
              const readyToPost = reconciliation.debit_equals_credit && reconciliation.all_reconciled;
              const readyToLock = readyToPost && controlZero;
              const blockers = [
                !reconciliation.debit_equals_credit && "القيد غير متوازن (مدين ≠ دائن)",
                !reconciliation.all_reconciled && "الواجهات الفرعية غير مطابقة",
                !controlZero && "رصيد الافتتاح (53) لم يُصفَّر بعد",
              ].filter(Boolean) as string[];
              return (
                <div className={"px-3 py-2 text-xs font-bold rounded-b-lg " + (readyToPost ? (readyToLock ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700") : "bg-red-50 text-red-600")}>
                  {readyToLock
                    ? "جاهز للقفل ✓"
                    : readyToPost
                      ? "جاهز للترحيل (صفّر رصيد 53 قبل القفل)"
                      : "غير جاهز: " + blockers.join(" · ")}
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}