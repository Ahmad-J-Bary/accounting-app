import { SectionCard } from "@shared/ui/section-card";
import { fmtMoney } from "@shared/lib/format";
import { StatusBadge } from "@shared/ui/status-badge";
import { Scale } from "lucide-react";
import type { OpeningBalanceMigrationDto, OpeningReconciliationDto } from "../../accounting/api/openingBalanceService";
import { RECON_ROW_LABEL, reconciliationReadiness } from "../lib/migration-labels";
import { MigrationPicker } from "./MigrationPicker";
import { ReconciliationStatusBanner } from "./ReconciliationStatusBanner";

interface ReconciliationCardProps {
  candidates: OpeningBalanceMigrationDto[];
  reconId: string;
  onReconIdChange: (v: string) => void;
  loading: boolean;
  reconciliation: OpeningReconciliationDto | null;
}

export function ReconciliationCard({
  candidates,
  reconId,
  onReconIdChange,
  loading,
  reconciliation,
}: ReconciliationCardProps) {
  return (
    <SectionCard
      title="التحقق من تسوية الرصيد الافتتاحي"
      icon={<Scale className="w-4 h-4 text-blue-600" />}
      description="يقارن أرصدة السجل المساعد (AR/AP/Inventory/FA) بأرصدة دفتر الأستاذ العام، ويعرض رصيد حساب رصيد الافتتاح (53) ومدين/دائن القيد لفحص معادلة الميزانية: A = L + E."
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <MigrationPicker id="recon-migration" label="الترحيل" candidates={candidates} value={reconId} onChange={onReconIdChange} />
        {loading && <span className="text-xs font-semibold text-blue-600">جارٍ الفحص...</span>}
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
                السجل المساعد: {fmtMoney(r.subledger)} ← دفتر الأستاذ: {fmtMoney(r.general_ledger)}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
            <span className={"font-bold " + (reconciliation.all_reconciled ? "text-green-700" : "text-red-600")}>
              {reconciliation.all_reconciled ? "جميع الأرصدة متطابقة ✓" : "يوجد فرق في الأرصدة"}
            </span>
            <span className="tabular-nums text-slate-600">
              مدين: {fmtMoney(reconciliation.debit_total)} · دائن: {fmtMoney(reconciliation.credit_total)}
            </span>
            <span className="tabular-nums text-slate-700 font-semibold">
              رصيد الافتتاح (53): {fmtMoney(reconciliation.opening_control_balance)}
              {reconciliation.opening_control_balance === "0" && " — متوازن ✓"}
            </span>
          </div>
          <ReconciliationStatusBanner readiness={reconciliationReadiness(reconciliation)} />
        </div>
      )}
    </SectionCard>
  );
}
