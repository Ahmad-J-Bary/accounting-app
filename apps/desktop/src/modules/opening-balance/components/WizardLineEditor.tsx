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
import { getLocalizedAccountName } from "@modules/opening-balance/lib/migration-labels";
import { AccountCombobox } from "./AccountCombobox";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t, language } = useLocalization();
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
        <p className="text-xs text-muted-foreground text-center py-2">{t("openingBalance.noItemsYet", { namespace: "accounting",  })}</p>
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
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
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
                  placeholder={t("openingBalance.openingBalanceLabel", { namespace: "accounting",  })}
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
                  <span className="text-2xs text-muted-foreground shrink-0">{nature === "debit" ? t("lineEditor.debit", { namespace: "openingBalance" }) : t("lineEditor.credit", { namespace: "openingBalance" })}</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveEdit(l.key, l.account_id, l.amount)}
                  disabled={amountInvalid || !l.account_id}
                  className="h-8 px-2 text-xs font-bold shrink-0 bg-success hover:bg-success/80 text-white"
                >
                  <Check className="w-3.5 h-3.5 ms-1" />
                  {t("lineEditor.save", { namespace: "openingBalance" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelEdit(l.key)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-muted-foreground shrink-0"
                  aria-label={newKeys.has(l.key) ? t("lineEditor.cancelAdd", { namespace: "openingBalance" }) : t("lineEditor.cancelEdit", { namespace: "openingBalance" })}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-2xs font-bold text-muted-foreground tabular-nums shrink-0">
                    {account?.code || "—"}
                  </span>
                  <span className="truncate text-foreground">
                    {account ? getLocalizedAccountName(account, language) : placeholder}
                  </span>
                </div>
                <div className="w-32 shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 flex items-center justify-end">
                  <span className="tabular-nums text-xs font-bold text-foreground">{l.amount || "0.00"}</span>
                </div>
                {nature && (
                  <span className="text-2xs text-muted-foreground shrink-0">{nature === "debit" ? t("lineEditor.debit", { namespace: "openingBalance" }) : t("lineEditor.credit", { namespace: "openingBalance" })}</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(l.key)}
                  className="h-8 px-2 text-xs font-bold shrink-0 border-success/20 text-success hover:bg-success/10"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t("lineEditor.edit", { namespace: "openingBalance" })}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteRow(l.key)}
                  className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                  aria-label={t("lineEditor.deleteLine", { namespace: "openingBalance" })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {amountInvalid && !isEditing && (
              <p className="px-1 text-2xs text-red-600">{t("lineEditor.invalidAmount", { namespace: "openingBalance" })}</p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="h-8 shrink-0 rounded-full border-success/20 bg-success/10 px-3 text-xs font-bold text-success hover:bg-success/20 hover:border-success/40 transition-all"
      >
        <Plus className="h-3.5 w-3.5 ms-1" />
        {t("lineEditor.addLine", { namespace: "openingBalance" })}
      </Button>
      {rows.some((l) => parseFloat(l.amount) > 0) && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs font-semibold text-muted-foreground">
          <span>{t("lineEditor.total", { namespace: "openingBalance" })}</span>
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
