import { describe, it, expect, beforeEach } from "vitest";
import { formatCurrency, formatNumber, formatDate, formatDateTime, setNumberingSystem, getNumberingSystem } from "./format";

describe("formatCurrency", () => {
  it("formats without forcing a default currency", () => {
    const result = formatCurrency(1234.5);
    expect(result).not.toContain(" ");
    expect(result.length).toBeGreaterThan(5);
  });

  it("formats with a provided currency symbol", () => {
    const result = formatCurrency(5000, "EUR");
    expect(result).toContain("EUR");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "TRY");
    expect(result).toContain("TRY");
  });

  it("handles negative values", () => {
    const result = formatCurrency(-100, "BASE");
    expect(result).toContain("BASE");
    expect(result).toContain("-");
  });
});

describe("formatNumber", () => {
  beforeEach(() => {
    setNumberingSystem("arabic");
  });

  it("formats number without currency", () => {
    const result = formatNumber(1000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats decimal with Arabic numerals", () => {
    const result = formatNumber(99.5);
    expect(result).toContain("٩٩");
  });

  it("handles zero with Arabic numerals", () => {
    expect(formatNumber(0)).toBe("٠");
  });

  it("formats decimal with Western numerals", () => {
    setNumberingSystem("western");
    const result = formatNumber(99.5);
    expect(result).toContain("99");
  });

  it("handles zero with Western numerals", () => {
    setNumberingSystem("western");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("setNumberingSystem / getNumberingSystem", () => {
  it("defaults to arab", () => {
    setNumberingSystem("arabic");
    expect(getNumberingSystem()).toBe("arab");
  });

  it("switches to latn", () => {
    setNumberingSystem("western");
    expect(getNumberingSystem()).toBe("latn");
  });

  it("resets back to arab", () => {
    setNumberingSystem("western");
    setNumberingSystem("arabic");
    expect(getNumberingSystem()).toBe("arab");
  });
});

describe("formatDate", () => {
  it("formats ISO date string", () => {
    const result = formatDate("2026-05-15");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("formats Date object", () => {
    const result = formatDate(new Date(2026, 0, 1));
    expect(result).toBeTruthy();
  });
});

describe("formatDateTime", () => {
  it("formats with time", () => {
    const result = formatDateTime("2026-05-15T10:30:00");
    expect(result).toBeTruthy();
  });
});
