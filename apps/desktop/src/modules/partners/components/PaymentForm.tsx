import { useState } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreatePaymentRequest } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

export interface PaymentFormConfig {
  paymentType: "Receipt" | "SupplierPayment" | "DrawingsVoucher";
  entityId: string;
  entityName: string;
  entityCurrency?: string;
  drawingsAccountId?: string;
  iconColor: string;
  title: string;
  creditLabel: string;
  debitLabel: string;
  debitValue: string;
  notesPrefix: string;
  getIdField: (config: PaymentFormConfig) => string;
}

interface PaymentFormProps {
  config: PaymentFormConfig;
  onSave: (payload: CreatePaymentRequest) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

export function PaymentForm({ config, onSave, onClose, saving }: PaymentFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const defaultCurrency = config.entityCurrency || baseCurrency?.code || "";
  const idFieldName = config.getIdField(config);

  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: config.paymentType,
    amount: 0,
    payment_date: new Date().toISOString(),
    currency_code: defaultCurrency,
    exchange_rate: getExchangeRate(defaultCurrency, rateMap, baseCurrency?.code),
    [idFieldName]: config.entityId,
    notes: `${config.notesPrefix}${config.entityName}`,
  });

  const handleCurrencyChange = (val: string) => {
    const rate = getExchangeRate(val, rateMap, baseCurrency?.code);
    setForm((p) => ({ ...p, currency_code: val, exchange_rate: rate }));
  };

  const handleSave = async () => {
    if (!form.amount || !config.entityId) return;

    await onSave({
      payment_type: config.paymentType,
      amount: form.amount,
      currency_code: form.currency_code || baseCurrency?.code || "",
      exchange_rate: form.exchange_rate || 1,
      payment_date: form.payment_date || new Date().toISOString(),
      [idFieldName]: config.entityId,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || form.amount <= 0 || !config.entityId;

  return (
    <FormPanel
      title={config.title}
      icon={<Receipt className={`w-5 h-5 ${config.iconColor}`} />}
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
                <SelectTrigger className="h-9 font-bold bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name_ar}
                    </SelectItem>
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
                onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                className="h-9 font-bold tabular-nums bg-white"
              />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
              <div className="space-y-1.5">
                <FieldLabel>{config.creditLabel}</FieldLabel>
                <Input
                  value={config.paymentType === "Receipt" ? config.entityName : "الخزينة (الصندوق)"}
                  disabled
                  className="h-9 bg-slate-50 text-slate-500 font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{config.debitLabel}</FieldLabel>
                <Input value={config.debitValue} disabled className="h-9 bg-slate-50 text-slate-500 font-bold" />
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <FieldLabel>البيان / ملاحظات</FieldLabel>
              <Input
                value={form.notes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="بيان السند (اختياري)"
                className="h-9 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>التاريخ</FieldLabel>
              <Input
                type="date"
                value={form.payment_date?.slice(0, 10) ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))}
                className="h-9 bg-white tabular-nums text-left"
              />
            </div>
          </div>
        </SidebarSection>
      </div>
    </FormPanel>
  );
}

export const PAYMENT_CONFIGS = {
  customer: (customer: { id: string; name: string; currency?: string }): PaymentFormConfig => ({
    paymentType: "Receipt",
    entityId: customer.id,
    entityName: customer.name,
    entityCurrency: customer.currency,
    iconColor: "text-emerald-600",
    title: "إضافة سند قبض",
    creditLabel: "من الحساب الدائن (العميل)",
    debitLabel: "إلى الحساب المدين",
    debitValue: "الخزينة (الصندوق)",
    notesPrefix: "سند قبض من العميل: ",
    getIdField: () => "customer_id",
  }),

  supplier: (supplier: { id: string; name: string; currency?: string }): PaymentFormConfig => ({
    paymentType: "SupplierPayment",
    entityId: supplier.id,
    entityName: supplier.name,
    entityCurrency: supplier.currency,
    iconColor: "text-blue-600",
    title: "إضافة سند دفع",
    creditLabel: "من الحساب الدائن",
    debitLabel: "إلى الحساب المدين (المورد)",
    debitValue: supplier.name,
    notesPrefix: "سند دفع للمورد: ",
    getIdField: () => "supplier_id",
  }),

  partner: (partner: { id: string; name: string; currency?: string; drawings_account_id?: string }): PaymentFormConfig => ({
    paymentType: "DrawingsVoucher",
    entityId: partner.drawings_account_id ?? "",
    entityName: partner.name,
    entityCurrency: partner.currency,
    drawingsAccountId: partner.drawings_account_id,
    iconColor: "text-amber-600",
    title: "إضافة سند مسحوبات شريك",
    creditLabel: "من الحساب الدائن",
    debitLabel: "إلى الحساب المدين (مسحوبات)",
    debitValue: `مسحوبات ${partner.name}`,
    notesPrefix: "مسحوبات شريك: ",
    getIdField: () => "debit_account_id",
  }),
} as const;
