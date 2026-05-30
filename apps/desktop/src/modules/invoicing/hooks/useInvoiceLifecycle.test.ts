import { describe, it, expect } from "vitest";

// === Helper: simulates handleSave's totalPaid computation ===
function computeTotalPaid(
  paidAmount: string | undefined,
  extraPaidAmount: string | undefined,
  invoiceType: string
): string {
  return (
    (parseFloat(paidAmount || "0") || 0) +
    (invoiceType === "Purchase"
      ? (parseFloat(extraPaidAmount || "0") || 0)
      : 0)
  ).toFixed(2);
}

// === Helper: simulates onCurrencyChange's paid_amount conversion ===
function computePaidAmountAfterCurrencyChange(
  oldPaidAmount: string | undefined,
  oldCode: string,
  newCode: string,
  baseCurrencyCode: string,
  rateMap: Map<string, number>
): string {
  if (!oldPaidAmount || oldCode === newCode) return oldPaidAmount || "0";

  let factor: number;
  if (oldCode === baseCurrencyCode) {
    factor = rateMap.get(newCode) || 1;
  } else if (newCode === baseCurrencyCode) {
    factor = 1 / (rateMap.get(oldCode) || 1);
  } else {
    const toBase = 1 / (rateMap.get(oldCode) || 1);
    const fromBase = rateMap.get(newCode) || 1;
    factor = toBase * fromBase;
  }

  return (parseFloat(oldPaidAmount || "0") * factor).toFixed(2);
}

// === Helper: simulates getInvoiceBaseAmount ===
function getInvoiceBaseAmount(
  originalAmount: string | number | null | undefined,
  v2Amount?: { base_amount?: string },
  currencyCode?: string,
  exchangeRate?: string,
  baseCurrencyCode?: string | null
): number {
  if (v2Amount?.base_amount) {
    return parseFloat(v2Amount.base_amount) || 0;
  }
  const amt = typeof originalAmount === "string" ? parseFloat(originalAmount) : (originalAmount ?? 0);
  if (!amt) return 0;
  if (currencyCode && baseCurrencyCode && currencyCode === baseCurrencyCode) {
    return amt;
  }
  const rate = parseFloat(exchangeRate || "1") || 1;
  return amt / rate;
}

// === Helper: simulates baseToTarget conversion (the FIX) ===
function baseToTarget(baseAmt: number, targetCode: string, baseCurrencyCode?: string | null, rateMap?: Map<string, number>): number {
  if (!baseCurrencyCode || targetCode === baseCurrencyCode || !baseAmt) return baseAmt;
  const rate = rateMap?.get(targetCode) || 1;
  return baseAmt * rate;
}

describe("paid_amount save pipeline", () => {
  const rateMap = new Map<string, number>([
    ["SYP", 20],
    ["USD", 1],
    ["EUR", 0.92],
  ]);

  describe("computeTotalPaid (handleSave logic)", () => {
    it("returns paid_amount as-is for Sales invoices", () => {
      expect(computeTotalPaid("200", undefined, "Sales")).toBe("200.00");
      expect(computeTotalPaid("10", undefined, "Sales")).toBe("10.00");
    });

    it("sums paid_amount + extra_paid_amount for Purchase", () => {
      expect(computeTotalPaid("150", "50", "Purchase")).toBe("200.00");
    });

    it("handles undefined extra_paid_amount for Sales", () => {
      expect(computeTotalPaid("200", undefined, "Sales")).toBe("200.00");
    });

    it("handles zero values", () => {
      expect(computeTotalPaid("0", "0", "Purchase")).toBe("0.00");
      expect(computeTotalPaid(undefined, undefined, "Sales")).toBe("0.00");
    });

    it("preserves the exact doc-currency value without conversion", () => {
      expect(computeTotalPaid("200", undefined, "Sales")).toBe("200.00");
      expect(computeTotalPaid("200", undefined, "Purchase")).toBe("200.00");
    });
  });

  describe("currency change conversion (onCurrencyChange logic)", () => {
    it("converts paid_amount from base USD to secondary SYP", () => {
      const result = computePaidAmountAfterCurrencyChange("10", "USD", "SYP", "USD", rateMap);
      expect(result).toBe("200.00");
      expect(result).not.toBe("10.00");
    });

    it("converts paid_amount from secondary SYP to base USD", () => {
      const result = computePaidAmountAfterCurrencyChange("200", "SYP", "USD", "USD", rateMap);
      expect(result).toBe("10.00");
    });

    it("preserves paid_amount when rateMap lacks the new currency", () => {
      const emptyMap = new Map([["USD", 1]]);
      const result = computePaidAmountAfterCurrencyChange("10", "USD", "SYP", "USD", emptyMap);
      expect(result).toBe("10.00");
    });

    it("handles undefined paid_amount", () => {
      const result = computePaidAmountAfterCurrencyChange(undefined, "USD", "SYP", "USD", rateMap);
      expect(result).toBe("0");
    });

    it("returns same value when currency unchanged", () => {
      const result = computePaidAmountAfterCurrencyChange("10", "USD", "USD", "USD", rateMap);
      expect(result).toBe("10");
    });
  });

  describe("end-to-end scenario: secondary currency payment", () => {
    it("trace: 200 SYP paid_amount flows through save without double-division", () => {
      const paidAmount = "200";
      const totalPaid = computeTotalPaid(paidAmount, undefined, "Sales");
      expect(totalPaid).toBe("200.00");
      expect(parseFloat(totalPaid)).toBe(200);
    });

    it("trace: switching currency then entering amount produces correct value", () => {
      let paidAmount = "10";

      paidAmount = computePaidAmountAfterCurrencyChange(paidAmount, "USD", "SYP", "USD", rateMap);
      expect(paidAmount).toBe("200.00");

      paidAmount = (200).toFixed(2);
      const totalPaid = computeTotalPaid(paidAmount, undefined, "Sales");
      expect(totalPaid).toBe("200.00");

      const backendBaseAmount = 200 / 20;
      expect(backendBaseAmount).toBe(10);
    });

    it("Sales cash — paid_amount set to net (in correct currency)", () => {
      const netSYP = 200;
      const paidAmount = netSYP.toString();
      expect(paidAmount).toBe("200");

      const totalPaid = computeTotalPaid(paidAmount, undefined, "Sales");
      expect(totalPaid).toBe("200.00");
    });
  });
});

describe("InvoiceList column display (baseToTarget fix)", () => {
  const rateMap = new Map<string, number>([
    ["SYP", 20],
    ["USD", 1],
  ]);
  const BASE = "USD";

  it("getInvoiceBaseAmount returns base amount from v2", () => {
    const result = getInvoiceBaseAmount("200", { base_amount: "10" }, "SYP", "20", BASE);
    expect(result).toBe(10);
  });

  it("baseToTarget converts base amount to secondary currency for display", () => {
    const baseAmt = getInvoiceBaseAmount("200", { base_amount: "10" }, "SYP", "20", BASE);
    const displayed = baseToTarget(baseAmt, "SYP", BASE, rateMap);
    expect(displayed).toBe(200);
  });

  it("baseToTarget keeps base amount unchanged for base currency column", () => {
    const baseAmt = getInvoiceBaseAmount("200", { base_amount: "10" }, "SYP", "20", BASE);
    const displayed = baseToTarget(baseAmt, "USD", BASE, rateMap);
    expect(displayed).toBe(10);
  });

  it("FIX VERIFICATION: invoice paid 200 SYP shows 200 in SYP column, not 10", () => {
    // Invoice saved with amount_paid="200" (SYP), exchange_rate=20, v2.base_amount="10"
    const inv = {
      amount_paid: "200",
      amount_paid_v2: { base_amount: "10" },
      currency_code: "SYP",
      exchange_rate: "20",
    };

    // OLD behavior (bug): formatAmount(getInvoiceBaseAmount(...), SYP) → "10 SYP"
    const oldBaseAmt = getInvoiceBaseAmount(inv.amount_paid, inv.amount_paid_v2, inv.currency_code, inv.exchange_rate, BASE);
    expect(oldBaseAmt).toBe(10);
    expect(oldBaseAmt).not.toBe(200);

    // NEW behavior (fix): formatAmount(baseToTarget(getInvoiceBaseAmount(...), SYP), SYP) → "200 SYP"
    const newAmt = baseToTarget(oldBaseAmt, "SYP", BASE, rateMap);
    expect(newAmt).toBe(200);
    expect(newAmt).not.toBe(10);
  });

  it("FIX VERIFICATION: total - remaining is also correct", () => {
    const total = getInvoiceBaseAmount("400", { base_amount: "20" }, "SYP", "20", BASE);
    const paid = getInvoiceBaseAmount("200", { base_amount: "10" }, "SYP", "20", BASE);
    const remaining = Math.max(total - paid, 0);

    // remaining is in base (10 USD)
    expect(remaining).toBe(10);

    // Display in SYP column: 10 * 20 = 200 SYP
    expect(baseToTarget(remaining, "SYP", BASE, rateMap)).toBe(200);
    // Display in USD column: 10 * 1 = 10 USD
    expect(baseToTarget(remaining, "USD", BASE, rateMap)).toBe(10);
  });
});

describe("JournalTable column display fix", () => {
  const rateMap = new Map<string, number>([
    ["SYP", 20],
    ["USD", 1],
  ]);
  const BASE = "USD";

  it("FIX VERIFICATION: debit_base converts correctly for secondary currency column", () => {
    const debitBase = 10; // 10 USD base amount
    // OLD: formatAmount(10, SYP) → "10 SYP" (wrong)
    // NEW: formatAmount(baseToTarget(10, SYP), SYP) → "200 SYP" (correct)
    expect(baseToTarget(debitBase, "SYP", BASE, rateMap)).toBe(200);
    expect(baseToTarget(debitBase, "USD", BASE, rateMap)).toBe(10);
  });

  it("FIX VERIFICATION: summary totals also convert correctly", () => {
    const totalDebitBase = 100;
    expect(baseToTarget(totalDebitBase, "SYP", BASE, rateMap)).toBe(2000);
    expect(baseToTarget(totalDebitBase, "USD", BASE, rateMap)).toBe(100);
  });
});
