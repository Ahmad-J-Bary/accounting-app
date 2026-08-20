import { publishSettingsUpdated } from "@shared/hooks/settingsEvents";
import { Hash, Languages, Save } from "lucide-react";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";
import { setNumberingSystem } from "@shared/lib/format";
import { formatNumber } from "@shared/lib/format";
import { settingsService } from "@modules/core/api/settingsService";
import { toast } from "sonner";

interface LocalizationSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

function formatNumberWithSystem(n: number): string {
  return formatNumber(n);
}

const numeralSystems = [
  { value: "arabic", label: "أرقام عربية", preview: "٠١٢٣٤٥٦٧٨٩" },
  { value: "western", label: "أرقام أجنبية", preview: "0123456789" },
];

export function LocalizationSettings({ settings, onChange }: LocalizationSettingsProps) {
  const current = settings.numeral_system || "western";

  const handleChange = (value: string) => {
    onChange("numeral_system", value);
    setNumberingSystem(value);
  };

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
        purchase_warehouse_id: settings.purchase_warehouse_id,
        sales_warehouse_id: settings.sales_warehouse_id,
        numeral_system: settings.numeral_system || "western",
      });
      setNumberingSystem(settings.numeral_system || "western");
      publishSettingsUpdated();
      toast.success("تم الحفظ", { description: "تم حفظ نظام الأرقام بنجاح" });
    } catch (e) {
      toast.error("خطأ في الحفظ", { description: String(e) });
    }
  };

  return (
    <SettingsSection title="اللغة والمنطقة" description="تحديد نظام الأرقام المعروض في جميع أنحاء التطبيق.">
      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="font-black text-slate-700 flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-600" /> نظام الأرقام
          </Label>
          <p className="text-xs text-slate-400 font-medium">
            يُطبّق على جميع الأرقام في الجداول والتقارير والبطاقات.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {numeralSystems.map((sys) => (
            <button
              key={sys.value}
              onClick={() => handleChange(sys.value)}
              className={cn(
                "relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all",
                current === sys.value
                  ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {current === sys.value && (
                <div className="absolute top-3 left-3 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <Languages className={cn("w-8 h-8", current === sys.value ? "text-blue-600" : "text-slate-400")} />
              <span className={cn("font-bold text-sm", current === sys.value ? "text-blue-700" : "text-slate-600")}>
                {sys.label}
              </span>
              <div className={cn(
                "text-2xl font-black tracking-wider",
                current === sys.value ? "text-blue-600" : "text-slate-500"
              )}>
                {sys.preview}
              </div>
              <div className={cn(
                "text-xs font-medium",
                current === sys.value ? "text-blue-500" : "text-slate-400"
              )}>
                مثال: {formatNumberWithSystem(1234.56)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
          <Button onClick={handleSave} className="gap-2 h-11 px-6">
            <Save className="w-4 h-4" />
            حفظ التعديلات
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
