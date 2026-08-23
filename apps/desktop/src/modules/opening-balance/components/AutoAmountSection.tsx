import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
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
 * Amount-only section with a fixed account.
 * - 0/empty balance = treated as not added (add pill visible)
 * - Add clicked: pill disappears, edit form appears (autoFocus on amount)
 * - After save: positive balance shows saved value + edit button; 0/empty returns to add pill
 * - Exactly one of: add pill / edit form / saved row is visible at any time
 */
export function AutoAmountSection({ title, hint, rows, onPatch, fixedAccountName }: AutoAmountSectionProps) {
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
      <p className="text-xs font-bold text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {(!existingRow || toNum(existingRow.amount) <= 0) && !editing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
        >
          <Plus className="w-3.5 h-3.5 ml-1" />
          إضافة {title}
        </Button>
      )}

      {editing && (
        <div className="flex items-stretch gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center">
            <span className="text-xs font-bold text-slate-700 truncate">{fixedAccountName}</span>
          </div>
          <div className="w-36 shrink-0">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="الرصيد الافتتاحي"
              aria-label="الرصيد الافتتاحي"
              autoFocus
              className={"h-9 text-right tabular-nums " + (localValue.trim() !== "" && toNum(localValue) <= 0 ? "border-red-400" : "border-slate-200")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && existingRow) {
                  e.preventDefault();
                  save(existingRow.key);
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => existingRow && save(existingRow.key)}
            className="h-9 px-3 text-xs font-bold shrink-0"
          >
            <Check className="w-3.5 h-3.5 ml-1" />
            حفظ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            className="h-9 w-9 p-0 text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {existingRow && toNum(existingRow.amount) > 0 && !editing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center">
            <span className="text-xs font-bold text-slate-700 truncate">{fixedAccountName}</span>
          </div>
          <div className="w-36 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-end">
            <span className="tabular-nums text-xs font-bold text-slate-700">{toFixed(toNum(existingRow.amount), 2)}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => startEdit(existingRow)}
            className="h-9 px-3 text-xs font-bold shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            تعديل
          </Button>
        </div>
      )}
    </div>
  );
}
