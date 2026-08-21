import { describe, it, expect } from "vitest";
import { computePartnerStatement } from "./partnerStatement";
import { computePartnerProfitShare } from "./partnerProfitShare";
import type { AccountLedgerDto, OpeningEntryDto, PartnerDto } from "@erp/shared-types";

const TO_DATE = "2026-08-04";
const FROM_TS = new Date("2026-01-01T00:00:00").getTime();

function partner(id: string, name: string, amount: string, capitalAccount?: string): PartnerDto {
  return {
    id,
    code: "",
    name,
    phone: null,
    address: null,
    debit: "0",
    credit: "0",
    opening_balance: "0",
    balance: "0",
    currency: "S",
    notes: null,
    is_active: true,
    exchange_rate: "1",
    amount_local: amount,
    amount_original: amount,
    is_amount_in_original: false,
    profit_sharing_ratio: null,
    profit_sharing_type: "BasedOnCapitalLocal",
    linked_account_id: capitalAccount ?? null,
    drawings_account_id: null,
    current_account_id: null,
  };
}

function openingEntry(date: string, creditBase: string): OpeningEntryDto {
  return { entry_number: "O1", description: "رصيد افتتاحي", date, debit_base: "0", credit_base: creditBase };
}

function ledger(overrides: Partial<AccountLedgerDto>): AccountLedgerDto {
  return {
    account_id: "c1",
    account_name: "رأس مال",
    opening_balance_base: "0",
    opening_balance_original: "0",
    opening_entry: null,
    opening_entries: [],
    lines: [],
    total_debit_base: "0",
    total_credit_base: "0",
    closing_balance_base: "0",
    total_debit_original: "0",
    total_credit_original: "0",
    closing_balance_original: "0",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Partner Statement — the «لا يوجد شركاء لعرض كشف الحساب» regression.
// An existing-company partner's capital lives as the capital account's static
// opening balance; `get_ledger` reports it as opening entries (empty `lines`).
// The old filter treated "no lines" as "partner never existed" and dropped the
// partner. These cases pin the fixed behavior.
// ---------------------------------------------------------------------------
describe("computePartnerStatement", () => {
  it("keeps an existing-company partner whose capital is carried as static opening entries (empty lines)", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];
    const partnerLedgers: Record<string, AccountLedgerDto> = {
      c1: ledger({
        opening_balance_base: "180",
        opening_entry: openingEntry("2026-01-01T00:00:00+00:00", "180"),
        opening_entries: [openingEntry("2026-01-01T00:00:00+00:00", "180")],
      }),
    };

    const { rows } = computePartnerStatement(partners, FROM_TS, partnerLedgers, {}, {}, TO_DATE);

    expect(rows).toHaveLength(1);
    expect(rows[0].partnerName).toBe("أحمد");
    expect(rows[0].capitalAmount).toBe(180);
  });

  it("keeps a partner whose capital ledger is completely empty (no lines, no opening entries)", () => {
    const partners = [partner("p1", "محمد", "120", "c1")];
    const partnerLedgers: Record<string, AccountLedgerDto> = {
      c1: ledger({ opening_balance_base: "120" }),
    };

    const { rows } = computePartnerStatement(partners, FROM_TS, partnerLedgers, {}, {}, TO_DATE);

    expect(rows).toHaveLength(1);
    expect(rows[0].capitalAmount).toBe(120);
  });

  it("keeps a partner whose capital ledger did not load at all (transient fetch miss)", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];

    const { rows } = computePartnerStatement(partners, FROM_TS, {}, {}, {}, TO_DATE);

    expect(rows).toHaveLength(1);
    expect(rows[0].partnerName).toBe("أحمد");
  });

  it("keeps active partners when no to-date bound is given", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];

    const { rows } = computePartnerStatement(partners, FROM_TS, {}, {}, {}, undefined);

    expect(rows).toHaveLength(1);
  });

  it("drops only a partner whose ledger activity is entirely after the statement date", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];
    const partnerLedgers: Record<string, AccountLedgerDto> = {
      c1: ledger({
        lines: [
          {
            date: "2026-09-01T00:00:00+00:00",
            journal_id: "j1",
            entry_id: "j1",
            entry_number: "1",
            journal_type: "GeneralJournal",
            entry_type: "general_journal",
            entry_status: "Posted",
            journal_type_display: "اليومية العامة",
            is_opening: false,
            line_id: "l1",
            account_id: "c1",
            source_id: null,
            description: "",
            opposite_account_name: "",
            currency: "S",
            fx_rate: "1",
            debit_base: "0",
            credit_base: "10",
            balance_base: "10",
            debit_original: "0",
            credit_original: "0",
            balance_original: "0",
          },
        ],
      }),
    };

    const { rows } = computePartnerStatement(partners, FROM_TS, partnerLedgers, {}, {}, TO_DATE);

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Partner Profit Share — same regression surface for «الشركاء وتقاسم الأرباح».
// ---------------------------------------------------------------------------
describe("computePartnerProfitShare", () => {
  it("keeps partners whose capital is carried as static opening entries (empty lines)", () => {
    const partners = [partner("p1", "أحمد", "180", "c1"), partner("p2", "محمد", "120", "c2")];
    const partnerLedgers: Record<string, AccountLedgerDto> = {
      c1: ledger({
        account_id: "c1",
        opening_balance_base: "180",
        opening_entries: [openingEntry("2026-01-01T00:00:00+00:00", "180")],
      }),
      c2: ledger({ account_id: "c2", opening_balance_base: "120" }),
    };

    const computed = computePartnerProfitShare(partners, 1000, 0, 0, {}, 0, partnerLedgers, TO_DATE);

    expect(computed.rows).toHaveLength(2);
    expect(computed.totalCapital).toBe(300);
    const ahmad = computed.rows.find((r) => r.partnerId === "p1");
    expect(ahmad?.capitalRatio).toBe(60);
    expect(ahmad?.profitShareAmount).toBe(600);
  });

  it("keeps a partner whose capital ledger did not load at all", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];

    const computed = computePartnerProfitShare(partners, 1000, 0, 0, {}, 0, {}, TO_DATE);

    expect(computed.rows).toHaveLength(1);
  });

  it("keeps a partner with a fully empty capital ledger", () => {
    const partners = [partner("p1", "محمد", "120", "c1")];
    const partnerLedgers: Record<string, AccountLedgerDto> = { c1: ledger({}) };

    const computed = computePartnerProfitShare(partners, 1000, 0, 0, {}, 0, partnerLedgers, TO_DATE);

    expect(computed.rows).toHaveLength(1);
  });

  it("drops only a partner whose ledger activity is entirely after the report date", () => {
    const partners = [partner("p1", "أحمد", "180", "c1")];
    const partnerLedgers: Record<string, AccountLedgerDto> = {
      c1: ledger({
        lines: [
          {
            date: "2026-09-01T00:00:00+00:00",
            journal_id: "j1",
            entry_id: "j1",
            entry_number: "1",
            journal_type: "GeneralJournal",
            entry_type: "general_journal",
            entry_status: "Posted",
            journal_type_display: "اليومية العامة",
            is_opening: false,
            line_id: "l1",
            account_id: "c1",
            source_id: null,
            description: "",
            opposite_account_name: "",
            currency: "S",
            fx_rate: "1",
            debit_base: "0",
            credit_base: "10",
            balance_base: "10",
            debit_original: "0",
            credit_original: "0",
            balance_original: "0",
          },
        ],
      }),
    };

    const computed = computePartnerProfitShare(partners, 1000, 0, 0, {}, 0, partnerLedgers, TO_DATE);

    expect(computed.rows).toHaveLength(0);
  });
});