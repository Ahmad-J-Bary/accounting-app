import { FileDown, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { useExportSettings, type ExportCurrencyMode } from "@shared/hooks/useExportSettings";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function ExportSettings() {
  const { currencyMode, setCurrencyMode } = useExportSettings();
  const { t } = useLocalization();

  return (
    <SettingsSection
      title={t("export.title", { namespace: "settings",  })}
      description={t("export.description", { namespace: "settings",  })}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="font-black text-slate-700 flex items-center gap-2">
              <FileDown className="w-4 h-4 text-indigo-600" />
              {t("export.currencyMode", { namespace: "settings",  })}
            </label>
            <Select
              value={currencyMode}
              onValueChange={(v) => setCurrencyMode(v as ExportCurrencyMode)}
            >
              <SelectTrigger className="h-14 rounded-xl border-slate-200 font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed" className="font-bold">
                  {t("export.fixed", { namespace: "settings",  })}
                </SelectItem>
                <SelectItem value="variable" className="font-bold">
                  {t("export.variable", { namespace: "settings",  })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
              <Info className="w-4 h-4" />
              {t("export.explainerTitle", { namespace: "settings",  })}
            </div>
            <div className="text-xs text-blue-700 space-y-1.5 leading-relaxed">
              <p>
                <strong>{t("export.fixedStrong", { namespace: "settings",  })}</strong> {t("export.fixedBody", { namespace: "settings",  })}
              </p>
              <p>
                <strong>{t("export.variableStrong", { namespace: "settings",  })}</strong> {t("export.variableBody", { namespace: "settings",  })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
