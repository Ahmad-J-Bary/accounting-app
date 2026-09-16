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
import { useLocalization } from "@app/providers/LocalizationProvider";

interface WarehouseSettingsProps {
  settings: CompanySettingsType;
  onChange: (key: keyof CompanySettingsType, value: string | number | boolean) => void;
}

export function WarehouseSettings({ settings, onChange }: WarehouseSettingsProps) {
  const { t } = useLocalization();
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
      toast.success(t("toasts.saved", { namespace: "settings" }), { description: t("toasts.savedWarehouses", { namespace: "settings" }) });
    } catch (e) {
      toast.error(t("toasts.saveError", { namespace: "settings" }), { description: String(e) });
    }
  };

  const defaultWarehouse = warehouses.find(w => w.is_default);
  const otherWarehouses = warehouses.filter(w => !w.is_default);
  const toSelectValue = (v: string | undefined) => v || "__default";
  const fromSelectValue = (v: string) => v === "__default" ? undefined : v;

  return (
    <SettingsSection title={t("warehouses.title", { namespace: "settings" })} description={t("warehouses.description", { namespace: "settings" })}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2 sm:space-y-3">
          <Label className="font-bold text-foreground flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            {t("warehouses.purchase", { namespace: "settings" })}
          </Label>
          <Select
            value={toSelectValue(settings.purchase_warehouse_id)}
            onValueChange={(v) => onChange("purchase_warehouse_id", fromSelectValue(v) ?? "")}
          >
            <SelectTrigger className="h-11 sm:h-12 rounded-lg border-border font-bold">
              <SelectValue placeholder={t("warehouses.selectPlaceholder", { namespace: "settings" })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default" className="font-bold text-muted-foreground">{t("warehouses.defaultOption", { namespace: "settings" })}{defaultWarehouse ? ` (${defaultWarehouse.name})` : ""}</SelectItem>
              {otherWarehouses.map((w) => (
                <SelectItem key={w.id} value={w.id} className="font-bold">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground font-medium">{t("warehouses.purchaseHint", { namespace: "settings" })}</p>
        </div>
        <div className="space-y-2 sm:space-y-3">
          <Label className="font-bold text-foreground flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-success" />
            {t("warehouses.sales", { namespace: "settings" })}
          </Label>
          <Select
            value={toSelectValue(settings.sales_warehouse_id)}
            onValueChange={(v) => onChange("sales_warehouse_id", fromSelectValue(v) ?? "")}
          >
            <SelectTrigger className="h-11 sm:h-12 rounded-lg border-border font-bold">
              <SelectValue placeholder={t("warehouses.selectPlaceholder", { namespace: "settings" })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default" className="font-bold text-muted-foreground">{t("warehouses.defaultOption", { namespace: "settings" })}{defaultWarehouse ? ` (${defaultWarehouse.name})` : ""}</SelectItem>
              {otherWarehouses.map((w) => (
                <SelectItem key={w.id} value={w.id} className="font-bold">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground font-medium">{t("warehouses.salesHint", { namespace: "settings" })}</p>
        </div>
      </div>
      <div className="flex justify-end mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
        <Button onClick={handleSave} className="gap-2 h-10 sm:h-11 px-5 sm:px-6">
          <Save className="w-4 h-4" />
          {t("saveEdits", { namespace: "settings" })}
        </Button>
      </div>
    </SettingsSection>
  );
}
