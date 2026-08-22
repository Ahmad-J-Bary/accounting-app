import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpeningPositionSummary } from "@modules/opening-balance/components/OpeningPositionSummary";

// Spec §23 H: the exact full example.
//   Assets: Cash 25,000 · Bank 40,000 · Receivables 80,000 · Inventory 120,000
//           · Fixed Assets 200,000                             = 465,000
//   Liabilities: Suppliers 70,000 · Loan 50,000                = 120,000
//   Net Assets = 345,000 · Partner Capital = 300,000
//   Residual = Net Assets − Recognized Equity = 45,000
const H = {
  cash: 25000,
  bank: 40000,
  receivables: 80000,
  inventory: 120000,
  fixedAssets: 200000,
  suppliers: 70000,
  loans: 50000,
  otherLiabilities: 0,
  partnerCapital: 300000,
  partnerCurrent: 0,
  otherEquity: 0,
  residual: 45000,
};

function renderSummary(patch: Partial<Parameters<typeof OpeningPositionSummary>[0]> = {}) {
  const { container } = render(
    <OpeningPositionSummary
      {...H}
      plugAmount={0}
      balanced={false}
      hints={[]}
      {...patch}
    />,
  );
  return { container, text: container.textContent || "" };
}

describe("OpeningPositionSummary", () => {
  it("shows the exact §23 H position before classification (Difference 45,000)", () => {
    const { text } = renderSummary();
    expect(text).toContain("465,000.00"); // Total Assets
    expect(text).toContain("120,000.00"); // Total Liabilities (and Inventory line)
    expect(text).toContain("345,000.00"); // Net Assets
    expect(text).toContain("300,000.00"); // Partner Capital
    expect(text).toContain("45,000.00"); // Residual / Difference
    expect(text).toContain("الفرق (رصيد غير مصنّف):");
    expect(screen.getByText("يوجد فرق")).toBeInTheDocument();
  });

  it("reports Difference = 0 and balanced after the residual is classified", () => {
    const { text } = renderSummary({ plugAmount: 45000, balanced: true });
    expect(text).toContain("الفرق = 0 — متوازن ✓");
    // Equity side now carries the classified 53 plug (300,000 + 45,000).
    expect(text).toContain("345,000.00");
    expect(text).toContain("تسوية الرصيد الافتتاحي (53)");
    expect(screen.getByText("متوازن ✓")).toBeInTheDocument();
  });

  it("renders section-targeted smart hints (§14)", () => {
    const hint = "إجمالي الأصول أكبر من الخصوم وحقوق الملكية بمبلغ 5,000.00";
    renderSummary({ hints: [hint], residual: 5000 });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("derives a debit imbalance hint that points to the section", () => {
    // residual negative → liabilities + equity exceed assets.
    const hint = "الخصوم وحقوق الملكية تزيد عن الأصول بمبلغ 10,000.00";
    renderSummary({ hints: [hint], residual: -10000 });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });
});