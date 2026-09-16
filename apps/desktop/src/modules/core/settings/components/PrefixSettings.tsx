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
    <SettingsSection title={t("prefixes.title", { namespace: "settings" })} description={t("prefixes.description", { namespace: "settings" })}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        <div className="space-y-3 p-4 sm:p-6 rounded-2xl bg-muted/50 border border-border">
          <Label className="font-black text-foreground">{t("prefixes.sales", { namespace: "settings" })}</Label>
          <Input className="h-11 sm:h-12 rounded-lg font-mono font-bold text-center" value={settings.invoice_prefix} onChange={e => onChange("invoice_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-muted-foreground font-bold text-center">{t("prefixes.example", { namespace: "settings", vars: { prefix: settings.invoice_prefix } })}</p>
        </div>
        <div className="space-y-3 p-4 sm:p-6 rounded-2xl bg-muted/50 border border-border">
          <Label className="font-black text-foreground">{t("prefixes.purchases", { namespace: "settings" })}</Label>
          <Input className="h-11 sm:h-12 rounded-lg font-mono font-bold text-center" value={settings.purchase_prefix} onChange={e => onChange("purchase_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-muted-foreground font-bold text-center">{t("prefixes.example", { namespace: "settings", vars: { prefix: settings.purchase_prefix } })}</p>
        </div>
        <div className="space-y-3 p-4 sm:p-6 rounded-2xl bg-muted/50 border border-border">
          <Label className="font-black text-foreground">{t("prefixes.journal", { namespace: "settings" })}</Label>
          <Input className="h-11 sm:h-12 rounded-lg font-mono font-bold text-center" value={settings.journal_prefix} onChange={e => onChange("journal_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-muted-foreground font-bold text-center">{t("prefixes.example", { namespace: "settings", vars: { prefix: settings.journal_prefix } })}</p>
        </div>
      </div>
    </SettingsSection>
  );
}
