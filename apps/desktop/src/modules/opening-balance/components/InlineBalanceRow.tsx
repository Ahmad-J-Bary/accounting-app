import { useState, useEffect } from "react";
import { Check, Loader2, Pencil, X, Trash2 } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import type { DerivedRow } from "@modules/opening-balance/lib/wizard-types";

interface InlineBalanceRowProps {
  row: DerivedRow;
  onSave: (row: DerivedRow, value: string) => Promise<boolean> | boolean;
  onDelete?: (row: DerivedRow) => void;
  label: string;
  nativeHint?: "debit" | "credit";
  disabled?: boolean;
}

/**
 * A derived module row whose opening value can be tuned inline.
 * Default state: read-only value + "تعديل" button.
 * Editing state: editable input + "حفظ" button.
 */
export function InlineBalanceRow({ row, onSave, onDelete, label, nativeHint = "debit", disabled = false }: InlineBalanceRowProps) {
  const [value, setValue] = useState(row.amount);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setValue(row.amount);
    setEditing(false);
  }, [row.amount]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(row, value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    setValue(row.amount);
    setEditing(true);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
      {editing ? (
        <>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-2xs font-semibold text-slate-400">{label}</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              aria-label={label}
              className="h-8 w-32 border-slate-200 text-right tabular-nums text-xs"
              autoFocus
            />
            <span className="text-2xs text-slate-400">{nativeHint === "debit" ? "مدين" : "دائن"}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => void save()}
              disabled={disabled || saving}
              className="h-8 px-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              aria-label="حفظ الرصيد"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              حفظ
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setEditing(false); setValue(row.amount); }}
              disabled={disabled}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 shrink-0"
              aria-label="إلغاء التعديل"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xs font-bold text-slate-400 tabular-nums shrink-0">{row.account_code || "—"}</span>
            {row.category && (
              <Badge variant="outline" className="text-2xs shrink-0 border-slate-200 text-slate-500">{row.category}</Badge>
            )}
            <span className="truncate text-slate-700">{row.label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="tabular-nums text-xs font-bold text-slate-700 w-32 text-right">{parseFloat(row.amount || "0").toFixed(2)}</span>
            <span className="text-2xs text-slate-400">{nativeHint === "debit" ? "مدين" : "دائن"}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={disabled}
              className="h-8 px-2 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              aria-label="تعديل الرصيد"
            >
              <Pencil className="w-3.5 h-3.5" />
              تعديل
            </Button>
            {onDelete && !disabled && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onDelete(row)}
                className="h-8 w-8 p-0 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                aria-label="حذف التجاوز"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
