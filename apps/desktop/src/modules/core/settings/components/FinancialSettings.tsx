import { Percent, CalendarDays } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface FinancialSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function FinancialSettings({ settings, onChange }: FinancialSettingsProps) {
  const { t } = useLocalization();
  return (
    <SettingsSection title={t("settings.financial.title", { namespace: "settings", fallback: "القواعد والخيارات المالية" })} description={t("settings.financial.description", { namespace: "settings", fallback: "الضريبة ودورة السنة المالية." })}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="font-black text-slate-700 flex items-center gap-2"><Percent className="w-4 h-4 text-rose-600" /> {t("settings.financial.taxRate", { namespace: "settings", fallback: "ضريبة القيمة المضافة الافتراضية" })}</Label>
            <div className="relative">
              <Input type="number" step="0.01" className="h-14 font-black pr-6 pl-14" value={settings.tax_rate} onChange={e => onChange("tax_rate", e.target.value)} />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
            </div>
          </div>
        </div>
        <div className="space-y-6">
           <div className="space-y-3">
            <Label className="font-black text-slate-700 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-600" /> {t("settings.financial.fiscalYearStart", { namespace: "settings", fallback: "شهر بداية السنة المالية" })}</Label>
            <Select value={settings.fiscal_year_start_month.toString()} onValueChange={v => onChange("fiscal_year_start_month", parseInt(v))}>
              <SelectTrigger className="h-14 rounded-xl border-slate-200 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()} className="font-bold">{t("settings.financial.monthLabel", { namespace: "settings", fallback: "الشهر {{month}}", vars: { month: i + 1 } })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 font-medium italic">{t("settings.financial.hint", { namespace: "settings", fallback: "يستخدم هذا التاريخ لحساب إغلاق الحسابات وتوليد الميزانية الافتتاحية." })}</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
