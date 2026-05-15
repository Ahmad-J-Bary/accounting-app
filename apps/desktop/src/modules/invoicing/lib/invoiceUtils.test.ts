import { describe, it, expect } from "vitest";
import { newGridLine, calcLineTotal, toBackendLines } from "./invoiceUtils";
import type { GridLine } from "./invoiceUtils";

describe("newGridLine", () => {
  it("creates a line with unique _id", () => {
    const a = newGridLine();
    const b = newGridLine();
    expect(a._id).toBeTruthy();
    expect(a._id).not.toBe(b._id);
  });

  it("initializes with empty values", () => {
    const line = newGridLine();
    expect(line.material_id).toBe("");
    expect(line.quantity).toBe("");
    expect(line.unit_price).toBe("");
    expect(line.line_total).toBe(0);
  });
});

describe("calcLineTotal", () => {
  it("computes qty * price without discount", () => {
    const line: GridLine = { ...newGridLine(), quantity: "10", unit_price: "5" };
    expect(calcLineTotal(line)).toBe(50);
  });

  it("applies discount percentage", () => {
    const line: GridLine = { ...newGridLine(), quantity: "10", unit_price: "5", discount: "10" };
    expect(calcLineTotal(line)).toBe(45); // 50 - 10% = 45
  });

  it("handles zero quantity", () => {
    const line: GridLine = { ...newGridLine(), quantity: "0", unit_price: "100" };
    expect(calcLineTotal(line)).toBe(0);
  });

  it("handles empty strings", () => {
    const line: GridLine = { ...newGridLine(), quantity: "", unit_price: "" };
    expect(calcLineTotal(line)).toBe(0);
  });

  it("handles decimal prices", () => {
    const line: GridLine = { ...newGridLine(), quantity: "3", unit_price: "2.5" };
    expect(calcLineTotal(line)).toBe(7.5);
  });
});

describe("toBackendLines", () => {
  it("strips local-only fields", () => {
    const lines: GridLine[] = [
      { ...newGridLine(), material_id: "m1", material_name: "Test", quantity: "1", unit_price: "10" },
    ];
    const result = toBackendLines(lines);
    expect(result.length).toBe(1);
    expect(result[0]).not.toHaveProperty("_id");
    expect(result[0]).not.toHaveProperty("line_total");
    expect(result[0]).not.toHaveProperty("discount");
    expect(result[0].material_id).toBe("m1");
  });

  it("filters empty lines", () => {
    const lines: GridLine[] = [
      { ...newGridLine(), material_id: "m1", quantity: "1", unit_price: "10" },
      { ...newGridLine() }, // empty
    ];
    expect(toBackendLines(lines).length).toBe(1);
  });

  it("returns empty array when all lines are empty", () => {
    const lines: GridLine[] = [newGridLine(), newGridLine()];
    expect(toBackendLines(lines).length).toBe(0);
  });
});
