import { useState } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreatePaymentRequest } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { Receipt } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  const payLabelKeys = PAYMENT_LABEL_KEYS[config.paymentType];
  const defaultCurrency = config.entityCurrency || baseCurrency?.code || "";
  const idFieldName = config.getIdField(config);
  const payTitle = t(payLabelKeys.title, { namespace: "partners"});
  const payCreditLabel = t(payLabelKeys.creditLabel, { namespace: "partners"});
  const payDebitLabel = t(payLabelKeys.debitLabel, { namespace: "partners"});
  const treasury = t("payment.treasury", { namespace: "partners",  });
  const payNotesPrefix = t(payLabelKeys.notesPrefix, { namespace: "partners"});

  const [form, setForm] = useState<Partial<CreatePaymentRequest>>({
    payment_type: config.paymentType,
    amount: "0",
    payment_date: new Date().toISOString(),
    currency_code: defaultCurrency,
    exchange_rate: String(getExchangeRate(defaultCurrency, rateMap, baseCurrency?.code)),
    [idFieldName]: config.entityId,
    notes: `${payNotesPrefix}${config.entityName}`,
  });

  const handleCurrencyChange = (val: string) => {
    const rate = getExchangeRate(val, rateMap, baseCurrency?.code);
    setForm((p) => ({ ...p, currency_code: val, exchange_rate: String(rate) }));
  };

  const handleSave = async () => {
    if (!form.amount || !config.entityId) return;

    await onSave({
      payment_type: config.paymentType,
      amount: String(form.amount),
      currency_code: form.currency_code || baseCurrency?.code || "",
      exchange_rate: form.exchange_rate != null ? String(form.exchange_rate) : undefined,
      payment_date: form.payment_date || new Date().toISOString(),
      [idFieldName]: config.entityId,
      notes: form.notes || undefined,
    });
  };

  const isSaveDisabled = !form.amount || parseFloat(form.amount) <= 0 || !config.entityId;

  const payCreditValue = config.paymentType === "Receipt" ? config.entityName : treasury;
  const payDebitValue =
    config.paymentType === "Receipt"
      ? treasury
      : config.paymentType === "DrawingsVoucher"
        ? t("payment.debitValueDrawings", { namespace: "partners", vars: { name: config.entityName },  })
        : config.entityName;

  return (
    <FormPanel
      title={payTitle}
      icon={<Receipt className={`w-5 h-5 ${config.iconColor}`} />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel={t("payment.saveLabel", { namespace: "partners",  })}
    >
      <div className="space-y-6 text-right">
        <SidebarSection title={t("payment.detailsSection", { namespace: "partners",  })}>
          <div className="grid grid-cols-2 gap-4">
            {currencies.length > 1 && (
              <div className="space-y-1.5">
                <FieldLabel>{t("payment.currency", { namespace: "partners",  })}</FieldLabel>
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

            <div className={`space-y-1.5 ${currencies.length > 1 ? "" : "col-span-2"}`}>
              <FieldLabel required>{t("payment.amount", { namespace: "partners",  })}</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="h-9 font-bold tabular-nums bg-white"
              />
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg border border-muted">
              <div className="space-y-1.5">
                <FieldLabel>{payCreditLabel}</FieldLabel>
                <Input
                  value={payCreditValue}
                  disabled
                  className="h-9 bg-muted text-muted-foreground font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{payDebitLabel}</FieldLabel>
                <Input value={payDebitValue} disabled className="h-9 bg-muted text-muted-foreground font-bold" />
              </div>
            </div>

            <div className="space-y-1.5 col-span-2">
              <FieldLabel>{t("payment.date", { namespace: "partners",  })}</FieldLabel>
              <Input
                type="date"
                value={form.payment_date?.slice(0, 10) ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, payment_date: new Date(e.target.value).toISOString() }))}
                className="h-9 bg-white tabular-nums text-left"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <FieldLabel>{t("payment.notesLabel", { namespace: "partners",  })}</FieldLabel>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder={t("payment.notesPlaceholder", { namespace: "partners",  })}
                className="min-h-[60px] bg-white border-muted"
              />
            </div>
          </div>
        </SidebarSection>
      </div>
    </FormPanel>
  );
}

const PAYMENT_LABEL_KEYS = {
  Receipt: {
    title: "payment.titles.receipt",
    creditLabel: "payment.creditLabels.receipt",
    debitLabel: "payment.debitLabels.receipt",
    notesPrefix: "payment.notesPrefixes.receipt",
  },
  SupplierPayment: {
    title: "payment.titles.supplierPayment",
    creditLabel: "payment.creditLabels.supplierPayment",
    debitLabel: "payment.debitLabels.supplierPayment",
    notesPrefix: "payment.notesPrefixes.supplierPayment",
  },
  DrawingsVoucher: {
    title: "payment.titles.drawings",
    creditLabel: "payment.creditLabels.drawings",
    debitLabel: "payment.debitLabels.drawings",
    notesPrefix: "payment.notesPrefixes.drawings",
  },
} as const;

export const PAYMENT_CONFIGS = {
  customer: (customer: { id: string; name: string; currency?: string }): PaymentFormConfig => ({
    paymentType: "Receipt",
    entityId: customer.id,
    entityName: customer.name,
    entityCurrency: customer.currency,
    iconColor: "text-success",
    title: "",
    creditLabel: "",
    debitLabel: "",
    debitValue: "",
    notesPrefix: "",
    getIdField: () => "customer_id",
  }),

  supplier: (supplier: { id: string; name: string; currency?: string }): PaymentFormConfig => ({
    paymentType: "SupplierPayment",
    entityId: supplier.id,
    entityName: supplier.name,
    entityCurrency: supplier.currency,
    iconColor: "text-primary",
    title: "",
    creditLabel: "",
    debitLabel: "",
    debitValue: "",
    notesPrefix: "",
    getIdField: () => "supplier_id",
  }),

  partner: (partner: { id: string; name: string; currency?: string; drawings_account_id?: string }): PaymentFormConfig => ({
    paymentType: "DrawingsVoucher",
    entityId: partner.drawings_account_id ?? "",
    entityName: partner.name,
    entityCurrency: partner.currency,
    drawingsAccountId: partner.drawings_account_id,
    iconColor: "text-warning",
    title: "",
    creditLabel: "",
    debitLabel: "",
    debitValue: "",
    notesPrefix: "",
    getIdField: () => "debit_account_id",
  }),
} as const;
