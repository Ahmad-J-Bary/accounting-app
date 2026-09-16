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
import { useLocalization } from "@app/providers/LocalizationProvider";

interface LocalizationSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

function formatNumberWithSystem(n: number): string {
  return formatNumber(n);
}

const numeralSystems = [
  { value: "arabic", labelPath: "arabic", preview: "٠١٢٣٤٥٦٧٨٩" },
  { value: "western", labelPath: "western", preview: "0123456789" },
];

export function LocalizationSettings({ settings, onChange }: LocalizationSettingsProps) {
  const current = settings.numeral_system || "western";
  const { t, language, setLanguage } = useLocalization();

  const numeralLabels: Record<string, string> = {
    arabic: t("localization.numeralSystems.arabic", { namespace: "settings" }),
    western: t("localization.numeralSystems.western", { namespace: "settings" }),
  };

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
      toast.success(t("toasts.saved", { namespace: "settings" }), { description: t("toasts.savedNumeralSystem", { namespace: "settings" }) });
    } catch (e) {
      toast.error(t("toasts.saveError", { namespace: "settings" }), { description: String(e) });
    }
  };

  return (
    <SettingsSection title={t("localization.title", { namespace: "settings" })} description={t("localization.description", { namespace: "settings" })}>
      <div className="space-y-5 sm:space-y-6">
        <div className="space-y-2 sm:space-y-3">
          <Label className="font-black text-foreground flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" /> {t("localization.interfaceLanguage", { namespace: "settings" })}
          </Label>
          <div className="flex gap-3">
            {[
              { id: "ar", label: t("localization.languages.ar", { namespace: "settings" }) },
              { id: "en", label: t("localization.languages.en", { namespace: "settings" }) },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLanguage(option.id as "ar" | "en")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-bold transition-all flex-1 sm:flex-none",
                  language === option.id
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-border/80",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3">
          <Label className="font-black text-foreground flex items-center gap-2">
            <Hash className="w-4 h-4 text-success" /> {t("localization.numeralSystem", { namespace: "settings" })}
          </Label>
          <p className="text-xs text-muted-foreground font-medium">
            {t("localization.numeralHint", { namespace: "settings" })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {numeralSystems.map((sys) => (
            <button
              key={sys.value}
              onClick={() => handleChange(sys.value)}
              className={cn(
                "relative flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl border-2 transition-all",
                current === sys.value
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent"
              )}
            >
              {current === sys.value && (
                <div className="absolute top-3 left-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <Languages className={cn("w-7 h-7 sm:w-8 sm:h-8", current === sys.value ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("font-bold text-sm", current === sys.value ? "text-primary" : "text-foreground")}>
                {numeralLabels[sys.labelPath]}
              </span>
              <div className={cn(
                "text-xl sm:text-2xl font-black tracking-wider",
                current === sys.value ? "text-primary" : "text-muted-foreground"
              )}>
                {sys.preview}
              </div>
              <div className={cn(
                "text-xs font-medium",
                current === sys.value ? "text-primary/70" : "text-muted-foreground"
              )}>
                {t("localization.example", { namespace: "settings" })}{formatNumberWithSystem(1234.56)}
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
          <Button onClick={handleSave} className="gap-2 h-10 sm:h-11 px-5 sm:px-6">
            <Save className="w-4 h-4" />
            {t("saveEdits", { namespace: "settings" })}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
