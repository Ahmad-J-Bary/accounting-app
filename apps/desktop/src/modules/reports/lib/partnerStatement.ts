import { endOfDay } from "./date-utils";
import type { PartnerDto } from "@erp/shared-types";
import type { AccountLedgerDto } from "@erp/shared-types";

export type PartnerStatementRow = {
  partnerId: string;
  partnerName: string;
  capitalAmount: number;
  accumulatedProfits: number;
  accumulatedDrawings: number;
  currentAccount: number;
  thisYearProfit: number;
  thisYearDrawings: number;
  finalAmount: number;
};

export type PartnerStatementComputed = {
  rows: PartnerStatementRow[];
};

export function computePartnerStatement(
  partners: PartnerDto[],
  fromTs: number,
  partnerLedgers: Record<string, AccountLedgerDto>,
  thisYearProfitShare: Record<string, number>,
  thisYearDrawings: Record<string, number>,
  toDate?: string,
): PartnerStatementComputed {
  partnerLedgers = partnerLedgers || {};
  const toTs = toDate ? endOfDay(toDate) : Infinity;

  const existedPartners = toDate
    ? partners.filter((p) => {
        if (!p.linked_account_id) return true;
        const ledger = partnerLedgers[p.linked_account_id];
        if (!ledger || !ledger.lines) return false;
        return ledger.lines.some((line) => {
          const lineTs = new Date(line.date).getTime();
          return Number.isFinite(lineTs) && lineTs <= toTs;
        });
      })
    : partners;

  const rows: PartnerStatementRow[] = existedPartners.map((p) => {
    const capitalAmount = parseFloat(p.amount_local || "0");

    const drawingsLedger = p.drawings_account_id ? partnerLedgers[p.drawings_account_id] : null;
    // Accumulated profit allocations live on the partner's CURRENT account in
    // the ledger (Sec 4 / Sec 13). They are a real ledger figure, never derived
    // as "capital credits − registered capital" (the current account is where
    // profit/loss allocations are posted).
    const currentLedger = p.current_account_id ? partnerLedgers[p.current_account_id] : null;

    let accumulatedProfits = 0;
    if (currentLedger) {
      for (const line of currentLedger.lines) {
        const lineTs = new Date(line.date).getTime();
        if (Number.isFinite(lineTs) && lineTs < fromTs) {
          accumulatedProfits += parseFloat(line.credit_base || "0") - parseFloat(line.debit_base || "0");
        }
      }
    }

    let accumulatedDrawings = 0;
    if (drawingsLedger) {
      for (const line of drawingsLedger.lines) {
        const lineTs = new Date(line.date).getTime();
        if (Number.isFinite(lineTs) && lineTs < fromTs) {
          accumulatedDrawings += parseFloat(line.debit_base || "0");
        }
      }
    }

    const currentAccount = capitalAmount + accumulatedProfits - accumulatedDrawings;
    const thisYearProfit = thisYearProfitShare[p.id] || 0;
    const thisYearDraw = thisYearDrawings[p.id] || 0;
    const finalAmount = currentAccount + thisYearProfit - thisYearDraw;

    return {
      partnerId: p.id,
      partnerName: p.name,
      capitalAmount,
      accumulatedProfits,
      accumulatedDrawings,
      currentAccount,
      thisYearProfit,
      thisYearDrawings: thisYearDraw,
      finalAmount,
    };
  });

  return { rows };
}
