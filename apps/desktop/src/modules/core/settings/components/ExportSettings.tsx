import { FileDown, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import { useExportSettings, type ExportCurrencyMode } from "@shared/hooks/useExportSettings";

export function ExportSettings() {
  const { currencyMode, setCurrencyMode } = useExportSettings();

  return (
    <SettingsSection
      title="إعدادات التصدير"
      description="تخصيص طريقة عرض العملات في ملفات Excel المُصدَّرة."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="font-black text-slate-700 flex items-center gap-2">
              <FileDown className="w-4 h-4 text-indigo-600" />
              نمط العملات في التصدير
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
                  ثابتة — أعمدة العملات تظهر كما هي
                </SelectItem>
                <SelectItem value="variable" className="font-bold">
                  متغيرة — العملة الأساسية فقط + ورقة أسعار الصرف
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
              <Info className="w-4 h-4" />
              شرح النمطين
            </div>
            <div className="text-xs text-blue-700 space-y-1.5 leading-relaxed">
              <p>
                <strong>ثابتة (Fixed):</strong> تظهر أعمدة لكل عملة في الملف
                — نفس ما يظهر في الشاشة. مناسبة للفواتير متعددة العملات.
              </p>
              <p>
                <strong>متغيرة (Variable):</strong> تظهر مبالغ العملة الأساسية فقط
                في الورقة الرئيسية، وتُضاف ورقة ثانية &quot;أسعار الصرف&quot;
                تحتوي على سعر كل عملة مستخدمة. مناسبة للتصدير للبرامج الخارجية.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
