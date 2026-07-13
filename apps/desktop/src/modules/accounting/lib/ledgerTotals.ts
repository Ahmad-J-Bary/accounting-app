import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import type { AccountDto, JournalEntryDto, InvoiceDto } from "@erp/shared-types";

export interface LedgerTotalsResult {
  ledgerTotals: Map<string, { debit: number; credit: number }>;
  totalDrawings: number;
}

function parseNumber(value?: string | number | null): number {
  return parseSafeNumber(value);
}

function isCreditNatureAccount(account: AccountDto): boolean {
  return ["Liabilities", "Equity", "Revenue"].includes(account.account_type);
}

/**
 * Computes general ledger totals for all accounts, taking into account:
 * 1. Opening balances (debit/credit based on account nature).
 * 2. Partner capital ratio adjustments for in-kind opening balances.
 * 3. Journal entries (excluding in-kind capital overrides and consolidated capital details except cash).
 * 4. Purchase invoice extra cost overrides for the "تكاليف إضافية على المشتريات" account.
 */
export function computeLedgerTotals(
  accounts: AccountDto[],
  entries: JournalEntryDto[],
  purchaseInvoices: InvoiceDto[] = []
): LedgerTotalsResult {
  let totalDrawings = 0;
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const ledgerTotals = new Map<string, { debit: number; credit: number }>();

  // 1. Initialize with opening balances
  for (const account of accounts) {
    const openingBalance = parseNumber(account.opening_balance);
    if (openingBalance !== 0) {
      const existing = ledgerTotals.get(account.id) || { debit: 0, credit: 0 };
      if (isCreditNatureAccount(account)) {
        existing.credit += Math.abs(openingBalance);
      } else {
        existing.debit += Math.abs(openingBalance);
      }
      ledgerTotals.set(account.id, existing);
    }
  }

  // 2. Compute partner capital ratios for distributing in-kind opening balances
  const partnerAccounts = accounts.filter(
    (a) => a.code !== "51" && a.code.startsWith("51") && isCreditNatureAccount(a)
  );
  const totalPartnerCapital = partnerAccounts.reduce(
    (sum, a) => sum + Math.abs(parseNumber(a.opening_balance)),
    0
  );

  // 3. Accumulate in-kind capital credits from opening entries
  let capitalCreditsFromInKind = 0;
  for (const entry of entries) {
    const desc = entry.description || "";
    const isMaterialOpening = entry.journal_type === "MaterialOpeningBalance" || desc.includes("بضاعة أول المدة");
    const isFixedAssetOpening = desc.includes("إضافة أصل سابق") || desc.includes("رصيد افتتاحي للأصول الثابتة");

    if (!isMaterialOpening && !isFixedAssetOpening) continue;

    for (const line of entry.lines) {
      const account = accountMap.get(line.account_id);
      if (account?.code === "51" || account?.code?.startsWith("51")) {
        capitalCreditsFromInKind += parseFloat(line.credit_base || line.credit || "0");
      }
    }
  }

  // 4. Distribute in-kind capital
  if (capitalCreditsFromInKind > 0) {
    if (partnerAccounts.length > 0 && totalPartnerCapital > 0) {
      for (const partnerAcc of partnerAccounts) {
        const ratio = Math.abs(parseNumber(partnerAcc.opening_balance)) / totalPartnerCapital;
        const share = capitalCreditsFromInKind * ratio;
        const cur = ledgerTotals.get(partnerAcc.id) || { debit: 0, credit: 0 };
        cur.credit += share;
        ledgerTotals.set(partnerAcc.id, cur);
      }
    } else {
      const capitalParent = accounts.find((a) => a.code === "51");
      if (capitalParent) {
        const cur = ledgerTotals.get(capitalParent.id) || { debit: 0, credit: 0 };
        cur.credit += capitalCreditsFromInKind;
        ledgerTotals.set(capitalParent.id, cur);
      }
    }
  }

  // 5. Process standard journal lines
  for (const entry of entries) {
    const desc = entry.description || "";
    const isMaterialOpening = entry.journal_type === "MaterialOpeningBalance" || desc.includes("بضاعة أول المدة");
    const isFixedAssetOpening = desc.includes("إضافة أصل سابق") || desc.includes("رصيد افتتاحي للأصول الثابتة");

    for (const line of entry.lines) {
      const amt = parseFloat(line.debit_base || line.debit || "0") - parseFloat(line.credit_base || line.credit || "0");
      if (line.account_id === SYSTEM_ACCOUNT_IDS.DRAWINGS) {
        totalDrawings += Math.abs(amt);
      }

      const account = accountMap.get(line.account_id);

      // Skip in-kind capital credits (already handled)
      if (
        (isMaterialOpening || isFixedAssetOpening) &&
        (account?.code === "51" || account?.code?.startsWith("51"))
      ) {
        continue;
      }

      // Skip consolidated capital non-cash lines
      const isConsolidatedCapitalEntry = entry.source_id === "consolidated_capital";
      if (isConsolidatedCapitalEntry && account?.code !== "122") {
        continue;
      }

      const cur = ledgerTotals.get(line.account_id) || { debit: 0, credit: 0 };
      cur.debit += parseFloat(line.debit_base || line.debit || "0");
      cur.credit += parseFloat(line.credit_base || line.credit || "0");
      ledgerTotals.set(line.account_id, cur);
    }
  }

  // 6. Apply purchase invoice extra costs override
  let netPurchaseCost = 0;
  for (const inv of purchaseInvoices) {
    if (inv.status !== "Posted" && inv.status !== "Paid") continue;
    netPurchaseCost += parseFloat(inv.extra_costs || "0");
  }

  for (const account of accounts) {
    if (account.name_ar === "تكاليف إضافية على المشتريات") {
      const debit = Math.abs(netPurchaseCost);
      const credit = Math.abs(netPurchaseCost);
      ledgerTotals.set(account.id, { debit, credit });
    }
  }

  return { ledgerTotals, totalDrawings };
}
