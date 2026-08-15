import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithCompanyType } from "@/test/companyTypeFixture";
import {
  COMPANY_TYPE_EXISTING,
  COMPANY_TYPE_NEW,
} from "@modules/opening-balance/lib/company-lifecycle";
import { FixedAssetForm } from "./FixedAssetForm";

vi.mock("@modules/fixed-assets/api/fixedAssetService", () => ({
  fixedAssetService: {
    listCategories: vi.fn().mockResolvedValue([]),
    createCategory: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@modules/accounting/api/accountingService", () => ({
  accountingService: { getChartOfAccounts: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@modules/inventory/api/warehouseService", () => ({
  warehouseService: { list: vi.fn().mockResolvedValue([]) },
}));

function renderForm(companyType: string) {
  return renderWithCompanyType(
    <FixedAssetForm
      onClose={vi.fn()}
      onSaved={vi.fn()}
      currencies={[]}
    />,
    companyType as never,
  );
}

describe("FixedAssetForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("NEW company: only the natural purchase workflow exists (no 'أصل سابق' / opening asset)", () => {
    renderForm(COMPANY_TYPE_NEW);
    expect(screen.getByText("شراء أصل جديد")).toBeInTheDocument();
    expect(screen.queryByText("أصل سابق")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/إضافة أصل سابق/),
    ).not.toBeInTheDocument();
  });

  it("EXISTING company: the previous-asset (أول المدة) addition toggle is available", () => {
    renderForm(COMPANY_TYPE_EXISTING);
    expect(screen.getByText("شراء جديد")).toBeInTheDocument();
    expect(screen.getByText("أصل سابق")).toBeInTheDocument();
  });
});