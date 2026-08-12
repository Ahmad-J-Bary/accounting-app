import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";
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

describe("AccountCombobox", () => {
  it("shows the placeholder when no account is selected", () => {
    render(<AccountCombobox accounts={ACCOUNTS} value="" onValueChange={vi.fn()} />);
    expect(screen.getByText("ابحث واختر حساباً...")).toBeInTheDocument();
  });

  it("shows the selected account as a chip with code and name", () => {
    render(<AccountCombobox accounts={ACCOUNTS} value="a2" onValueChange={vi.fn()} />);
    expect(screen.getByText("211100")).toBeInTheDocument();
    expect(screen.getByText("الموردون")).toBeInTheDocument();
    expect(screen.getByText("دائن")).toBeInTheDocument();
  });

  it("filters options and selects by name", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AccountCombobox accounts={ACCOUNTS} value="" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("ابحث برمز الحساب أو الاسم..."), "صندوق");
    await user.click(screen.getByText("الصندوق"));
    expect(onValueChange).toHaveBeenCalledWith("a1");
  });

  it("filters options by code", async () => {
    const user = userEvent.setup();
    render(<AccountCombobox accounts={ACCOUNTS} value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("ابحث برمز الحساب أو الاسم..."), "2111");
    expect(screen.getByText("الموردون")).toBeInTheDocument();
    expect(screen.queryByText("الصندوق")).not.toBeInTheDocument();
  });

  it("shows an empty message when nothing matches", async () => {
    const user = userEvent.setup();
    render(<AccountCombobox accounts={ACCOUNTS} value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("ابحث برمز الحساب أو الاسم..."), "zzz");
    expect(screen.getByText("لا توجد حسابات مطابقة")).toBeInTheDocument();
  });
});