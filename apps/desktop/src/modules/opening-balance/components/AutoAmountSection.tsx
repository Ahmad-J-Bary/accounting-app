import { useState } from "react";
import { Check, Plus, X, Trash2, Pencil } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { toFixed } from "@shared/lib/format";
import { toNum, type WizLine } from "@modules/opening-balance/lib/wizard-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface AutoAmountSectionProps {
  title: string;
  hint?: string;
  rows: WizLine[];
  onPatch: (key: string, patch: Partial<WizLine>) => void;
  onDelete?: (key: string) => void;
  fixedAccountName: string;
  nativeHint?: "debit" | "credit";
}

/**
 * Amount-only section with a fixed account.
 * - 0/empty balance = treated as not added (add pill visible)
 * - Add clicked: pill disappears, edit form appears (autoFocus on amount)
 * - After save: positive balance shows saved value + edit button; 0/empty returns to add pill
 * - Exactly one of: add pill / edit form / saved row is visible at any time
 */
export function AutoAmountSection({ title, hint, rows, onPatch, onDelete, fixedAccountName, nativeHint }: AutoAmountSectionProps) {
  const { t } = useLocalization();
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const existingRow = rows[0];

  const handleAdd = () => {
    setLocalValue("");
    setEditing(true);
  };

  const startEdit = (row: WizLine) => {
    setLocalValue(row.amount);
    setEditing(true);
  };

  const save = (key: string) => {
    onPatch(key, { amount: localValue });
    setEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{title}</span>
        {existingRow && toNum(existingRow.amount) > 0 && (
          <span className="rounded-full bg-success/10 border border-success/20 px-2 py-0.5 text-xs font-bold text-success tabular-nums">
            {toFixed(toNum(existingRow.amount), 2)}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {(!existingRow || toNum(existingRow.amount) <= 0) && !editing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-8 shrink-0 rounded-full border-success/20 bg-success/10 px-3 text-xs font-bold text-success hover:bg-success/20 hover:border-success/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ms-1" />
          {t("autoAmount.addTitle", { namespace: "openingBalance", vars: { title } })}
        </Button>
      )}

      {editing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/60 px-2 py-1.5 flex items-center">
            <span className="text-xs font-bold text-foreground truncate">{fixedAccountName}</span>
          </div>
          <div className="w-32 shrink-0">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder={t("autoAmount.openingBalancePlaceholder", { namespace: "openingBalance" })}
              aria-label={t("autoAmount.openingBalanceAria", { namespace: "openingBalance" })}
              autoFocus
              className={"h-8 text-end tabular-nums text-xs " + (localValue.trim() !== "" && toNum(localValue) <= 0 ? "border-red-400" : "border-border")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && existingRow) {
                  e.preventDefault();
                  save(existingRow.key);
                }
              }}
            />
          </div>
          {nativeHint && (
            <span className="text-2xs text-muted-foreground shrink-0">{nativeHint === "debit" ? t("autoAmount.debit", { namespace: "openingBalance" }) : t("autoAmount.credit", { namespace: "openingBalance" })}</span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => existingRow && save(existingRow.key)}
            className="h-8 px-2 text-xs font-bold shrink-0 bg-success hover:bg-success/80 text-white"
          >
            <Check className="w-3.5 h-3.5 ms-1" />
            {t("autoAmount.save", { namespace: "openingBalance" })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-slate-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {existingRow && toNum(existingRow.amount) > 0 && !editing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/60 px-2 py-1.5 flex items-center">
            <span className="text-xs font-bold text-foreground truncate">{fixedAccountName}</span>
          </div>
          <div className="w-32 shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 flex items-center justify-end">
            <span className="tabular-nums text-xs font-bold text-foreground">{toFixed(toNum(existingRow.amount), 2)}</span>
          </div>
          {nativeHint && (
            <span className="text-2xs text-muted-foreground shrink-0">{nativeHint === "debit" ? t("autoAmount.debit", { namespace: "openingBalance" }) : t("autoAmount.credit", { namespace: "openingBalance" })}</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => startEdit(existingRow)}
            className="h-8 px-2 text-xs font-bold shrink-0 border-success/20 text-success hover:bg-success/10"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("autoAmount.edit", { namespace: "openingBalance" })}
          </Button>
          {onDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDelete(existingRow.key)}
              className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
              aria-label={t("autoAmount.deleteBalance", { namespace: "openingBalance" })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
