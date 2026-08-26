import { describe, it, expect } from "vitest";
import {
  isOpeningEntry,
  isInventoryAccount,
  isInventoryTradingAccount,
  isCreditNatureAccount,
  normalSign,
  purposeTypeFallback,
} from "./accountingEntryClassifier";

describe("isOpeningEntry", () => {
  it("matches canonical English opening journal types", () => {
    expect(isOpeningEntry({ journal_type: "CashOpeningBalance" })).toBe(true);
    expect(isOpeningEntry({ journal_type: "AccountOpeningBalance" })).toBe(true);
    expect(isOpeningEntry({ journal_type: "MaterialOpeningBalance" })).toBe(true);
  });

  it("matches source_id prefixes", () => {
    expect(isOpeningEntry({ source_id: "opening_balance:abc-123" })).toBe(true);
    expect(isOpeningEntry({ source_id: "residual_classification:abc-123" })).toBe(true);
    expect(isOpeningEntry({ source_id: "ob_reversal:abc-123" })).toBe(true);
  });

  it("matches is_opening flag", () => {
    expect(isOpeningEntry({ is_opening: true })).toBe(true);
  });

  it("does not check is_opening: false (caller responsibility)", () => {
    // isOpeningEntry is a pure positive matcher. The is_opening: false
    // early-exit is handled by isOpeningLine (account-movements layer).
    expect(isOpeningEntry({ journal_type: "AccountOpeningBalance", is_opening: false })).toBe(true);
  });

  it("rejects ordinary entries", () => {
    expect(isOpeningEntry({ journal_type: "SalesJournal" })).toBe(false);
    expect(isOpeningEntry({ journal_type: "GeneralJournal" })).toBe(false);
    expect(isOpeningEntry({ journal_type: "PurchaseJournal" })).toBe(false);
  });

  it("rejects entries with unrelated source_id", () => {
    expect(isOpeningEntry({ source_id: "invoice:abc-123" })).toBe(false);
    expect(isOpeningEntry({ source_id: "payment:abc-123" })).toBe(false);
  });

  it("does NOT use description for classification", () => {
    expect(isOpeningEntry({ journal_type: "GeneralJournal" })).toBe(false);
    expect(isOpeningEntry({ journal_type: "GeneralJournal" })).toBe(false);
  });

  it("handles missing/empty fields gracefully", () => {
    expect(isOpeningEntry({})).toBe(false);
    expect(isOpeningEntry({ source_id: null })).toBe(false);
    expect(isOpeningEntry({ source_id: "" })).toBe(false);
  });
});

describe("isInventoryAccount", () => {
  it("matches by purpose field (canonical)", () => {
    expect(isInventoryAccount({ purpose: "inventory" })).toBe(true);
  });

  it("matches by Arabic name fallback", () => {
    expect(isInventoryAccount({ name_ar: "بضاعة أول المدة" })).toBe(true);
    expect(isInventoryAccount({ name_ar: "بضاعة آخر المدة" })).toBe(true);
    expect(isInventoryAccount({ name_ar: "المخزون" })).toBe(true);
    expect(isInventoryAccount({ name_ar: "مخزون عام" })).toBe(true);
  });

  it("rejects non-inventory accounts", () => {
    expect(isInventoryAccount({ purpose: "receivable" })).toBe(false);
    expect(isInventoryAccount({ purpose: "payable" })).toBe(false);
    expect(isInventoryAccount({ name_ar: "صندوق" })).toBe(false);
    expect(isInventoryAccount({ name_ar: "بنك" })).toBe(false);
  });

  it("purpose takes precedence over name", () => {
    expect(isInventoryAccount({ purpose: "inventory", name_ar: "صندوق" })).toBe(true);
    expect(isInventoryAccount({ purpose: "receivable", name_ar: "المخزون" })).toBe(true);
  });

  it("handles missing fields", () => {
    expect(isInventoryAccount({})).toBe(false);
    expect(isInventoryAccount({ purpose: null })).toBe(false);
  });
});

describe("isInventoryTradingAccount", () => {
  it("matches opening and closing stock COGS accounts", () => {
    expect(isInventoryTradingAccount("بضاعة أول المدة")).toBe(true);
    expect(isInventoryTradingAccount("بضاعة آخر المدة")).toBe(true);
  });

  it("rejects other inventory accounts", () => {
    expect(isInventoryTradingAccount("المخزون")).toBe(false);
    expect(isInventoryTradingAccount("بضاعة عامة")).toBe(false);
    expect(isInventoryTradingAccount("صندوق")).toBe(false);
  });
});

describe("isCreditNatureAccount", () => {
  it("returns true for credit-normal types", () => {
    expect(isCreditNatureAccount("Liabilities")).toBe(true);
    expect(isCreditNatureAccount("Equity")).toBe(true);
    expect(isCreditNatureAccount("Revenue")).toBe(true);
  });

  it("returns false for debit-normal types", () => {
    expect(isCreditNatureAccount("Assets")).toBe(false);
    expect(isCreditNatureAccount("Expenses")).toBe(false);
  });

  it("returns false for undefined/empty", () => {
    expect(isCreditNatureAccount(undefined)).toBe(false);
    expect(isCreditNatureAccount("")).toBe(false);
  });
});

describe("normalSign", () => {
  it("returns +1 for credit-normal types", () => {
    expect(normalSign("Liabilities")).toBe(1);
    expect(normalSign("Equity")).toBe(1);
    expect(normalSign("Revenue")).toBe(1);
  });

  it("returns -1 for debit-normal types", () => {
    expect(normalSign("Assets")).toBe(-1);
    expect(normalSign("Expenses")).toBe(-1);
  });

  it("returns -1 for unknown types", () => {
    expect(normalSign(undefined)).toBe(-1);
    expect(normalSign("Unknown")).toBe(-1);
  });
});

describe("purposeTypeFallback", () => {
  it("maps asset purposes to Assets", () => {
    expect(purposeTypeFallback("receivable")).toBe("Assets");
    expect(purposeTypeFallback("inventory")).toBe("Assets");
    expect(purposeTypeFallback("bank")).toBe("Assets");
  });

  it("maps liability purposes to Liabilities", () => {
    expect(purposeTypeFallback("payable")).toBe("Liabilities");
    expect(purposeTypeFallback("loan")).toBe("Liabilities");
  });

  it("maps equity purposes to Equity", () => {
    expect(purposeTypeFallback("partner_capital")).toBe("Equity");
    expect(purposeTypeFallback("partner_drawings")).toBe("Equity");
    expect(purposeTypeFallback("partner_current")).toBe("Equity");
    expect(purposeTypeFallback("retained_earnings")).toBe("Equity");
    expect(purposeTypeFallback("opening_balance_equity")).toBe("Equity");
    expect(purposeTypeFallback("opening_equity_adjustment")).toBe("Equity");
    expect(purposeTypeFallback("prior_period_adjustment")).toBe("Equity");
    expect(purposeTypeFallback("other_equity")).toBe("Equity");
  });

  it("returns undefined for general/unknown purposes", () => {
    expect(purposeTypeFallback("general")).toBeUndefined();
    expect(purposeTypeFallback("unknown")).toBeUndefined();
    expect(purposeTypeFallback(undefined)).toBeUndefined();
  });
});
