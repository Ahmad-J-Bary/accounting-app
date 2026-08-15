import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithCompanyType } from "@/test/companyTypeFixture";
import {
  COMPANY_TYPE_EXISTING,
  COMPANY_TYPE_NEW,
} from "@modules/opening-balance/lib/company-lifecycle";
import type { CustomerDto, SupplierDto } from "@erp/shared-types";
import { PartnerFormPanel } from "./PartnerFormPanel";
import { PartnerForm } from "./PartnerForm";
import { PartnerDetailPanel } from "./PartnerDetailPanel";

function customerDto(): CustomerDto {
  return {
    id: "c1",
    code: "1",
    name: "عميل test",
    phone: null,
    address: null,
    notes: null,
    opening_balance: "500",
    debit: "500",
    credit: "0",
    currency: "SYP",
    exchange_rate: "1",
    account_id: "a1",
    is_active: true,
  } as unknown as CustomerDto;
}

describe("PartnerFormPanel (customers & suppliers)", () => {
  function renderForm(type: "customer" | "supplier", companyType: string) {
    return renderWithCompanyType(
      <PartnerFormPanel
        type={type}
        partner={null}
        accounts={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        saving={false}
      />,
      companyType as never,
    );
  }

  it("NEW company: customer form never shows opening receivable fields", () => {
    renderForm("customer", COMPANY_TYPE_NEW);
    expect(screen.getByText("إضافة عميل جديد")).toBeInTheDocument();
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
    expect(screen.queryByText("اتجاه الرصيد")).not.toBeInTheDocument();
  });

  it("NEW company: supplier form never shows opening payable fields", () => {
    renderForm("supplier", COMPANY_TYPE_NEW);
    expect(screen.getByText("إضافة مورد جديد")).toBeInTheDocument();
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
    expect(screen.queryByText("اتجاه الرصيد")).not.toBeInTheDocument();
  });

  it("EXISTING company: customer form still exposes the opening receivable fields", () => {
    renderForm("customer", COMPANY_TYPE_EXISTING);
    expect(screen.getByText("الرصيد الافتتاحي")).toBeInTheDocument();
    expect(screen.getByText("اتجاه الرصيد")).toBeInTheDocument();
  });

  it("EXISTING company: supplier form still exposes the opening payable fields", () => {
    renderForm("supplier", COMPANY_TYPE_EXISTING);
    expect(screen.getByText("الرصيد الافتتاحي")).toBeInTheDocument();
  });
});

describe("PartnerDetailPanel (customer/supplier detail)", () => {
  function renderDetail(companyType: string) {
    return renderWithCompanyType(
      <PartnerDetailPanel
        type="customer"
        partner={customerDto()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      companyType as never,
    );
  }

  it("NEW company: detail hides the opening balance rows", () => {
    renderDetail(COMPANY_TYPE_NEW);
    expect(screen.getByText("بيانات العميل")).toBeInTheDocument();
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
    expect(screen.queryByText("اتجاه الرصيد")).not.toBeInTheDocument();
  });

  it("EXISTING company: detail shows the opening balance rows", () => {
    renderDetail(COMPANY_TYPE_EXISTING);
    expect(screen.getByText("الرصيد الافتتاحي")).toBeInTheDocument();
  });
});

describe("PartnerForm (capital / equity workflow)", () => {
  it("never exposes opening equity fields for a NEW company (natural capital workflow)", () => {
    renderWithCompanyType(
      <PartnerForm
        open={true}
        partner={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
      COMPANY_TYPE_NEW as never,
    );
    expect(screen.getByText("إضافة شريك جديد")).toBeInTheDocument();
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
  });

  it("never exposes opening equity fields for an EXISTING company either", () => {
    renderWithCompanyType(
      <PartnerForm
        open={true}
        partner={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
      COMPANY_TYPE_EXISTING as never,
    );
    expect(screen.queryByText("الرصيد الافتتاحي")).not.toBeInTheDocument();
  });
});