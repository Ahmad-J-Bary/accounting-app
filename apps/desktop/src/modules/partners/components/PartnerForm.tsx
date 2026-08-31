import { useState, useEffect } from "react";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Label } from "@shared/ui/label";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { TrendingUp } from "lucide-react";
import type { PartnerDto, PartnerRequest } from '@modules/partners/api/partnerService';
import { useCurrencyField } from "@shared/hooks/useCurrencyField";
import { CurrencyField } from "@shared/ui/CurrencyField";

interface PartnerFormProps {
  open: boolean;
  onClose: () => void;
  partner: PartnerDto | null;
  onSave: (payload: PartnerRequest) => Promise<void>;
  saving?: boolean;
  accountInfo?: { code: string; parentName: string };
}

export function PartnerForm({ open, onClose, partner, onSave, saving, accountInfo }: PartnerFormProps) {
  const currencyField = useCurrencyField({
    initialCurrency: partner?.currency || undefined,
    initialFxRate: partner?.exchange_rate || undefined,
    disableAutoFx: !!partner,
  });

  const [formData, setFormData] = useState({
    name: "",
    manualRatio: "",
    notes: "",
  });

  useEffect(() => {
    if (partner) {
      currencyField.setCurrency(partner.currency || currencyField.baseCurrencyCode);
      currencyField.setAmount(partner.is_amount_in_original ? (partner.amount_original || "0") : (partner.amount_local || "0"));
      currencyField.setFxRate(partner.exchange_rate || "1");
      setFormData({
        name: partner.name,
        manualRatio: partner.profit_sharing_ratio || "",
        notes: partner.notes || "",
      });
    } else {
      currencyField.setCurrency(currencyField.getDefaultCurrency());
      currencyField.setAmount("0");
      currencyField.setFxRate("1");
      setFormData({
        name: "",
        manualRatio: "",
        notes: "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner, open]);

  const handleSubmit = () => {
    if (!formData.name || !currencyField.amount) return;

    const exchangeRate = partner
      ? partner.exchange_rate
      : currencyField.fxRate;

    const sharingType = formData.manualRatio ? "Manual" : "BasedOnCapitalLocal";

    onSave({
      id: partner?.id,
      code: "",
      name: formData.name,
      currency: currencyField.currency,
      exchangeRate,
      amount: currencyField.amount,
      isAmountInOriginal: currencyField.currency !== currencyField.baseCurrencyCode,
      sharingType,
      manualRatio: formData.manualRatio || null,
      notes: formData.notes || null,
    });
  };

  if (!open) return null;

  return (
    <FormPanel
      title={partner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
      onClose={onClose}
      onSave={() => handleSubmit()}
      isSaving={saving}
      saveDisabled={!formData.name || !currencyField.amount}
      saveLabel={partner ? "تحديث البيانات" : "حفظ الشريك"}
    >
      <div className="space-y-4 text-right">
            {accountInfo && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>رقم الحساب</FieldLabel>
                  <Input value={accountInfo.code} readOnly className="h-9 bg-slate-50 border-slate-200 cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>فرعي من</FieldLabel>
                  <Input value={accountInfo.parentName} readOnly className="h-9 bg-slate-50 border-slate-200 cursor-not-allowed" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>اسم الشريك</Label>
              <Input 
                required
                placeholder="مثال: أحمد محمد" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="text-right"
              />
            </div>

            <div className="space-y-3 border p-4 rounded-lg bg-slate-50/50">
              <CurrencyField
                label="المبلغ المشارك به"
                currency={currencyField.currency}
                onCurrencyChange={currencyField.setCurrency}
                amount={currencyField.amount}
                onAmountChange={currencyField.setAmount}
                symbol={currencyField.symbol}
                showCurrency={currencyField.hasMultipleCurrencies}
                currencies={currencyField.currencies}
                placeholder="0"
              />
            </div>

            <div className="space-y-2 pt-2">
              <Label className="block text-right font-medium">نسبة الأرباح المخصصة (%) - اختياري</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  step="any"
                  placeholder="توزيع تلقائي" 
                  value={formData.manualRatio} 
                  onChange={e => setFormData({...formData, manualRatio: e.target.value})} 
                  className="text-left pl-8"
                />
                <TrendingUp className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground opacity-50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>ملاحظات</FieldLabel>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="ملاحظات اختيارية..."
                className="min-h-[60px] bg-white border-slate-200"
              />
            </div>
          </div>
    </FormPanel>
  );
}
