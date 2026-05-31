import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";

interface PrefixSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function PrefixSettings({ settings, onChange }: PrefixSettingsProps) {
  return (
    <SettingsSection title="تخصيص تسلسل الوثائق" description="حدد البادئات التي يستخدمها النظام لتوليد الأرقام التسلسلية للفواتير والقيود.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">مبيعات</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.invoice_prefix} onChange={e => onChange("invoice_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.invoice_prefix}0001</p>
        </div>
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">مشتريات</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.purchase_prefix} onChange={e => onChange("purchase_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.purchase_prefix}0001</p>
        </div>
        <div className="space-y-3 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <Label className="font-black text-slate-700">قيود يومية</Label>
          <Input className="h-12 rounded-lg font-mono font-bold text-center" value={settings.journal_prefix} onChange={e => onChange("journal_prefix", e.target.value)} dir="ltr" />
          <p className="text-[10px] text-slate-400 font-bold text-center">مثال: {settings.journal_prefix}0001</p>
        </div>
      </div>
    </SettingsSection>
  );
}
