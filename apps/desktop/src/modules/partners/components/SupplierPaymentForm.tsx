import { useState } from "react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { type CreatePaymentRequest, type SupplierDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface SupplierPaymentFormProps {
  supplier: SupplierDto;
  onSave: (payload: CreatePaymentRequest) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export function SupplierPaymentForm({ supplier, onSave, onClose, saving }: SupplierPaymentFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();

  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: "SupplierPayment",
    amount: 0,
    payment_date: new Date().toISOString(),
    currency_code: baseCurrency?.code || "SYP",
    exchange_rate: 1,
    supplier_id: supplier.id,
    notes: `سند دفع للمورد: ${supplier.name}`,
  });

  const handleCurrencyChange = (val: string) => {
    const isUSD = val === "USD" || val === baseCurrency?.code;
    const rate = isUSD ? 1 : (rateMap.get(val) || 1);
    setForm(p => ({
      ...p,
      currency_code: val,
      exchange_rate: rate
    }));
  };

  const handleSave = async () => {
    if (!form.amount || !form.supplier_id) return;

    await onSave({
      payment_type: "SupplierPayment",
      amount: form.amount,
      currency_code: form.currency_code || "SYP",
      exchange_rate: form.exchange_rate || 1,
      payment_date: form.payment_date || new Date().toISOString(),
      supplier_id: form.supplier_id,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || form.amount <= 0 || !form.supplier_id;

  return (
    <FormPanel
      title="إضافة سند دفع"
      icon={<Receipt className="w-5 h-5 text-blue-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="حفظ السند"
    >
      <div className="space-y-6 text-right">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 border-b pb-2">تفاصيل السند</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">العملة</Label>
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
              <Label className="text-xs font-bold text-slate-600">المبلغ <span className="text-red-500">*</span></Label>
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
                <Label className="text-xs font-bold text-slate-600">من الحساب الدائن</Label>
                <Input value="الخزينة (الصندوق)" disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">إلى الحساب المدين (المورد)</Label>
                <Input value={supplier.name} disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-bold text-slate-600">البيان / ملاحظات</Label>
              <Input 
                value={form.notes ?? ""} 
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} 
                placeholder="بيان السند (اختياري)"
                className="h-9 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">التاريخ</Label>
              <Input 
                type="date"
                value={form.payment_date?.slice(0, 10) ?? ""}
                onChange={e => setForm(p => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))} 
                className="h-9 bg-white tabular-nums text-left"
              />
            </div>
          </div>
        </div>
      </div>
    </FormPanel>
  );
}
