import { X } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { toFixed } from "@shared/lib/format";
import type { AccountDto } from "@erp/shared-types";
import { toNum, type WizLine } from "@modules/opening-balance/lib/wizard-types";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";

interface AutoAmountSectionProps {
  title: string;
  hint?: string;
  rows: WizLine[];
  onAdd: () => void;
  onPatch: (key: string, patch: Partial<WizLine>) => void;
  onRemove: (key: string) => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
  defaultAccount: string;
  addLabel?: string;
}

/**
 * Amount-only section: the accountant types an amount and the account is
 * auto-defaulted (from the section's semantic default) with a manual override.
 * Used for cash/banks and loans — no debit/credit thinking required.
 */
export function AutoAmountSection({
  title,
  hint,
  rows,
  onAdd,
  onPatch,
  onRemove,
  accounts,
  detailAccounts,
  defaultAccount,
  addLabel,
}: AutoAmountSectionProps) {
  const total = rows.reduce((s, r) => s + toNum(r.amount), 0);
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {rows.length === 0 && <p className="text-xs text-slate-400 py-1">لا توجد بنود بعد — أضف بنداً وأدخل المبلغ.</p>}
      {rows.map((r) => {
        const invalid = r.amount.trim() !== "" && toNum(r.amount) <= 0;
        return (
          <div key={r.key} className="flex items-stretch gap-2">
            <div className="w-36 shrink-0">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={r.amount}
                onChange={(e) => onPatch(r.key, { amount: e.target.value })}
                placeholder="المبلغ"
                aria-label="المبلغ"
                className={"h-9 text-right tabular-nums " + (invalid ? "border-red-400" : "border-slate-200")}
              />
            </div>
            <div className="flex-1 min-w-0">
              <AccountCombobox
                accounts={accounts}
                options={detailAccounts}
                value={r.account_id}
                onValueChange={(id) => onPatch(r.key, { account_id: id })}
                placeholder={defaultAccount ? "تم اختيار الحساب الافتراضي" : "اختر الحساب..."}
                disabled={false}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="حذف البند"
              onClick={() => onRemove(r.key)}
              className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="border-slate-200 text-slate-600 font-bold">
        + {addLabel || "إضافة بند"}
      </Button>
      {total > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">{toFixed(total, 2)}</span>
        </div>
      )}
    </div>
  );
}