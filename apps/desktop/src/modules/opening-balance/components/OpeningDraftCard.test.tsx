import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { OpeningDraftCard } from "@modules/opening-balance/components/OpeningDraftCard";
import type { AccountLine } from "@modules/opening-balance/lib/migration-labels";
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
];
function Harness() {
  const [lines, setLines] = useState<AccountLine[]>([]);
  const debitTotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const creditTotal = 0;
  const isValid = debitTotal === creditTotal && lines.some((l) => l.account_id && parseFloat(l.amount) > 0);

  return (
    <OpeningDraftCard
      cutoverDate="2026-01-01"
      onCutoverDateChange={vi.fn()}
      notes=""
      onNotesChange={vi.fn()}
      lines={lines}
      detailAccounts={ACCOUNTS}
      accounts={ACCOUNTS}
      onAddLine={() => setLines((prev) => [...prev, { key: `r${prev.length + 1}`, account_id: "", amount: "", description: "" }])}
      onRemoveLine={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
      onUpdateLine={(key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))}
      debitTotal={debitTotal}
      creditTotal={creditTotal}
      isValid={isValid}
      saving={false}
      onSaveDraft={vi.fn()}
    />
  );
}

describe("OpeningDraftCard", () => {
  it("disables save on an empty draft", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "حفظ المسودة" })).toBeDisabled();
  });

  it("shows an inline hint when the draft is empty", () => {
    render(<Harness />);
    expect(screen.getByText(/أضف بنود الحسابات قبل حفظ المسودة/)).toBeInTheDocument();
  });

  it("enables save when the draft is balanced", () => {
    render(
      <OpeningDraftCard
        cutoverDate="2026-01-01"
        onCutoverDateChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        lines={[
          { key: "r1", account_id: "a1", amount: "100", description: "" },
          { key: "r2", account_id: "a1", amount: "100", description: "" },
        ]}
        detailAccounts={ACCOUNTS}
        accounts={ACCOUNTS}
        onAddLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onUpdateLine={vi.fn()}
        debitTotal={200}
        creditTotal={200}
        isValid={true}
        saving={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "حفظ المسودة" })).toBeEnabled();
    expect(screen.getByText(/متوازن ✓/)).toBeInTheDocument();
  });

  it("flags a missing account inline", () => {
    render(
      <OpeningDraftCard
        cutoverDate="2026-01-01"
        onCutoverDateChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        lines={[{ key: "r1", account_id: "", amount: "100", description: "" }]}
        detailAccounts={ACCOUNTS}
        accounts={ACCOUNTS}
        onAddLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onUpdateLine={vi.fn()}
        debitTotal={0}
        creditTotal={0}
        isValid={false}
        saving={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByText(/اختر حساباً لهذا البند قبل الحفظ/)).toBeInTheDocument();
  });

  it("flags an invalid amount inline", () => {
    render(
      <OpeningDraftCard
        cutoverDate="2026-01-01"
        onCutoverDateChange={vi.fn()}
        notes=""
        onNotesChange={vi.fn()}
        lines={[{ key: "r1", account_id: "a1", amount: "-5", description: "" }]}
        detailAccounts={ACCOUNTS}
        accounts={ACCOUNTS}
        onAddLine={vi.fn()}
        onRemoveLine={vi.fn()}
        onUpdateLine={vi.fn()}
        debitTotal={0}
        creditTotal={0}
        isValid={false}
        saving={false}
        onSaveDraft={vi.fn()}
      />,
    );
    expect(screen.getByText("أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند.")).toBeInTheDocument();
  });
});