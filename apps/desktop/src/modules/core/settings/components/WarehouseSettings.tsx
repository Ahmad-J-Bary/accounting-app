import { publishSettingsUpdated } from "@shared/hooks/settingsEvents";
import { useEffect, useState } from "react";
import { Warehouse, Save, Building } from "lucide-react";
import { Label } from "@shared/ui/label";
import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { SettingsSection } from "@widgets/templates/SettingsLayout";
import type { CompanySettings as CompanySettingsType, WarehouseDto } from "@erp/shared-types";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { settingsService } from '@modules/core/api/settingsService';
import { toast } from "sonner";

interface WarehouseSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function WarehouseSettings({ settings, onChange }: WarehouseSettingsProps) {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);

  useEffect(() => {
    warehouseService.list().then(setWarehouses).catch(() => {});
  }, []);

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
      publishSettingsUpdated();
      toast.success("تم الحفظ", { description: "تم حفظ إعدادات المستودعات بنجاح" });
    } catch (e) {
      toast.error("خطأ في الحفظ", { description: String(e) });
    }
  };

  const defaultWarehouse = warehouses.find(w => w.is_default);
  const otherWarehouses = warehouses.filter(w => !w.is_default);
  const toSelectValue = (v: string | undefined) => v || "__default";
  const fromSelectValue = (v: string) => v === "__default" ? undefined : v;

  return (
    <SettingsSection title="المستودعات الافتراضية" description="اختر المستودع الافتراضي لفواتير المشتريات والمبيعات.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="font-bold text-slate-700 flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            مستودع المشتريات
          </Label>
          <Select
            value={toSelectValue(settings.purchase_warehouse_id)}
            onValueChange={(v) => onChange("purchase_warehouse_id", fromSelectValue(v) ?? "")}
          >
            <SelectTrigger className="h-12 rounded-lg border-slate-200 font-bold">
              <SelectValue placeholder="اختر المستودع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default" className="font-bold text-slate-400">افتراضي{defaultWarehouse ? ` (${defaultWarehouse.name})` : ""}</SelectItem>
              {otherWarehouses.map((w) => (
                <SelectItem key={w.id} value={w.id} className="font-bold">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 font-medium">سيتم استخدام هذا المستودع كقيمة افتراضية في بنود فواتير المشتريات.</p>
        </div>
        <div className="space-y-3">
          <Label className="font-bold text-slate-700 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-emerald-600" />
            مستودع المبيعات
          </Label>
          <Select
            value={toSelectValue(settings.sales_warehouse_id)}
            onValueChange={(v) => onChange("sales_warehouse_id", fromSelectValue(v) ?? "")}
          >
            <SelectTrigger className="h-12 rounded-lg border-slate-200 font-bold">
              <SelectValue placeholder="اختر المستودع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default" className="font-bold text-slate-400">افتراضي{defaultWarehouse ? ` (${defaultWarehouse.name})` : ""}</SelectItem>
              {otherWarehouses.map((w) => (
                <SelectItem key={w.id} value={w.id} className="font-bold">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 font-medium">سيتم استخدام هذا المستودع كقيمة افتراضية في بنود فواتير المبيعات.</p>
        </div>
      </div>
      <div className="flex justify-end mt-6 pt-6 border-t border-slate-100">
        <Button onClick={handleSave} className="gap-2 h-11 px-6">
          <Save className="w-4 h-4" />
          حفظ التعديلات
        </Button>
      </div>
    </SettingsSection>
  );
}
