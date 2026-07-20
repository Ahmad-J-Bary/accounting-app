import { useState } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { type CreatePaymentRequest, type AccountDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

interface ExpenseVoucherFormProps {
  expenseAccount: AccountDto;
  onSave: (payload: CreatePaymentRequest) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export function ExpenseVoucherForm({ expenseAccount, onSave, onClose, saving }: ExpenseVoucherFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();

  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: "ExpenseVoucher",
    amount: 0,
    payment_date: new Date().toISOString(),
    currency_code: baseCurrency?.code || "",
    exchange_rate: 1,
    debit_account_id: expenseAccount.id,
    notes: `سند صرف: ${expenseAccount.name_ar}`,
  });

  const handleCurrencyChange = (val: string) => {
    const rate = getExchangeRate(val, rateMap, baseCurrency?.code);
    setForm(p => ({
      ...p,
      currency_code: val,
      exchange_rate: rate
    }));
  };

  const handleSave = async () => {
    if (!form.amount || !form.debit_account_id) return;

    await onSave({
      payment_type: "ExpenseVoucher",
      amount: form.amount,
      currency_code: form.currency_code || baseCurrency?.code || "",
      exchange_rate: form.exchange_rate || 1,
      payment_date: form.payment_date || new Date().toISOString(),
      debit_account_id: form.debit_account_id,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || form.amount <= 0 || !form.debit_account_id;

  return (
    <FormPanel
      title="إضافة سند صرف مصروف"
      icon={<Receipt className="w-5 h-5 text-red-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="حفظ السند"
    >
      <div className="space-y-6 text-right">
        <SidebarSection title="تفاصيل السند">
          <div className="grid grid-cols-2 gap-4">
            {currencies.length > 1 && (
            <div className="space-y-1.5">
              <FieldLabel>العملة</FieldLabel>
              <Select value={form.currency_code} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="h-9 font-bold bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            <div className="space-y-1.5">
              <FieldLabel required>المبلغ</FieldLabel>
              <Input 
                type="number" 
                min="0" 
                step="0.01"
                value={form.amount || ""}
                onChange={e => setForm(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} 
                className="h-9 font-bold tabular-nums bg-white"
              />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
              <div className="space-y-1.5">
                <FieldLabel>من الحساب الدائن</FieldLabel>
                <Input value="الخزينة (الصندوق)" disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>إلى الحساب المدين (المصروف)</FieldLabel>
                <Input value={expenseAccount.name_ar} disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <FieldLabel>البيان / ملاحظات</FieldLabel>
              <Input 
                value={form.notes ?? ""} 
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} 
                placeholder="بيان السند (اختياري)"
                className="h-9 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>التاريخ</FieldLabel>
              <Input 
                type="date"
                value={form.payment_date?.slice(0, 10) ?? ""}
                onChange={e => setForm(p => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))} 
                className="h-9 bg-white tabular-nums text-left"
              />
            </div>
          </div>
        </SidebarSection>
      </div>
    </FormPanel>
  );
}
