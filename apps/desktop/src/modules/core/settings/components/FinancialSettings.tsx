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
    <SettingsSection title={t("financial.title", { namespace: "settings" })} description={t("financial.description", { namespace: "settings" })}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            <Label className="font-black text-foreground flex items-center gap-2"><Percent className="w-4 h-4 text-destructive" /> {t("financial.taxRate", { namespace: "settings" })}</Label>
            <div className="relative">
              <Input type="number" step="0.01" className="h-12 sm:h-14 font-black pe-6 ps-14" value={settings.tax_rate} onChange={e => onChange("tax_rate", e.target.value)} />
              <span className="absolute start-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">%</span>
            </div>
          </div>
        </div>
        <div className="space-y-4 sm:space-y-6">
           <div className="space-y-2 sm:space-y-3">
            <Label className="font-black text-foreground flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-600" /> {t("financial.fiscalYearStart", { namespace: "settings" })}</Label>
            <Select value={settings.fiscal_year_start_month.toString()} onValueChange={v => onChange("fiscal_year_start_month", parseInt(v))}>
              <SelectTrigger className="h-12 sm:h-14 rounded-xl border-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()} className="font-bold">{t("financial.monthLabel", { namespace: "settings", vars: { month: i + 1 } })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground font-medium italic">{t("financial.hint", { namespace: "settings" })}</p>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
