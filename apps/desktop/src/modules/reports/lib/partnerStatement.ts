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

    const capitalLedger = p.linked_account_id ? partnerLedgers[p.linked_account_id] : null;
    const drawingsLedger = p.drawings_account_id ? partnerLedgers[p.drawings_account_id] : null;

    let accumulatedCredits = 0;
    if (capitalLedger) {
      for (const line of capitalLedger.lines) {
        const lineTs = new Date(line.date).getTime();
        if (Number.isFinite(lineTs) && lineTs < fromTs) {
          accumulatedCredits += parseFloat(line.credit_base || "0");
        }
      }
    }
    const accumulatedProfits = Math.max(0, accumulatedCredits - capitalAmount);

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
