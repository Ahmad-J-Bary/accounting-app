import { useState, useEffect } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import type { DerivedRow } from "@modules/opening-balance/lib/wizard-types";

interface InlineBalanceRowProps {
  row: DerivedRow;
  onSave: (row: DerivedRow, value: string) => Promise<boolean> | boolean;
  label: string;
  nativeHint?: "debit" | "credit";
  disabled?: boolean;
}

/**
 * A derived module row whose opening value can be tuned inline.
 * Default state: read-only value + "تعديل" button.
 * Editing state: editable input + "حفظ" button.
 */
export function InlineBalanceRow({ row, onSave, label, nativeHint = "debit", disabled = false }: InlineBalanceRowProps) {
  const [value, setValue] = useState(row.amount);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setValue(row.amount);
    if (!editing) setEditing(false);
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
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant="outline" className="text-2xs bg-blue-50 text-blue-700 border-blue-200 shrink-0">مشتق</Badge>
        <span className="text-2xs font-bold text-slate-400 tabular-nums shrink-0">{row.account_code || "—"}</span>
        <span className="truncate text-slate-700">{row.label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-2xs font-semibold text-slate-400">{label}</span>
        {editing ? (
          <>
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
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => void save()}
              disabled={disabled || saving}
              className="h-8 px-2 text-xs font-bold"
              aria-label="حفظ الرصيد"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              حفظ
            </Button>
          </>
        ) : (
          <>
            <span className="tabular-nums text-xs font-bold text-slate-700 w-32 text-right">{parseFloat(row.amount || "0").toFixed(2)}</span>
            <span className="text-2xs text-slate-400">{nativeHint === "debit" ? "مدين" : "دائن"}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={disabled}
              className="h-8 px-2 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
              aria-label="تعديل الرصيد"
            >
              <Pencil className="w-3.5 h-3.5" />
              تعديل
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
