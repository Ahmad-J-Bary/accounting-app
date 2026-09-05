import { useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toFixed } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import type { AccountDto } from "@erp/shared-types";
import type { WizLine } from "@modules/opening-balance/lib/wizard-types";
import { newLine } from "@modules/opening-balance/lib/wizard-types";
import { AccountCombobox } from "./AccountCombobox";

type WizLineSetter = Dispatch<SetStateAction<WizLine[]>>;

interface WizardLineEditorProps {
  rows: WizLine[];
  setter: WizLineSetter;
  updateLine: (setter: WizLineSetter, key: string, patch: Partial<WizLine>) => void;
  placeholder: string;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}

function getAccountNature(account: AccountDto | undefined): "debit" | "credit" | null {
  if (!account) return null;
  const type = account.account_type?.toLowerCase() || "";
  if (["assets", "expenses"].includes(type)) return "debit";
  if (["liabilities", "equity", "income"].includes(type)) return "credit";
  return null;
}

export function WizardLineEditor({
  rows,
  setter,
  updateLine,
  placeholder,
  accounts,
  detailAccounts,
}: WizardLineEditorProps) {
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  const startEdit = (key: string) => {
    setEditingKeys((prev) => new Set(prev).add(key));
  };

  const cancelEdit = (key: string) => {
    const wasNew = newKeys.has(key);
    setEditingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (wasNew) {
      deleteRow(key);
      setNewKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const saveEdit = (key: string, accountId: string, amount: string) => {
    updateLine(setter, key, { account_id: accountId, amount });
    setEditingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setNewKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const deleteRow = (key: string) => {
    setter((prev) => prev.filter((x) => x.key !== key));
    setNewKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleAdd = () => {
    const newRow = newLine();
    setter((prev) => [...prev, newRow]);
    setEditingKeys((prev) => new Set(prev).add(newRow.key));
    setNewKeys((prev) => new Set(prev).add(newRow.key));
  };

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  return (
    <div className="space-y-1.5">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">لا توجد بنود بعد</p>
      )}
      {rows.map((l) => {
        const isEditing = editingKeys.has(l.key);
        const account = l.account_id ? accountMap.get(l.account_id) : undefined;
        const nature = getAccountNature(account);
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);

        return (
          <div key={l.key} className="space-y-0.5">
            {isEditing ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
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
                  placeholder="الرصيد الافتتاحي"
                  type="number"
                  min="0"
                  step="0.01"
                  aria-invalid={amountInvalid}
                  className={cn(
                    "h-8 w-32 shrink-0 text-end tabular-nums text-xs",
                    amountInvalid && "border-red-300 focus-visible:ring-red-200",
                  )}
                />
                {nature && (
                  <span className="text-2xs text-slate-400 shrink-0">{nature === "debit" ? "مدين" : "دائن"}</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveEdit(l.key, l.account_id, l.amount)}
                  disabled={amountInvalid || !l.account_id}
                  className="h-8 px-2 text-xs font-bold shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 ms-1" />
                  حفظ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelEdit(l.key)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 shrink-0"
                  aria-label={newKeys.has(l.key) ? "إلغاء الإضافة" : "إلغاء التعديل"}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-2xs font-bold text-slate-400 tabular-nums shrink-0">
                    {account?.code || "—"}
                  </span>
                  <span className="truncate text-slate-700">{account?.name_ar || placeholder}</span>
                </div>
                <div className="w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex items-center justify-end">
                  <span className="tabular-nums text-xs font-bold text-slate-700">{l.amount || "0.00"}</span>
                </div>
                {nature && (
                  <span className="text-2xs text-slate-400 shrink-0">{nature === "debit" ? "مدين" : "دائن"}</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(l.key)}
                  className="h-8 px-2 text-xs font-bold shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  تعديل
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteRow(l.key)}
                  className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                  aria-label="حذف هذا البند"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {amountInvalid && !isEditing && (
              <p className="px-1 text-2xs text-red-600">أدخل مبلغاً صحيحاً أكبر من صفر لهذا البند.</p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
      >
        <Plus className="h-3.5 w-3.5 ms-1" />
        إضافة بند
      </Button>
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs font-semibold text-slate-600">
          <span>الإجمالي</span>
          <span className="tabular-nums font-bold">
            {toFixed(
              rows.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0),
              2,
            )}
          </span>
        </div>
      )}
    </div>
  );
}