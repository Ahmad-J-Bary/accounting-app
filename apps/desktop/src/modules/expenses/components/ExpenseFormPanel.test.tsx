import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithCompanyType } from "@/test/companyTypeFixture";
import {
  COMPANY_TYPE_EXISTING,
  COMPANY_TYPE_NEW,
} from "@modules/opening-balance/lib/company-lifecycle";
import { ExpenseFormPanel } from "./ExpenseFormPanel";

function renderForm(companyType: string) {
  return renderWithCompanyType(
    <ExpenseFormPanel
      expense={null}
      expenseItems={[]}
      parentCode="6"
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
    companyType as never,
  );
}

describe("ExpenseFormPanel", () => {
  it("NEW company: expense item form never shows opening balance fields", () => {
    renderForm(COMPANY_TYPE_NEW);
    expect(screen.getByText("إضافة بند مصروف جديد")).toBeInTheDocument();
    expect(screen.queryByText("البيانات المالية")).not.toBeInTheDocument();
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
    expect(screen.queryByText("اتجاه الرصيد")).not.toBeInTheDocument();
  });

  it("EXISTING company: expense item form exposes the opening balance fields", () => {
    renderForm(COMPANY_TYPE_EXISTING);
    expect(screen.getByText("البيانات المالية")).toBeInTheDocument();
    expect(screen.getByText("الرصيد الافتتاحي")).toBeInTheDocument();
    expect(screen.getByText("اتجاه الرصيد")).toBeInTheDocument();
  });
});