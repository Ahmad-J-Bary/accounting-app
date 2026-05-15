import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, formatDate, formatDateTime } from "./format";

describe("formatCurrency", () => {
  it("formats with default currency", () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain("ل.س");
    expect(result.length).toBeGreaterThan(5);
  });

  it("formats with USD symbol", () => {
    const result = formatCurrency(5000, "$");
    expect(result).toContain("$");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "$");
    expect(result).toContain("$");
  });

  it("handles negative values", () => {
    const result = formatCurrency(-100, "USD");
    expect(result).toContain("USD");
    expect(result).toContain("-");
  });
});

describe("formatNumber", () => {
  it("formats number without currency", () => {
    const result = formatNumber(1000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats decimal", () => {
    const result = formatNumber(99.5);
    expect(result).toContain("٩٩"); // Arabic-Indic digits
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("٠"); // Arabic-Indic zero
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
