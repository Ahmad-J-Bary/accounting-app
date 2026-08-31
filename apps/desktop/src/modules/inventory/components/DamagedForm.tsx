import { useState, useEffect, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { AlertTriangle } from "lucide-react";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

interface DamagedFormProps {
  onClose: () => void;
  products: MaterialDto[];
  onSave: (payload: CreateDamagedItemRequest) => Promise<void>;
  saving: boolean;
  initialMaterialId?: string;
  initialValues?: Partial<CreateDamagedItemRequest>;
}

export function DamagedForm({ onClose, products, onSave, saving, initialMaterialId, initialValues }: DamagedFormProps) {
  const isEditMode = !!initialValues;
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const hasSecondaryCurrencies = currencies.length > 1;
  const [currency, setCurrency] = useState<string>(initialValues?.currency_code ?? "");
  const [fxRate, setFxRate] = useState<string>("1");
  const currencySymbol = currencies.find(c => c.code === currency)?.symbol ?? "";

  const getDefaultCurrency = useCallback((mat?: MaterialDto): string => {
    const baseCode = baseCurrency?.code ?? "";
    const preferred = mat?.default_purchase_currency;
    const preferredActive = preferred && currencies.some(c => c.is_active && c.code === preferred);
    return preferredActive ? preferred : baseCode || (currencies[0]?.code ?? "");
  }, [baseCurrency, currencies]);

  const [form, setForm] = useState<Partial<CreateDamagedItemRequest>>(() => {
    if (initialValues) {
      return { ...initialValues };
    }
    const prod = products.find(p => p.id === initialMaterialId);
    return {
      damage_date: new Date().toISOString(),
      quantity: 0,
      cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") : 0,
      reason: "",
      material_id: initialMaterialId ?? "",
    };
  });

  useEffect(() => {
    if (initialValues) {
      setForm({ ...initialValues });
      setCurrency(initialValues.currency_code || baseCurrency?.code || "");
      setFxRate(initialValues.fx_rate ? String(initialValues.fx_rate) : "1");
    } else {
      const prod = products.find(p => p.id === initialMaterialId);
      setForm({
        damage_date: new Date().toISOString(),
        quantity: 0,
        cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") : 0,
        reason: "",
        material_id: initialMaterialId ?? "",
      });
      setCurrency(getDefaultCurrency(prod));
      setFxRate("1");
    }
  }, [initialMaterialId, initialValues, products, baseCurrency, getDefaultCurrency]);

  // Auto-fill exchange rate when the selected currency changes.
  useEffect(() => {
    if (currency) {
      const rate = getExchangeRate(currency, rateMap, baseCurrency?.code);
      setFxRate(String(rate));
    }
  }, [currency, rateMap, baseCurrency]);

  const handleSave = async () => {
    if (!form.material_id || !form.quantity) return;
    await onSave({
      ...form,
      currency_code: currency || undefined,
      fx_rate: parseFloat(fxRate) || 1,
    } as CreateDamagedItemRequest);
  };

  return (
    <FormPanel
      title={isEditMode ? "تعديل تالف" : "تسجيل مواد تالفة"}
      icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={saving || !form.material_id || !form.quantity}
      saveLabel="تسجيل التالف"
    >
      <SidebarSection title="بيانات التلف" defaultOpen={true}>
        <div className="space-y-4 text-right">
          {/* المنتج */}
          <div className="space-y-2">
            <FieldLabel required>المادة</FieldLabel>
            <Select
              value={form.material_id ?? ""}
              onValueChange={(val) => {
                const mid = val;
                const prod = products.find((p) => p.id === mid);
                setForm((p) => ({
                  ...p,
                  material_id: mid,
                  cost_impact: prod
                    ? parseFloat(prod.last_purchase_price || "0") * ((p.quantity as number) || 1)
                    : p.cost_impact,
                }));
                setCurrency(getDefaultCurrency(prod));
              }}
            >
              <SelectTrigger className="w-full bg-white border-slate-200">
                <SelectValue placeholder="اختر المادة..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الكمية */}
          <div className="space-y-2">
            <FieldLabel required>الكمية التالفة</FieldLabel>
            <Input
              type="number"
              min="1"
              step="1"
              value={form.quantity || ""}
              onChange={(e) => {
                const qty = parseFloat(e.target.value) || 0;
                const prod = products.find((p) => p.id === form.material_id);
                setForm((p) => ({
                  ...p,
                  quantity: qty,
                  cost_impact: prod ? parseFloat(prod.last_purchase_price || "0") * qty : p.cost_impact,
                }));
              }}
              className="bg-white border-slate-200"
              placeholder="أدخل الكمية..."
            />
          </div>

          {/* تأثير التكلفة */}
          <div className={hasSecondaryCurrencies ? "grid grid-cols-2 gap-3" : ""}>
            {hasSecondaryCurrencies && (
              <div className="space-y-2">
                <FieldLabel>العملة</FieldLabel>
                <Select dir="rtl" value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-white border-slate-200 w-full text-right"><SelectValue placeholder="اختر العملة" /></SelectTrigger>
                  <SelectContent>
                    {currencies.filter(c => c.is_active).map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name_ar} ({c.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <FieldLabel>تأثير التكلفة المالي</FieldLabel>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_impact || ""}
                  onChange={(e) => setForm((p) => ({ ...p, cost_impact: parseFloat(e.target.value) || 0 }))}
                  className="bg-white border-slate-200 font-bold text-slate-700 pl-10"
                  placeholder="التأثير المالي للمواد التالفة..."
                />
                {currencySymbol && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{currencySymbol}</span>
                )}
              </div>
            </div>
          </div>

          {/* تاريخ التلف */}
          <div className="space-y-2">
            <FieldLabel>تاريخ التلف</FieldLabel>
            <Input
              type="date"
              value={form.damage_date?.slice(0, 10) ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, damage_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200"
            />
          </div>

          {/* سبب التلف */}
          <div className="space-y-2">
            <FieldLabel>سبب التلف</FieldLabel>
            <Textarea
              value={form.reason ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              placeholder="استهلاك، كسر، انتهاء صلاحية... (اختياري)"
              className="min-h-[60px] bg-white border-slate-200"
            />
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}
