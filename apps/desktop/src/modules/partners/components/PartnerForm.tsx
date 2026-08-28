import { useState, useEffect } from "react";
import { FormPanel } from '@widgets/form-shell/FormPanel';
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { TrendingUp } from "lucide-react";
import type { PartnerDto, PartnerRequest } from '@modules/partners/api/partnerService';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

interface PartnerFormProps {
  open: boolean;
  onClose: () => void;
  partner: PartnerDto | null;
  onSave: (payload: PartnerRequest) => Promise<void>;
  saving?: boolean;
}

export function PartnerForm({ open, onClose, partner, onSave, saving }: PartnerFormProps) {
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  
  const [formData, setFormData] = useState({
    name: "",
    amount: "0",
    currency: baseCurrency?.code || "",
    manualRatio: "",
  });

  useEffect(() => {
    if (partner) {
      setFormData({
        name: partner.name,
        amount: partner.is_amount_in_original ? (partner.amount_original || "0") : (partner.amount_local || "0"),
        currency: partner.currency || baseCurrency?.code || "",
        manualRatio: partner.profit_sharing_ratio || "",
      });
    } else {
      setFormData({
        name: "",
        amount: "0",
        currency: baseCurrency?.code || "",
        manualRatio: "",
      });
    }
  }, [partner, open, baseCurrency]);

  const handleSubmit = () => {
    if (!formData.name || !formData.amount) return;

    // When editing, use the partner's stored exchange rate so capital doesn't
    // change due to market rate fluctuations.  When creating, use the current rate.
    const exchangeRate = partner
      ? partner.exchange_rate
      : getExchangeRate(formData.currency, rateMap, baseCurrency?.code).toString();

    // إذا أدخل المستخدم نسبة مخصصة → Manual، وإلا → تلقائي (نسبة الأرباح = نسبة رأس المال)
    const sharingType = formData.manualRatio ? "Manual" : "BasedOnCapitalLocal";

    onSave({
      id: partner?.id,
      code: "",
      name: formData.name,
      currency: formData.currency,
      exchangeRate,
      amount: formData.amount,
      isAmountInOriginal: formData.currency !== baseCurrency?.code,
      sharingType,
      manualRatio: formData.manualRatio || null,
    });
  };

  if (!open) return null;

  return (
    <FormPanel
      title={partner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
      onClose={onClose}
      onSave={() => handleSubmit()}
      isSaving={saving}
      saveDisabled={!formData.name || !formData.amount}
      saveLabel={partner ? "تحديث البيانات" : "حفظ الشريك"}
    >

      <div className="space-y-4 text-right">
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

            <div className="space-y-4 border p-4 rounded-lg bg-slate-50/50">
              <Label className="font-bold">المبلغ المشارك به</Label>
              
              <div className="grid grid-cols-2 gap-4">
              {currencies.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600">العملة الافتراضية</Label>
                <Select value={formData.currency} onValueChange={(val) => setFormData({...formData, currency: val})}>
                  <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code} - {c.name_ar}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
                <div className="space-y-2">
                  <Label className="text-xs block text-right">المبلغ</Label>
                  <Input 
                    type="number" 
                    step="any"
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="text-left font-bold h-9"
                  />
                </div>
              </div>
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
          </div>
    </FormPanel>
  );
}