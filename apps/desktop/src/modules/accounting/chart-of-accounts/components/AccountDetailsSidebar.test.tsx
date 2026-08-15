import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithCompanyType } from "@/test/companyTypeFixture";
import {
  COMPANY_TYPE_EXISTING,
  COMPANY_TYPE_NEW,
} from "@modules/opening-balance/lib/company-lifecycle";
import type { AccountDto } from "@erp/shared-types";
import { AccountDetailsSidebar } from "./AccountDetailsSidebar";

function customersParent(): AccountDto {
  return {
    id: "p1",
    code: "1230",
    name_ar: "المدينون",
    name_en: "Customers",
    account_type: "Assets",
    parent_id: null,
    category: "Detail",
    level: 1,
    opening_balance: "0",
    is_default: false,
    is_active: true,
  } as AccountDto;
}

function renderCreateForm(companyType: string) {
  const selected = customersParent();
  const ui = renderWithCompanyType(
    <AccountDetailsSidebar
      selected={selected}
      allAccounts={[selected]}
      onSaved={vi.fn()}
      onDelete={vi.fn()}
    />,
    companyType as never,
  );
  fireEvent(window, new Event("erp:open-new-account"));
  return ui;
}

describe("AccountDetailsSidebar — account creation (Accounts, Cash, Banks)", () => {
  it("NEW company: account form never shows opening balance fields", () => {
    renderCreateForm(COMPANY_TYPE_NEW);
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
    expect(screen.queryByText("مدين")).not.toBeInTheDocument();
    expect(screen.queryByText("دائن")).not.toBeInTheDocument();
  });

  it("EXISTING company: account form exposes the opening balance field", () => {
    renderCreateForm(COMPANY_TYPE_EXISTING);
    expect(screen.getByText("الرصيد الافتتاحي")).toBeInTheDocument();
  });

  it("EXISTING company: linked customer/supplier account form exposes debit/credit opening fields", () => {
    renderCreateForm(COMPANY_TYPE_EXISTING);
    expect(screen.getByText("مدين")).toBeInTheDocument();
    expect(screen.getByText("دائن")).toBeInTheDocument();
  });
});