import type { Dispatch, SetStateAction } from "react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toFixed } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import type { AccountDto } from "@erp/shared-types";
import type { WizLine } from "@modules/opening-balance/lib/wizard-types";
import { newLine } from "@modules/opening-balance/lib/wizard-types";
import { AccountCombobox } from "./AccountCombobox";

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
    <div className="space-y-1.5">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">لا توجد بنود بعد</p>
      )}
      {rows.map((l) => {
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <div key={l.key} className="space-y-0.5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition-shadow focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-200">
              <AccountCombobox
                accounts={accounts}
                options={detailAccounts}
                value={l.account_id}
                onValueChange={(id) => updateLine(setter, l.key, { account_id: id })}
                placeholder={placeholder}
                className="flex-1"
              />
              <Input
                value={l.amount}
                onChange={(e) => updateLine(setter, l.key, { amount: e.target.value })}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                aria-invalid={amountInvalid}
                className={cn(
                  "h-8 w-[100px] shrink-0 text-right tabular-nums text-xs",
                  amountInvalid && "border-red-300 focus-visible:ring-red-200",
                )}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setter((prev) => prev.filter((x) => x.key !== l.key))}
                aria-label="حذف هذا البند"
                className="h-8 w-8 shrink-0 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {amountInvalid && (
              <p className="px-1 text-2xs text-red-600">أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند.</p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setter((prev) => [...prev, newLine()])}
        className="h-8 w-full justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white text-xs font-bold text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/40"
      >
        <Plus className="h-3.5 w-3.5" />
        إضافة بند
      </Button>
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(rows.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), 2)}
          </span>
        </div>
      )}
    </div>
  );
}
