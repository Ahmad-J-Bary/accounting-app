import { useState, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SYSTEM_ACCOUNT_IDS, type CreatePaymentRequest, type CustomerDto, type SupplierDto, type PaymentType, type AccountDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from '@widgets/sidebar-shell/FieldLabel';
import { SidebarSection } from '@widgets/sidebar-shell/SidebarSection';
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { PAYMENT_TYPE_LABELS, HIDDEN_PAYMENT_TYPES } from "../lib/constants";

export type PaymentFormPayload = CreatePaymentRequest & { id?: string };

interface PaymentFormProps {
  customers: CustomerDto[];
  suppliers: SupplierDto[];
  accounts: AccountDto[];
  onSave: (payload: PaymentFormPayload) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  initialValues?: Partial<PaymentFormPayload>;
}

export function PaymentForm({ customers, suppliers, accounts, onSave, onClose, saving, initialValues }: PaymentFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();

  const [form, setForm] = useState<Partial<PaymentFormPayload>>({
    payment_type: "Receipt",
    amount: 0,
    payment_date: new Date().toISOString(),
    currency_code: baseCurrency?.code || "",
    exchange_rate: 1,
    ...initialValues
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
    await onSave({
      id: form.id,
      payment_type: form.payment_type as PaymentType,
      amount: form.amount || 0,
      voucher_number: form.voucher_number || undefined,
      currency_code: form.currency_code || baseCurrency?.code || "",
      exchange_rate: form.exchange_rate || 1,
      payment_date: form.payment_date || new Date().toISOString(),
      debit_account_id: form.debit_account_id || undefined,
      credit_account_id: form.credit_account_id || undefined,
      customer_id: form.customer_id || undefined,
      supplier_id: form.supplier_id || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || form.amount <= 0 || (
    form.payment_type === "Receipt" && !form.customer_id
  ) || (
    form.payment_type === "SupplierPayment" && !form.supplier_id
  ) || (
    (form.payment_type === "ExpenseVoucher" || form.payment_type === "DrawingsVoucher") && !form.debit_account_id
  );

  // Helper to get all descendant IDs of given parent IDs
  const getDescendantIds = (parentIds: string[], allAccounts: AccountDto[]): string[] => {
    const currentIds = [...parentIds];
    const result = new Set<string>(currentIds);
    let added = true;
    while (added) {
      added = false;
      for (const acc of allAccounts) {
        if (acc.parent_id && result.has(acc.parent_id) && !result.has(acc.id)) {
          result.add(acc.id);
          added = true;
        }
      }
    }
    return Array.from(result);
  };

  // Filter accounts based on type
  const expenseAccounts = useMemo(() => {
    const parentIds: string[] = [SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES];
    const descendantIds = getDescendantIds(parentIds, accounts);
    return accounts.filter(a => descendantIds.includes(a.id) && !parentIds.includes(a.id) && a.is_active); 
  }, [accounts]);

  const drawingAccounts = useMemo(() => {
    const parentIds: string[] = [SYSTEM_ACCOUNT_IDS.DRAWINGS];
    const descendantIds = getDescendantIds(parentIds, accounts);
    return accounts.filter(a => descendantIds.includes(a.id) && !parentIds.includes(a.id) && a.is_active);
  }, [accounts]);

  const renderFromAccount = () => {
    if (form.payment_type === "Receipt") {
      return (
        <div className="space-y-1.5">
          <FieldLabel required>من الحساب الدائن (العميل)</FieldLabel>
          <Select value={form.customer_id} onValueChange={val => setForm(p => ({ ...p, customer_id: val }))}>
            <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <FieldLabel>من الحساب الدائن</FieldLabel>
        <Input value="الخزينة (الصندوق)" disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
      </div>
    );
  };

  const renderToAccount = () => {
    if (form.payment_type === "SupplierPayment") {
      return (
        <div className="space-y-1.5">
          <FieldLabel required>إلى الحساب المدين (المورد)</FieldLabel>
          <Select value={form.supplier_id} onValueChange={val => setForm(p => ({ ...p, supplier_id: val }))}>
            <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (form.payment_type === "ExpenseVoucher") {
      return (
        <div className="space-y-1.5">
          <FieldLabel required>إلى الحساب المدين (المصروف)</FieldLabel>
          <Select value={form.debit_account_id} onValueChange={val => setForm(p => ({ ...p, debit_account_id: val }))}>
            <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="اختر حساب المصروف" /></SelectTrigger>
            <SelectContent>
              {expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (form.payment_type === "DrawingsVoucher") {
      return (
        <div className="space-y-1.5">
          <FieldLabel required>إلى الحساب المدين (مسحوبات)</FieldLabel>
          <Select value={form.debit_account_id} onValueChange={val => setForm(p => ({ ...p, debit_account_id: val }))}>
            <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="اختر حساب المسحوبات" /></SelectTrigger>
            <SelectContent>
              {drawingAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (form.payment_type === "Receipt") {
      return (
        <div className="space-y-1.5">
          <FieldLabel>إلى الحساب المدين</FieldLabel>
          <Input value="الخزينة (الصندوق)" disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
        </div>
      );
    }
    return null;
  };

  return (
    <FormPanel
      title="إضافة سند نقدي"
      icon={<Receipt className="w-5 h-5 text-blue-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="حفظ السند"
    >
      <div className="space-y-6 text-right">
        <SidebarSection title="تفاصيل السند">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <FieldLabel>نوع السند</FieldLabel>
              <Select 
                value={form.payment_type} 
                onValueChange={v => setForm(p => ({ 
                  ...p, 
                  payment_type: v as CreatePaymentRequest['payment_type'], 
                  customer_id: undefined, 
                  supplier_id: undefined, 
                  debit_account_id: undefined, 
                  credit_account_id: undefined 
                }))}
              >
                <SelectTrigger className="h-9 font-bold bg-white border-blue-200 focus:ring-blue-500"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_TYPE_LABELS).filter(([k]) => !HIDDEN_PAYMENT_TYPES.includes(k)).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>العملة الافتراضية</FieldLabel>
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
              {renderFromAccount()}
              {renderToAccount()}
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
