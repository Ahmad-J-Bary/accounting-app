import { useState, useEffect, useMemo } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { AccountDto } from "@erp/shared-types";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { cn } from "@shared/lib/utils";
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useCompanyCapabilities } from "@shared/hooks";

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
  expenseItems: AccountDto[];
  parentCode?: string;
  onSave: (payload: ExpenseFormPayload) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

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
  const { canUseOpeningWorkflow } = useCompanyCapabilities();

  const title = expense ? "تعديل بند المصروف" : "إضافة بند مصروف جديد";

  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [balanceDirection, setBalanceDirection] = useState<"debit" | "credit">("debit");
  const [currency, setCurrency] = useState(baseCurrency?.code || "");
  const [notes, setNotes] = useState("");

  const suggestedSuffix = useMemo(
    () => suggestNextSuffix(expenseItems, parentCode || ""),
    [expenseItems, parentCode]
  );

  const computedDebit = balanceDirection === "debit" ? openingBalance : "0";
  const computedCredit = balanceDirection === "credit" ? openingBalance : "0";

  useEffect(() => {
    if (expense) {
      setName(expense.name_ar || "");
      setOpeningBalance(expense.opening_balance || "0");
      const pDebit = parseFloat(expense.debit || "0");
      setBalanceDirection(pDebit > 0 ? "debit" : "credit");
      setCurrency(baseCurrency?.code || "");
      setNotes(expense.notes || "");
    } else {
      setName("");
      setOpeningBalance("0");
      setBalanceDirection("debit");
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
      debit: computedDebit,
      credit: computedCredit,
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
        <SidebarSection title="المعلومات الأساسية">
          <div className="grid grid-cols-2 gap-3">
            {currencies.length > 1 && (
            <div className="space-y-1.5">
              <FieldLabel>العملة الافتراضية</FieldLabel>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>اسم البند</FieldLabel>
            <Input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: مصاريف الإيجار"
              className="h-9"
            />
          </div>
        </SidebarSection>

        {canUseOpeningWorkflow && (
          <SidebarSection title="البيانات المالية">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <FieldLabel>الرصيد الافتتاحي</FieldLabel>
                <Input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  className="h-9 tabular-nums"
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <FieldLabel>اتجاه الرصيد</FieldLabel>
                <div className="flex gap-2 h-9">
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-md text-sm font-bold transition-colors border",
                      balanceDirection === "debit"
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                    )}
                    onClick={() => setBalanceDirection("debit")}
                  >
                    مدين
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex-1 rounded-md text-sm font-bold transition-colors border",
                      balanceDirection === "credit"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                    )}
                    onClick={() => setBalanceDirection("credit")}
                  >
                    دائن
                  </button>
                </div>
              </div>
            </div>
          </SidebarSection>
        )}

        <div className="space-y-1.5">
          <FieldLabel>ملاحظات</FieldLabel>
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
