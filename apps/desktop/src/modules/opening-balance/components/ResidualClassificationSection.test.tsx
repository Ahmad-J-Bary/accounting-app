import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountDto } from "@erp/shared-types";
import { ResidualClassificationSection } from "@modules/opening-balance/components/GuidedTransitionWizard";

const SPECS = [
  {
    key: "RetainedEarnings",
    label_ar: "أرباح مبقاة",
    allows_posting: true,
    requires_confirmation: false,
    allowed_purposes: ["retained_earnings"],
    designated_account: { id: "acc-52", code: "52", name_ar: "الأرباح المبقاة" },
    treatment_ar: "سيتم نقل الرصيد من حساب التسوية الافتتاحية (53) إلى الأرباح المبقاة (52).",
  },
  {
    key: "OpeningEquityAdjustment",
    label_ar: "تعديل حقوق ملكية افتتاحي",
    allows_posting: true,
    requires_confirmation: false,
    allowed_purposes: ["opening_equity_adjustment"],
    designated_account: { id: "acc-521", code: "521", name_ar: "تعديل حقوق ملكية افتتاحي" },
    treatment_ar: "سيتم النقل إلى (521).",
  },
  {
    key: "PriorPeriodAdjustment",
    label_ar: "تعديل فترة سابقة",
    allows_posting: true,
    requires_confirmation: true,
    allowed_purposes: ["prior_period_adjustment"],
    designated_account: { id: "acc-525", code: "525", name_ar: "تعديل فترة سابقة" },
    treatment_ar: "سيتم النقل إلى (525).",
  },
  {
    key: "OtherEquity",
    label_ar: "حقوق ملكية أخرى",
    allows_posting: true,
    requires_confirmation: false,
    allowed_purposes: ["other_equity"],
    designated_account: { id: "acc-526", code: "526", name_ar: "حقوق ملكية أخرى" },
    treatment_ar: "سيتم النقل إلى (526).",
  },
  {
    key: "UnresolvedDifference",
    label_ar: "فرق غير محلول",
    allows_posting: false,
    requires_confirmation: false,
    allowed_purposes: [],
    designated_account: null,
    treatment_ar: "الفرق غير محلول.",
  },
];

const ACCOUNTS: AccountDto[] = [
  {
    id: "acc-52",
    code: "52",
    name_ar: "الأرباح المبقاة",
    name_en: "Retained Earnings",
    account_type: "Equity",
    parent_id: null,
    category: "Detail",
    level: 2,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: true,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    purpose: "retained_earnings",
  },
  {
    id: "acc-5401",
    code: "5401",
    name_ar: "حساب شريك جاري",
    name_en: "Partner Current",
    account_type: "Equity",
    parent_id: null,
    category: "Detail",
    level: 4,
    opening_balance: "0",
    balance: "0",
    notes: null,
    is_active: true,
    is_default: false,
    is_final: false,
    linked_customer_id: null,
    linked_supplier_id: null,
    debit: "0",
    credit: "0",
    purpose: "partner_current",
  },
];

function renderSection(props?: Partial<React.ComponentProps<typeof ResidualClassificationSection>>) {
  const onValueChange = vi.fn();
  const onResidualAccountChange = vi.fn();
  render(
    <ResidualClassificationSection
      residual={100}
      plugAmount={100}
      specs={SPECS}
      value=""
      onValueChange={onValueChange}
      residualAccountId=""
      onResidualAccountChange={onResidualAccountChange}
      accounts={ACCOUNTS}
      spec={undefined}
      {...props}
    />,
  );
  return { onValueChange, onResidualAccountChange };
}

describe("ResidualClassificationSection", () => {
  it("offers the five meaning-first classifications", () => {
    renderSection();
    for (const s of SPECS) {
      expect(screen.getByRole("radio", { name: s.label_ar })).toBeInTheDocument();
    }
  });

  it("applies a real classification through the callback", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSection();
    await user.click(screen.getByRole("radio", { name: "أرباح مبقاة" }));
    expect(onValueChange).toHaveBeenCalledWith("RetainedEarnings");
  });

  it("shows the treatment preview and the designated account once classified", () => {
    renderSection({ value: "RetainedEarnings", residualAccountId: "acc-52", spec: SPECS[0] });
    expect(screen.getByText(/معاينة قبل التسجيل/)).toBeInTheDocument();
    expect(screen.getByText("سيتم نقل الرصيد من حساب التسوية الافتتاحية (53) إلى الأرباح المبقاة (52).")).toBeInTheDocument();
    expect(screen.getByText("الأرباح المبقاة")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
  });

  it("never proposes a raw partner-current account in the default view", () => {
    renderSection();
    expect(screen.queryByText("حساب شريك جاري")).not.toBeInTheDocument();
    expect(screen.getByText(/اختيار الحساب يدوياً/)).toBeInTheDocument();
  });

  it("filters Advanced-mode accounts to the classification's controlled purposes", async () => {
    const user = userEvent.setup();
    renderSection({ value: "RetainedEarnings", residualAccountId: "acc-52", spec: SPECS[0] });
    await user.click(screen.getByText(/اختيار الحساب يدوياً/));
    await user.click(screen.getByRole("combobox"));
    expect((await screen.findAllByText("الأرباح المبقاة")).length).toBeGreaterThanOrEqual(1);
    await user.type(screen.getByPlaceholderText("ابحث برمز الحساب أو الاسم..."), "شريك جاري");
    expect(screen.getByText("لا توجد حسابات بالغرض المحدد لهذا التصنيف")).toBeInTheDocument();
  });

  it("blocks with a clear red notice when the difference is unresolved", async () => {
    const user = userEvent.setup();
    renderSection({ value: "UnresolvedDifference", spec: SPECS[4] });
    await user.click(screen.getByRole("radio", { name: "فرق غير محلول" }));
    expect(screen.getByText(/فرق غير محلول — لن يُرحَّل ولن يُقفَل/)).toBeInTheDocument();
    expect(screen.getByText(/لا يحمل هذا التصنيف حساباً/)).toBeInTheDocument();
  });

  it("asks for confirmation before applying PriorPeriodAdjustment", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSection();
    await user.click(screen.getByRole("radio", { name: "تعديل فترة سابقة" }));
    expect(screen.getByText(/تأكيد تصنيف «تعديل فترة سابقة»/)).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "تأكيد التصنيف" }));
    expect(onValueChange).toHaveBeenCalledWith("PriorPeriodAdjustment");
  });

  it("reverts when the PriorPeriodAdjustment confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderSection();
    await user.click(screen.getByRole("radio", { name: "تعديل فترة سابقة" }));
    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});