import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { toFixed } from "@shared/lib/format";
import { toNum, type WizLine } from "@modules/opening-balance/lib/wizard-types";

interface AutoAmountSectionProps {
  title: string;
  hint?: string;
  rows: WizLine[];
  onPatch: (key: string, patch: Partial<WizLine>) => void;
  fixedAccountName: string;
}

/**
 * Amount-only section with a fixed account: the accountant types an amount
 * and the account is auto-resolved (no manual override).
 * Default state: read-only value + "تعديل" button.
 * Editing state: editable input + "حفظ" button.
 */
export function AutoAmountSection({ title, hint, rows, onPatch, fixedAccountName }: AutoAmountSectionProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

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
      <p className="text-xs font-bold text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {rows.map((r) => {
        const invalid = editing && localValue.trim() !== "" && toNum(localValue) <= 0;
        return (
          <div key={r.key} className="flex items-stretch gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center">
              <span className="text-xs font-bold text-slate-700 truncate">{fixedAccountName}</span>
            </div>
            {editing ? (
              <>
                <div className="w-36 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    placeholder="المبلغ"
                    aria-label="المبلغ"
                    autoFocus
                    className={"h-9 text-right tabular-nums " + (invalid ? "border-red-400" : "border-slate-200")}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => save(r.key)}
                  className="h-9 px-3 text-xs font-bold shrink-0"
                  aria-label="حفظ المبلغ"
                >
                  <Check className="w-3.5 h-3.5 ml-1" />
                  حفظ
                </Button>
              </>
            ) : (
              <>
                <div className="w-36 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-end">
                  <span className="tabular-nums text-xs font-bold text-slate-700">
                    {r.amount && toNum(r.amount) > 0 ? toFixed(toNum(r.amount), 2) : "—"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(r)}
                  className="h-9 px-3 text-xs font-bold shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
                  aria-label="تعديل المبلغ"
                >
                  <Pencil className="w-3.5 h-3.5 ml-1" />
                  تعديل
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
