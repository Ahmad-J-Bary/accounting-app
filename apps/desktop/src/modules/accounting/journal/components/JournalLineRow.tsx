import { useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { cn } from "@shared/lib/utils";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";
import type { JournalLineDraft } from "../lib/journal-entry-utils";

interface JournalLineRowProps {
  line: JournalLineDraft;
  accounts: readonly AccountDto[];
  detailAccounts: AccountDto[];
  onUpdate: (key: string, patch: Partial<JournalLineDraft>) => void;
  onRemove: (key: string) => void;
  isOnlyLine: boolean;
  lineIndex: number;
  autoFocus?: boolean;
}

export function JournalLineRow({
  line,
  accounts,
  detailAccounts,
  onUpdate,
  onRemove,
  isOnlyLine,
  lineIndex,
  autoFocus,
}: JournalLineRowProps) {
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      amountRef.current?.focus();
    }
  }, [autoFocus]);

  const amountNum = parseFloat(line.amount);
  const amountInvalid = line.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
        <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0 w-7 text-center">
          #{lineIndex}
        </span>

        <AccountCombobox
          accounts={accounts}
          options={detailAccounts}
          value={line.account_id}
          onValueChange={(id) => onUpdate(line.key, { account_id: id })}
          placeholder="اختر الحساب..."
          className="flex-1 min-w-0"
        />

        <div className="flex items-center shrink-0 border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdate(line.key, { side: "debit" })}
            className={cn(
              "px-2.5 py-1.5 text-xs font-bold transition-colors",
              line.side === "debit"
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            مدين
          </button>
          <button
            type="button"
            onClick={() => onUpdate(line.key, { side: "credit" })}
            className={cn(
              "px-2.5 py-1.5 text-xs font-bold transition-colors",
              line.side === "credit"
                ? "bg-emerald-600 text-white"
                : "text-slate-500 hover:bg-slate-100",
            )}
          >
            دائن
          </button>
        </div>

        <Input
          ref={amountRef}
          value={line.amount}
          onChange={(e) => onUpdate(line.key, { amount: e.target.value })}
          placeholder="0.00"
          type="number"
          min="0"
          step="0.01"
          aria-invalid={amountInvalid}
          className={cn(
            "h-9 w-28 shrink-0 text-end tabular-nums text-sm font-bold",
            amountInvalid && "border-red-300 focus-visible:ring-red-200",
          )}
        />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onRemove(line.key)}
          disabled={isOnlyLine}
          className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
          aria-label="حذف السطر"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <input
        value={line.description}
        onChange={(e) => onUpdate(line.key, { description: e.target.value })}
        placeholder="بيان السطر (اختياري)"
        className="w-full h-7 px-9 text-xs text-slate-600 placeholder:text-slate-400 border-0 bg-transparent focus:outline-none focus:ring-0"
      />

      {amountInvalid && (
        <p className="px-9 text-2xs text-red-600">أدخل مبلغاً صحيحاً أكبر من صفر</p>
      )}
    </div>
  );
}
