import { useState, useEffect, useMemo } from "react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AccountDto } from "@erp/shared-types";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export interface ExpenseFormPayload {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  opening_balance: string;
  debit: string;
  credit: string;
  currency: string;
  notes: string | null;
}

interface ExpenseFormPanelProps {
  expense: AccountDto | null;
  expenseItems: AccountDto[];       // All current expense items — used to auto-suggest next code
  parentCode?: string;              // e.g. "5" — parent account code prefix
  onSave: (payload: ExpenseFormPayload) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

/** Get the next numeric code for expense items (just 1, 2, 3...) */
function suggestNextSuffix(items: AccountDto[], parentCode: string): string {
  const numeric = items
    .map(a => {
      const code = a.code || "0";
      const suffix = parentCode && code.startsWith(parentCode) ? code.substring(parentCode.length) : code;
      return parseInt(suffix, 10);
    })
    .filter(n => !isNaN(n) && n > 0);
  const next = numeric.length > 0 ? Math.max(...numeric) + 1 : 1;
  return `${next}`;
}

export function ExpenseFormPanel({
  expense,
  expenseItems,
  parentCode,
  onSave,
  onClose,
  saving,
}: ExpenseFormPanelProps) {
  const { currencies, baseCurrency } = useCurrencyContext();

  const title = expense ? "تعديل بند المصروف" : "إضافة بند مصروف جديد";

  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [debit, setDebit] = useState("0");
  const [credit, setCredit] = useState("0");
  const [currency, setCurrency] = useState(baseCurrency?.code || "");
  const [notes, setNotes] = useState("");

  const suggestedSuffix = useMemo(
    () => suggestNextSuffix(expenseItems, parentCode || ""),
    [expenseItems, parentCode]
  );

  useEffect(() => {
    if (expense) {
      setName(expense.name_ar || "");
      setOpeningBalance(expense.opening_balance || "0");
      setDebit(expense.debit || "0");
      setCredit(expense.credit || "0");
      setCurrency(baseCurrency?.code || "");
      setNotes(expense.notes || "");
    } else {
      setName("");
      setOpeningBalance("0");
      setDebit("0");
      setCredit("0");
      setCurrency(baseCurrency?.code || "");
      setNotes("");
    }
  }, [expense, baseCurrency]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const suffix = expense?.code && parentCode && expense.code.startsWith(parentCode)
      ? expense.code.substring(parentCode.length) 
      : expense?.code || suggestedSuffix;
    const fullCode = parentCode ? `${parentCode}${suffix}` : suffix;

    const payload: ExpenseFormPayload = {
      code: fullCode,
      name_ar: name.trim(),
      name_en: name.trim(),
      opening_balance: openingBalance,
      debit,
      credit,
      currency,
      notes: notes.trim() || null,
    };

    if (expense) {
      onSave({ ...payload, id: expense.id });
    } else {
      onSave(payload);
    }
  };

  return (
    <FormPanel
      title={title}
      icon={<Receipt className="w-5 h-5" />}
      onClose={onClose}
      onSave={handleSubmit}
      isSaving={saving}
      saveDisabled={!name.trim()}
    >
      <div className="space-y-6 text-right">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">المعلومات الأساسية</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">العملة الافتراضية</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">اسم البند *</Label>
            <Input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: مصاريف الإيجار"
              className="h-9"
            />
          </div>
        </div>

        {/* Financial Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">البيانات المالية</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-bold text-slate-600">الرصيد الافتتاحي</Label>
              <Input
                type="number"
                step="any"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                className="h-9 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">مدين (حالي)</Label>
              <Input
                type="number"
                step="any"
                value={debit}
                onChange={e => setDebit(e.target.value)}
                className="h-9 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">دائن (حالي)</Label>
              <Input
                type="number"
                step="any"
                value={credit}
                onChange={e => setCredit(e.target.value)}
                className="h-9 tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-600">ملاحظات</Label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="أية ملاحظات إضافية..."
            className="h-9"
          />
        </div>
      </div>
    </FormPanel>
  );
}
