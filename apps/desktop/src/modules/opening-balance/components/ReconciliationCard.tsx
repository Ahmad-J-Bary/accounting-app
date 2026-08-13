import { SectionCard } from "@shared/ui/section-card";
import { Scale } from "lucide-react";
import type { OpeningBalanceMigrationDto, OpeningReconciliationDto } from "../../accounting/api/openingBalanceService";
import { reconciliationReadiness } from "../lib/migration-labels";
import { MigrationPicker } from "./MigrationPicker";
import { ReconciliationStatusBanner } from "./ReconciliationStatusBanner";
import { ReconciliationRowsTable } from "./ReconciliationRowsTable";

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
        <div className="mt-3">
          <ReconciliationRowsTable
            rows={reconciliation.rows}
            allReconciled={reconciliation.all_reconciled}
            openingControlBalance={reconciliation.opening_control_balance}
            debitTotal={reconciliation.debit_total}
            creditTotal={reconciliation.credit_total}
          />
          <ReconciliationStatusBanner readiness={reconciliationReadiness(reconciliation)} />
        </div>
      )}
    </SectionCard>
  );
}
