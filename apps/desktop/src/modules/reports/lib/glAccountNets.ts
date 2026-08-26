import type { AccountDto, JournalEntryDto, JournalLineDto } from "@erp/shared-types";
import { isPostedLedgerEntry } from "@modules/reports/lib/report-policies";
import {
  isOpeningEntry,
  normalSign as classifierNormalSign,
  purposeTypeFallback as classifierPurposeTypeFallback,
  type GlAccountType,
} from "@modules/reports/lib/accountingEntryClassifier";

export type { GlAccountType } from "@modules/reports/lib/accountingEntryClassifier";

/** Raw Dr/Cr accumulation for one account plus its signed normal-balance net. */
export interface AccountNet {
  debit: number;
  credit: number;
  net: number;
}

/** One posted-ledger line, projected to its normal-balance sign. */
export interface GlLineNet {
  entryDate: string;
  accountId: string;
  accountCode?: string;
  accountType?: GlAccountType;
  accountPurpose?: string;
  net: number;
}

export interface GlAccountNets {
  accountNets: Map<string, AccountNet>;
  typeNets: Record<GlAccountType, number>;
  lines: GlLineNet[];
  /** Sum of the normal-balance nets of every line on the given account codes. */
  netByCodes(codes: string[]): number;
  /** Sum of the normal-balance nets of the given account ids. */
  netForAccounts(accountIds: string[]): number;
}

/** 1 for credit-normal accounts, −1 for debit-normal (Assets / Expenses). */
export const normalSign = classifierNormalSign;

/** Purpose → account-type fallback for the (rare) un-enriched line. */
export const purposeTypeFallback = classifierPurposeTypeFallback;

/** Semantic account type of a line (enriched or purpose fallback). */
export function lineType(line: JournalLineDto): GlAccountType | undefined {
  const explicit = line.account_type;
  if (explicit === "Assets" || explicit === "Liabilities" || explicit === "Equity" ||
      explicit === "Revenue" || explicit === "Expenses") {
    return explicit;
  }
  return purposeTypeFallback(line.account_purpose);
}

/** Signed net movement of one ledger line in base currency (normal balance). */
export function lineNet(line: JournalLineDto): number {
  const debit = parseFloat(line.debit_base ?? line.debit ?? "0");
  const credit = parseFloat(line.credit_base ?? line.credit ?? "0");
  return normalSign(lineType(line)) === 1 ? credit - debit : debit - credit;
}

const ALL_GL_TYPES: Set<string> = new Set(["Assets", "Liabilities", "Equity", "Revenue", "Expenses"]);

export function computeGlAccountNets(
  entries: JournalEntryDto[],
  opts?: { fromTs?: number; toTs?: number; accounts?: AccountDto[] },
): GlAccountNets {
  const accountNets = new Map<string, AccountNet>();
  const typeNets: Record<GlAccountType, number> = {
    Assets: 0,
    Liabilities: 0,
    Equity: 0,
    Revenue: 0,
    Expenses: 0,
  };
  const lines: GlLineNet[] = [];

  const accountIdToCode: Map<string, string> = new Map();
  for (const account of opts?.accounts ?? []) {
    accountIdToCode.set(account.id, account.code);
  }

  const inRange = opts?.fromTs !== undefined || opts?.toTs !== undefined;

  for (const entry of entries) {
    if (!isPostedLedgerEntry(entry)) continue;

    // Opening-migration entries are ALWAYS included — they represent the
    // cumulative opening position, not a period movement. Excluding them
    // by date range causes balance-sheet tiles (cash, bank, AR, AP, loans)
    // to show 0 on the Dashboard.
    if (!isOpeningEntry(entry)) {
      const entryTs = new Date(entry.entry_date).getTime();
      if (inRange) {
        if (!Number.isFinite(entryTs)) continue;
        if (opts?.fromTs !== undefined && entryTs < opts.fromTs) continue;
        if (opts?.toTs !== undefined && entryTs > opts.toTs) continue;
      }
    }

    for (const line of entry.lines) {
      const net = lineNet(line);
      const accountType = lineType(line);
      const accountCode = line.account_code ?? accountIdToCode.get(line.account_id);

      const current = accountNets.get(line.account_id) || { debit: 0, credit: 0, net: 0 };
      const debit = parseFloat(line.debit_base ?? line.debit ?? "0");
      const credit = parseFloat(line.credit_base ?? line.credit ?? "0");
      current.debit += debit;
      current.credit += credit;
      current.net += net;
      accountNets.set(line.account_id, current);

      if (accountType && ALL_GL_TYPES.has(accountType)) {
        typeNets[accountType] += net;
      }

      lines.push({
        entryDate: entry.entry_date,
        accountId: line.account_id,
        accountCode,
        accountType,
        accountPurpose: line.account_purpose,
        net,
      });
    }
  }

  const netByCodes = (codes: string[]) => {
    const codeSet = new Set(codes);
    let sum = 0;
    for (const line of lines) {
      if (line.accountCode && codeSet.has(line.accountCode)) {
        sum += line.net;
      }
    }
    return sum;
  };

  const netForAccounts = (accountIds: string[]) => {
    let sum = 0;
    for (const id of accountIds) {
      sum += accountNets.get(id)?.net ?? 0;
    }
    return sum;
  };

  return { accountNets, typeNets, lines, netByCodes, netForAccounts };
}