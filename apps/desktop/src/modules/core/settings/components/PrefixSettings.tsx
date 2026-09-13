import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PrefixSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function PrefixSettings({ settings, onChange }: PrefixSettingsProps) {
  const { t } = useLocalization();
  return (
    <SettingsSection title={t("settings.prefixes.title", { namespace: "settings", fallback: "تخصيص تسلسل الوثائق" })} description={t("settings.prefixes.description", { namespace: "settings", fallback: "حدد البادئات التي يستخدمها النظام لتوليد الأرقام التسلسلية للفواتير والقيود." })}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">{t("settings.prefixes.sales", { namespace: "settings", fallback: "مبيعات" })}</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.invoice_prefix} onChange={e => onChange("invoice_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">{t("settings.prefixes.example", { namespace: "settings", fallback: "مثال: {{prefix}}0001", vars: { prefix: settings.invoice_prefix } })}</p>
        </div>
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">{t("settings.prefixes.purchases", { namespace: "settings", fallback: "مشتريات" })}</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.purchase_prefix} onChange={e => onChange("purchase_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">{t("settings.prefixes.example", { namespace: "settings", fallback: "مثال: {{prefix}}0001", vars: { prefix: settings.purchase_prefix } })}</p>
        </div>
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">{t("settings.prefixes.journal", { namespace: "settings", fallback: "قيود يومية" })}</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.journal_prefix} onChange={e => onChange("journal_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">{t("settings.prefixes.example", { namespace: "settings", fallback: "مثال: {{prefix}}0001", vars: { prefix: settings.journal_prefix } })}</p>
        </div>
      </div>
    </SettingsSection>
  );
}
