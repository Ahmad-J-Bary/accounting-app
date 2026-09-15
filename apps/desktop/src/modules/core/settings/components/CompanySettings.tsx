import { publishSettingsUpdated } from "@shared/hooks/settingsEvents";
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
  initStateLabel,
} from "@modules/opening-balance/lib/company-lifecycle";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface CompanySettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function CompanySettings({ settings, onChange }: CompanySettingsProps) {
  const { t } = useLocalization();
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
      publishSettingsUpdated();
      toast.success(t("toasts.saved", { namespace: "settings",  }), { description: t("toasts.savedCompany", { namespace: "settings",  }) });
    } catch (e) {
      toast.error(t("toasts.saveError", { namespace: "settings",  }), { description: String(e) });
    }
  };

  return (
    <SettingsSection title={t("company.title", { namespace: "settings",  })} description={t("company.description", { namespace: "settings",  })}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.nameAr", { namespace: "settings",  })}</Label>
          <div className="relative">
            <Building className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" value={settings.company_name} onChange={e => onChange("company_name", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.nameEn", { namespace: "settings",  })}</Label>
          <div className="relative">
            <Globe className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 focus:ring-blue-500" dir="ltr" value={settings.company_name_en ?? ""} onChange={e => onChange("company_name_en", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.taxNumber", { namespace: "settings",  })}</Label>
          <Input className="h-12 rounded-lg border-slate-200" value={settings.tax_number ?? ""} onChange={e => onChange("tax_number", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.commercialRegister", { namespace: "settings",  })}</Label>
          <Input className="h-12 rounded-lg border-slate-200" value={settings.commercial_register ?? ""} onChange={e => onChange("commercial_register", e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="font-bold text-slate-700">{t("company.address", { namespace: "settings",  })}</Label>
          <div className="relative">
            <MapPin className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200" value={settings.address ?? ""} onChange={e => onChange("address", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.phone", { namespace: "settings",  })}</Label>
          <div className="relative">
            <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.phone ?? ""} onChange={e => onChange("phone", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="font-bold text-slate-700">{t("company.email", { namespace: "settings",  })}</Label>
          <div className="relative">
            <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input className="pr-11 h-12 rounded-lg border-slate-200 font-mono" dir="ltr" value={settings.email ?? ""} onChange={e => onChange("email", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="font-bold text-slate-700">{t("company.companyType", { namespace: "settings",  })}</Label>
          <Select
            value={settings.accounting_start_mode ?? COMPANY_TYPE_EXISTING}
            onValueChange={(v) => onChange("accounting_start_mode", v)}
            disabled={!canChangeType}
          >
            <SelectTrigger className="h-12 rounded-lg border-slate-200">
              <SelectValue placeholder={t("company.companyTypePlaceholder", { namespace: "settings",  })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={COMPANY_TYPE_EXISTING} className="text-xs">{t("company.typeExisting", { namespace: "settings",  })}</SelectItem>
              <SelectItem value={COMPANY_TYPE_NEW} className="text-xs">{t("company.typeNew", { namespace: "settings",  })}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400" data-testid="company-type-hint">
            {canChangeType
              ? t("company.typeHintChangeable", { namespace: "settings",  })
              : t("company.typeLocked", { namespace: "settings", vars: { state: initStateLabel(initState, t) } })}
          </p>
        </div>
      </div>
      <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
        <Button onClick={handleSave} className="gap-2 h-11 px-6">
          <Save className="w-4 h-4" />
          {t("saveEdits", { namespace: "settings",  })}
        </Button>
      </div>
    </SettingsSection>
  );
}
