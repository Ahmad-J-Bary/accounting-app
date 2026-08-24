import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardLineEditor } from "@modules/opening-balance/components/WizardLineEditor";
import type { WizLine } from "@modules/opening-balance/lib/wizard-types";
import type { AccountDto } from "@erp/shared-types";

const ACCOUNTS: AccountDto[] = [
  {
    id: "a1",
    code: "111100",
    name_ar: "الصندوق",
    account_type: "Assets",
    category: "Detail",
    is_active: true,
  } as AccountDto,
  {
    id: "a2",
    code: "211100",
    name_ar: "الموردون",
    account_type: "Liabilities",
    category: "Detail",
    is_active: true,
  } as AccountDto,
];

function Harness() {
  const [rows, setRows] = useState<WizLine[]>([{ key: "r1", account_id: "", amount: "" }]);
  const updateLine = (setter: typeof setRows, key: string, patch: Partial<WizLine>) =>
    setter((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  return (
    <WizardLineEditor
      rows={rows}
      setter={setRows}
      updateLine={updateLine}
      placeholder="ابحث واختر حساب أصل..."
      accounts={ACCOUNTS}
      detailAccounts={ACCOUNTS}
    />
  );
}

describe("WizardLineEditor", () => {
  it("renders an empty state when no rows exist", () => {
    render(
      <WizardLineEditor
        rows={[]}
        setter={vi.fn()}
        updateLine={vi.fn()}
        placeholder="x"
        accounts={ACCOUNTS}
        detailAccounts={ACCOUNTS}
      />,
    );
    expect(screen.getByText("لا توجد بنود بعد")).toBeInTheDocument();
  });

it("adds a row via the add button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /تعديل/ }));
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /إضافة بند/ }));
    // New row starts in edit mode immediately (no "تعديل" click needed)
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("removes a row through the delete button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "حذف هذا البند" }));
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("shows the running subtotal once rows have amounts", () => {
    render(
      <WizardLineEditor
        rows={[{ key: "r1", account_id: "a1", amount: "500" }]}
        setter={vi.fn()}
        updateLine={vi.fn()}
        placeholder="x"
        accounts={ACCOUNTS}
        detailAccounts={ACCOUNTS}
      />,
    );
    expect(screen.getByText("الإجمالي")).toBeInTheDocument();
  });

  it("flags an invalid (non-positive) amount inline", () => {
    render(
      <WizardLineEditor
        rows={[{ key: "r1", account_id: "a1", amount: "-5" }]}
        setter={vi.fn()}
        updateLine={vi.fn()}
        placeholder="x"
        accounts={ACCOUNTS}
        detailAccounts={ACCOUNTS}
      />,
    );
    expect(screen.getByText("أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند.")).toBeInTheDocument();
  });
});