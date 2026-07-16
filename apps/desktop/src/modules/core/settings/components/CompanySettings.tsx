import { Building, Globe, Mail, Phone, MapPin, Save } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { toast } from "sonner";
import { settingsService } from '@modules/core/api/settingsService';

interface CompanySettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function CompanySettings({ settings, onChange }: CompanySettingsProps) {
  const handleSave = async () => {
    try {
      await settingsService.updateSettings({
        company_name: settings.company_name,
        company_name_en: settings.company_name_en,
        tax_number: settings.tax_number,
        commercial_register: settings.commercial_register,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        currency_symbol: settings.currency_symbol,
        tax_rate: Number(settings.tax_rate),
        invoice_prefix: settings.invoice_prefix,
        purchase_prefix: settings.purchase_prefix,
        journal_prefix: settings.journal_prefix,
        fiscal_year_start_month: settings.fiscal_year_start_month,
      });
      window.dispatchEvent(new CustomEvent("erp:settings-updated"));
      toast.success("تم الحفظ", { description: "تم حفظ بيانات الشركة بنجاح" });
    } catch (e) {
      toast.error("خطأ في الحفظ", { description: String(e) });
    }
  };

  return (
    <SettingsSection title="الهوية الأساسية للشركة" description="هذه البيانات ستظهر في ترويسة الفواتير والتقارير الرسمية.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">اسم الشركة (عربي) *</Label>
          <div className="relative">
            <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" value={settings.company_name} onChange={e => onChange("company_name", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">Company Name (English)</Label>
          <div className="relative">
            <Globe className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" dir="ltr" value={settings.company_name_en ?? ""} onChange={e => onChange("company_name_en", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">الرقم الضريبي</Label>
          <Input className="h-12 rounded-lg border-slate-200" value={settings.tax_number ?? ""} onChange={e => onChange("tax_number", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">السجل التجاري</Label>
          <Input className="h-12 rounded-lg border-slate-200" value={settings.commercial_register ?? ""} onChange={e => onChange("commercial_register", e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="font-bold text-slate-700">العنوان بالتفصيل</Label>
          <div className="relative">
            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200" value={settings.address ?? ""} onChange={e => onChange("address", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">الهاتف المعتمد</Label>
          <div className="relative">
            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.phone ?? ""} onChange={e => onChange("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">البريد الإلكتروني الرسمي</Label>
          <div className="relative">
            <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.email ?? ""} onChange={e => onChange("email", e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
        <Button onClick={handleSave} className="gap-2 h-11 px-6">
          <Save className="w-4 h-4" />
          حفظ التعديلات
        </Button>
      </div>
    </SettingsSection>
  );
}
