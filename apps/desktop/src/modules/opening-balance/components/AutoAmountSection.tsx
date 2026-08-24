import { useState } from "react";
import { Check, Plus, X, Trash2, Pencil } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { toFixed } from "@shared/lib/format";
import { toNum, type WizLine } from "@modules/opening-balance/lib/wizard-types";

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
        <span className="text-xs font-bold text-slate-700">{title}</span>
        {existingRow && toNum(existingRow.amount) > 0 && (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums">
            {toFixed(toNum(existingRow.amount), 2)}
          </span>
        )}
      </div>
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
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 flex items-center">
            <span className="text-xs font-bold text-slate-700 truncate">{fixedAccountName}</span>
          </div>
          <div className="w-32 shrink-0">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              placeholder="الرصيد الافتتاحي"
              aria-label="الرصيد الافتتاحي"
              autoFocus
              className={"h-8 text-right tabular-nums text-xs " + (localValue.trim() !== "" && toNum(localValue) <= 0 ? "border-red-400" : "border-slate-200")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && existingRow) {
                  e.preventDefault();
                  save(existingRow.key);
                }
              }}
            />
          </div>
          {nativeHint && (
            <span className="text-2xs text-slate-400 shrink-0">{nativeHint === "debit" ? "مدين" : "دائن"}</span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => existingRow && save(existingRow.key)}
            className="h-8 px-2 text-xs font-bold shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="w-3.5 h-3.5 ml-1" />
            حفظ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {existingRow && toNum(existingRow.amount) > 0 && !editing && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 flex items-center">
            <span className="text-xs font-bold text-slate-700 truncate">{fixedAccountName}</span>
          </div>
          <div className="w-32 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 flex items-center justify-end">
            <span className="tabular-nums text-xs font-bold text-slate-700">{toFixed(toNum(existingRow.amount), 2)}</span>
          </div>
          {nativeHint && (
            <span className="text-2xs text-slate-400 shrink-0">{nativeHint === "debit" ? "مدين" : "دائن"}</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => startEdit(existingRow)}
            className="h-8 px-2 text-xs font-bold shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Pencil className="w-3.5 h-3.5" />
            تعديل
          </Button>
          {onDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDelete(existingRow.key)}
              className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
              aria-label="حذف الرصيد"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
