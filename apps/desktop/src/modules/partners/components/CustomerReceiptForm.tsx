import { useState } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { type CreatePaymentRequest, type CustomerDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from '@widgets/sidebar/FieldLabel';
import { SidebarSection } from '@widgets/sidebar/SidebarSection';
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

interface CustomerReceiptFormProps {
  customer: CustomerDto;
  onSave: (payload: CreatePaymentRequest) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export function CustomerReceiptForm({ customer, onSave, onClose, saving }: CustomerReceiptFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();

  const defaultCurrency = customer.currency || baseCurrency?.code || "";
  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: "Receipt",
    amount: 0,
    payment_date: new Date().toISOString(),
    currency_code: defaultCurrency,
    exchange_rate: getExchangeRate(defaultCurrency, rateMap, baseCurrency?.code),
    customer_id: customer.id,
    notes: `سند قبض من العميل: ${customer.name}`,
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
    if (!form.amount || !form.customer_id) return;

    await onSave({
      payment_type: "Receipt",
      amount: form.amount,
      currency_code: form.currency_code || baseCurrency?.code || "",
      exchange_rate: form.exchange_rate || 1,
      payment_date: form.payment_date || new Date().toISOString(),
      customer_id: form.customer_id,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || form.amount <= 0 || !form.customer_id;

  return (
    <FormPanel
      title="إضافة سند قبض"
      icon={<Receipt className="w-5 h-5 text-emerald-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="حفظ السند"
    >
      <div className="space-y-6 text-right">
        <SidebarSection title="تفاصيل السند">
          <div className="grid grid-cols-2 gap-4">
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
                <FieldLabel>من الحساب الدائن (العميل)</FieldLabel>
                <Input value={customer.name} disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>إلى الحساب المدين</FieldLabel>
                <Input value="الخزينة (الصندوق)" disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
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
