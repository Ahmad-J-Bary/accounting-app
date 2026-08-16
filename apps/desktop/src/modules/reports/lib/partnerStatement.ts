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
        // The partner list is the authority; a partner whose capital ledger is
        // absent (e.g. a transient fetch failure) must never be hidden.
        if (!ledger) return true;
        const lines = ledger.lines ?? [];
        const lineBeforeTo = lines.some((line) => {
          const lineTs = new Date(line.date).getTime();
          return Number.isFinite(lineTs) && lineTs <= toTs;
        });
        if (lineBeforeTo) return true;
        // Existing-company opening records partner capital as the capital
        // account's static opening balance; the migration's opening journal is
        // surfaced by the ledger as opening entries, NOT lines, so those
        // partners have an empty `lines` array and must not be dropped as
        // "unexisted" (Sec 4 / Sec 13).
        const openings = (ledger.opening_entries ?? []).length
          ? (ledger.opening_entries ?? [])
          : ledger.opening_entry
            ? [ledger.opening_entry]
            : [];
        const openingBeforeTo = openings.some((entry) => {
          const entryTs = new Date(entry.date).getTime();
          return Number.isFinite(entryTs) && entryTs <= toTs;
        });
        if (openingBeforeTo) return true;
        // No dated evidence: the capital lives purely as the account's static
        // opening balance and the migration posted no journal line for it, or
        // the partner was registered without ledger activity. The partner
        // record is authoritative — never hide a real partner for lacking
        // journal lines.
        return lines.length === 0 && openings.length === 0;
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
