import { describe, it, expect } from "vitest";
import {
  partnerDirectionMultiplier,
  effectiveBalance,
  effectiveBalanceBase,
  balanceDirectionLabel,
  balanceDirectionStatus,
} from "./balance-utils";

describe("partnerDirectionMultiplier", () => {
  it("returns 1 for customer", () => {
    expect(partnerDirectionMultiplier("customer")).toBe(1);
  });

  it("returns -1 for supplier", () => {
    expect(partnerDirectionMultiplier("supplier")).toBe(-1);
  });
});

describe("effectiveBalance", () => {
  it("customer: positive when debit > credit", () => {
    expect(effectiveBalance(100, 30, "customer")).toBe(70);
  });

  it("customer: negative when credit > debit", () => {
    expect(effectiveBalance(30, 100, "customer")).toBe(-70);
  });

  it("supplier: positive when credit > debit (flipped)", () => {
    expect(effectiveBalance(30, 100, "supplier")).toBe(70);
  });

  it("supplier: negative when debit > credit (flipped)", () => {
    expect(effectiveBalance(100, 30, "supplier")).toBe(-70);
  });

  it("returns zero when debit equals credit", () => {
    expect(effectiveBalance(50, 50, "customer")).toBe(0);
    expect(effectiveBalance(50, 50, "supplier")).toBe(0);
  });
});

describe("effectiveBalanceBase", () => {
  it("uses debit/credit when both available (customer)", () => {
    expect(effectiveBalanceBase(100, 30, 0, "customer")).toBe(70);
  });

  it("uses debit/credit when both available (supplier, flipped)", () => {
    expect(effectiveBalanceBase(30, 100, 0, "supplier")).toBe(70);
  });

  it("falls back to balance when debit undefined", () => {
    expect(effectiveBalanceBase(undefined, 30, 50, "customer")).toBe(50);
  });

  it("falls back to balance when credit undefined", () => {
    expect(effectiveBalanceBase(100, undefined, 50, "customer")).toBe(50);
  });

  it("falls back to balance when both undefined", () => {
    expect(effectiveBalanceBase(undefined, undefined, -25, "supplier")).toBe(-25);
  });
});

describe("balanceDirectionLabel", () => {
  it("customer: مدين when debit > credit", () => {
    expect(balanceDirectionLabel(100, 30, "customer")).toBe("مدين");
  });

  it("customer: دائن when credit > debit", () => {
    expect(balanceDirectionLabel(30, 100, "customer")).toBe("دائن");
  });

  it("supplier: مدين when credit > debit (flipped)", () => {
    expect(balanceDirectionLabel(30, 100, "supplier")).toBe("مدين");
  });

  it("supplier: دائن when debit > credit (flipped)", () => {
    expect(balanceDirectionLabel(100, 30, "supplier")).toBe("دائن");
  });

  it("returns — when balanced", () => {
    expect(balanceDirectionLabel(50, 50, "customer")).toBe("—");
    expect(balanceDirectionLabel(0, 0, "supplier")).toBe("—");
  });
});

describe("balanceDirectionStatus", () => {
  it("returns مدين for positive effective balance", () => {
    expect(balanceDirectionStatus(100, 30, "customer")).toBe("مدين");
  });

  it("returns دائن for negative effective balance", () => {
    expect(balanceDirectionStatus(30, 100, "customer")).toBe("دائن");
  });

  it("returns null when balanced", () => {
    expect(balanceDirectionStatus(50, 50, "customer")).toBeNull();
  });
});
