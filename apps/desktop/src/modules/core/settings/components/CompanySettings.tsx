import { Building, Globe, Mail, Phone, MapPin, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { toast } from "sonner";
import { settingsService } from '@modules/core/api/settingsService';
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { COMPANY_TYPE_EXISTING, COMPANY_TYPE_NEW } from "@modules/opening-balance/lib/wizard-types";
import {
  deriveCompanyInitState,
  INIT_STATE_LABELS,
} from "@modules/opening-balance/lib/company-lifecycle";

interface CompanySettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function CompanySettings({ settings, onChange }: CompanySettingsProps) {
  // Company type is only changeable before the accounting setup starts
  // (NOT_STARTED): afterwards it is locked to protect the opening migration.
  const { data: migrations = [] } = useQuery({
    queryKey: QUERY_KEYS.openingBalanceMigrations,
    queryFn: () => openingBalanceService.listMigrations(),
  });
  const { data: fiscalPeriods = [] } = useQuery({
    queryKey: QUERY_KEYS.fiscalPeriods,
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });
  const initState = deriveCompanyInitState({ settings, migrations, periods: fiscalPeriods });
  const canChangeType = initState === "NOT_STARTED";

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
        numeral_system: settings.numeral_system || "western",
        accounting_start_mode: settings.accounting_start_mode ?? COMPANY_TYPE_EXISTING,
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
        <div className="space-y-2 md:col-span-2">
          <Label className="font-bold text-slate-700">نوع الشركة</Label>
          <Select
            value={settings.accounting_start_mode ?? COMPANY_TYPE_EXISTING}
            onValueChange={(v) => onChange("accounting_start_mode", v)}
            disabled={!canChangeType}
          >
            <SelectTrigger className="h-12 rounded-lg border-slate-200">
              <SelectValue placeholder="اختر نوع الشركة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COMPANY_TYPE_EXISTING} className="text-xs">شركة قائمة (رصيد افتتاحي)</SelectItem>
              <SelectItem value={COMPANY_TYPE_NEW} className="text-xs">شركة جديدة (بدء من الصفر)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400" data-testid="company-type-hint">
            {canChangeType
              ? "يمكن تغيير نوع الشركة قبل بدء إدخال وضعها المالي. شركة جديدة = تبدأ السجلات من الصفر، شركة قائمة = يُدخل رصيدها الافتتاحي عند بدء الاستخدام."
              : `نوع الشركة مغلق بعد بدء الإعداد — الحالة الحالية: ${INIT_STATE_LABELS[initState]}.`}
          </p>
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
