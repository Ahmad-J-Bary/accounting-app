import type { Dispatch, SetStateAction } from "react";
import { Input } from "@shared/ui/input";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { toFixed } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import type { WizLine } from "@modules/opening-balance/lib/wizard-types";
import { newLine } from "@modules/opening-balance/lib/wizard-types";
import { AccountLineRow } from "./AccountLineRow";
import { AddLineButton } from "./AddLineButton";

interface WizardLineEditorProps {
  rows: WizLine[];
  setter: Dispatch<SetStateAction<WizLine[]>>;
  updateLine: (setter: Dispatch<SetStateAction<WizLine[]>>, key: string, patch: Partial<WizLine>) => void;
  placeholder: string;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}

export function WizardLineEditor({ rows, setter, updateLine, placeholder, accounts, detailAccounts }: WizardLineEditorProps) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <EmptyState message="لا توجد بنود بعد" suggestion="أضف بنداً واختر الحساب والمبلغ" compact />
      )}
      {rows.map((l) => {
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <AccountLineRow
            key={l.key}
            accountId={l.account_id}
            onAccountChange={(id) => updateLine(setter, l.key, { account_id: id })}
            amount={l.amount}
            onAmountChange={(amount) => updateLine(setter, l.key, { amount })}
            onRemove={() => setter((prev) => prev.filter((x) => x.key !== l.key))}
            accounts={accounts}
            options={detailAccounts}
            placeholder={placeholder}
            showErrorMessage={amountInvalid}
          />
        );
      })}
      <AddLineButton onClick={() => setter((prev) => [...prev, newLine()])} />
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(rows.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
          </span>
        </div>
      )}
    </div>
  );
}