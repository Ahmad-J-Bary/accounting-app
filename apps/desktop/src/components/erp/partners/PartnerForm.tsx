import { useState, useEffect } from "react";
import { FormPanel } from "@/components/erp/shells/FormPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, TrendingUp } from "lucide-react";
import type { PartnerDto, PartnerRequest } from "@/services/partnerService";

interface PartnerFormProps {
  open: boolean;
  onClose: () => void;
  partner: PartnerDto | null;
  onSave: (payload: PartnerRequest) => Promise<void>;
  saving?: boolean;
}

export function PartnerForm({ open, onClose, partner, onSave, saving }: PartnerFormProps) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    exchangeRate: "100",
    amount: "0",
    isAmountInUsd: false,
    manualRatio: "",
  });

  useEffect(() => {
    if (partner) {
      setFormData({
        code: partner.code,
        name: partner.name,
        exchangeRate: partner.exchange_rate,
        amount: partner.is_amount_in_usd ? partner.amount_usd : partner.amount_local,
        isAmountInUsd: partner.is_amount_in_usd,
        manualRatio: partner.profit_sharing_ratio || "",
      });
    } else {
      setFormData({
        code: "",
        name: "",
        exchangeRate: "100",
        amount: "0",
        isAmountInUsd: false,
        manualRatio: "",
      });
    }
  }, [partner, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) return;

    onSave({
      id: partner?.id,
      code: formData.code || formData.name.slice(0, 4).toUpperCase().replace(/\s+/g, "") || "P000",
      name: formData.name,
      exchangeRate: formData.exchangeRate,
      amount: formData.amount,
      isAmountInUsd: formData.isAmountInUsd,
      sharingType: "BasedOnCapitalLocal",
      manualRatio: formData.manualRatio || null,
    });
  };

  if (!open) return null;

  return (
    <FormPanel
      title={partner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}
      onClose={onClose}
      onSave={handleSubmit}
      isSaving={saving}
      saveDisabled={!formData.name || !formData.amount}
      saveLabel={partner ? "تحديث البيانات" : "حفظ الشريك"}
    >
      <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
        <p className="text-xs text-blue-800">أدخل بيانات الشريك وحصة رأس المال الابتدائي.</p>
      </div>

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
              <div className="flex items-center justify-between">
                <Label className="font-bold">المبلغ المشارك به</Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="isUsd_form" className="text-xs cursor-pointer text-muted-foreground">بالدولار</Label>
                  <Checkbox 
                    id="isUsd_form" 
                    checked={formData.isAmountInUsd} 
                    onCheckedChange={(checked) => setFormData({...formData, isAmountInUsd: !!checked})} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs block text-right">المبلغ</Label>
                  <Input 
                    type="number" 
                    step="any"
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs block text-right">سعر الصرف ($)</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="any"
                      value={formData.exchangeRate} 
                      onChange={e => setFormData({...formData, exchangeRate: e.target.value})} 
                      className="pl-8 text-left"
                    />
                    <DollarSign className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  </div>
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
