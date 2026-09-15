import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney } from "@shared/lib/format";
import type { ReconciliationRow } from "../../accounting/api/openingBalanceService";
import { RECON_ROW_LABEL } from "../lib/migration-labels";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  const note = allReconciled ? t("wizard.reconAllReconciled", { namespace: "openingBalance" }) : t("wizard.reconHasDifference", { namespace: "openingBalance" });
  return (
    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between px-3 py-2 text-xs">
          <div className="font-semibold text-slate-700">
            {RECON_ROW_LABEL[r.key]?.(t) || r.key}
            <StatusBadge
              status={r.reconciled ? t("wizard.reconMatched", { namespace: "openingBalance" }) : t("wizard.reconDifference", { namespace: "openingBalance" })}
              label={r.reconciled ? t("wizard.reconMatched", { namespace: "openingBalance" }) : t("wizard.reconDifference", { namespace: "openingBalance" })}
              tone={r.reconciled ? "green" : "red"}
              className="me-2"
            />
          </div>
          <div className="tabular-nums text-slate-600">
            {t("wizard.reconSubledgerVsGL", { namespace: "openingBalance" })} {fmtMoney(r.subledger)} {t("wizard.reconGLArrow", { namespace: "openingBalance" })} {fmtMoney(r.general_ledger)}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
        <span className={"font-bold " + (allReconciled ? "text-green-700" : "text-red-600")}>{note}</span>
        <span className="tabular-nums text-slate-600">
          {t("wizard.reconDebitTotal", { namespace: "openingBalance" })} {fmtMoney(debitTotal)} {t("wizard.reconCreditTotal", { namespace: "openingBalance" })} {fmtMoney(creditTotal)}
        </span>
        <span className="tabular-nums text-slate-700 font-semibold">
          {t("wizard.reconOpeningBalance53", { namespace: "openingBalance" })} {fmtMoney(openingControlBalance)}
          {openingControlBalance === "0" && t("wizard.reconBalancedSuffix", { namespace: "openingBalance" })}
        </span>
      </div>
    </div>
  );
}