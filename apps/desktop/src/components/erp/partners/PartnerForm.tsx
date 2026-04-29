import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, TrendingUp } from "lucide-react";
import type { PartnerDto, PartnerRequest } from "@/services/partnerService";

interface PartnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: PartnerDto | null;
  onSave: (payload: PartnerRequest) => Promise<void>;
  saving?: boolean;
}

export function PartnerForm({ open, onOpenChange, partner, onSave, saving }: PartnerFormProps) {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    exchangeRate: "500",
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
        exchangeRate: "500",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="text-right">
            <DialogTitle>{partner ? "تعديل بيانات الشريك" : "إضافة شريك جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات الشريك وحصة رأس المال الابتدائي.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

          <DialogFooter className="gap-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "جاري الحفظ..." : partner ? "تحديث البيانات" : "حفظ الشريك"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
