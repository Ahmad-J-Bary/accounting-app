import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney } from "@shared/lib/format";
import type { ReconciliationRow } from "../../accounting/api/openingBalanceService";
import { RECON_ROW_LABEL } from "../lib/migration-labels";

interface ReconciliationRowsTableProps {
  rows: ReconciliationRow[];
  allReconciled: boolean;
  openingControlBalance: string;
  debitTotal: string;
  creditTotal: string;
}

/** Reads the sub-ledger vs general-ledger comparison for a migration's rows plus
 * the net / debit / credit summary line. Shared by the reconciliation card and
 * the guided transition wizard so the two render identically. */
export function ReconciliationRowsTable({
  rows,
  allReconciled,
  openingControlBalance,
  debitTotal,
  creditTotal,
}: ReconciliationRowsTableProps) {
  const note = allReconciled ? "جميع الأرصدة متطابقة ✓" : "يوجد فرق في الأرصدة";
  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between px-3 py-2 text-xs">
          <div className="font-semibold text-slate-700">
            {RECON_ROW_LABEL[r.key] || r.key}
            <StatusBadge
              status={r.reconciled ? "متطابق" : "فرق"}
              label={r.reconciled ? "مطابق" : "فرق"}
              tone={r.reconciled ? "green" : "red"}
              className="me-2"
            />
          </div>
          <div className="tabular-nums text-slate-600">
            السجل المساعد: {fmtMoney(r.subledger)} ← دفتر الأستاذ: {fmtMoney(r.general_ledger)}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
        <span className={"font-bold " + (allReconciled ? "text-green-700" : "text-red-600")}>{note}</span>
        <span className="tabular-nums text-slate-600">
          مدين: {fmtMoney(debitTotal)} · دائن: {fmtMoney(creditTotal)}
        </span>
        <span className="tabular-nums text-slate-700 font-semibold">
          رصيد الافتتاح (53): {fmtMoney(openingControlBalance)}
          {openingControlBalance === "0" && " — متوازن ✓"}
        </span>
      </div>
    </div>
  );
}