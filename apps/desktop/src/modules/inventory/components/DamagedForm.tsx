import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { AlertTriangle } from "lucide-react";
import { useCurrencyField } from "@shared/hooks/useCurrencyField";
import { CurrencyField } from "@shared/ui/CurrencyField";

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

  const currencyField = useCurrencyField({
    initialCurrency: initialValues?.currency_code || undefined,
    initialFxRate: initialValues?.fx_rate ? String(initialValues.fx_rate) : undefined,
    disableAutoFx: isEditMode,
  });

  const baseCostRef = useRef(0);
  const materialCurrencyRef = useRef("");
  const { convertBetween } = currencyField;

  const getDefaultCurrency = useCallback((mat?: MaterialDto): string => {
    const baseCode = currencyField.baseCurrencyCode;
    const preferred = mat?.default_purchase_currency;
    const preferredActive = preferred && currencyField.currencies.some(c => c.is_active && c.code === preferred);
    return preferredActive ? preferred : baseCode || currencyField.getDefaultCurrency();
  }, [currencyField]);

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
      const savedCurrency = initialValues.currency_code || currencyField.baseCurrencyCode;
      const savedFxRate = parseFloat(String(initialValues.fx_rate || "1"));
      currencyField.setCurrency(savedCurrency);
      currencyField.setFxRate(String(initialValues.fx_rate || "1"));
      const costImpact = parseFloat(String(initialValues.cost_impact || "0"));
      baseCostRef.current = costImpact * savedFxRate;
      materialCurrencyRef.current = savedCurrency;
    } else {
      const prod = products.find(p => p.id === initialMaterialId);
      const cost = prod ? parseFloat(prod.last_purchase_price || "0") : 0;
      const matCurrency = prod?.default_purchase_currency || currencyField.baseCurrencyCode;
      materialCurrencyRef.current = matCurrency;
      baseCostRef.current = cost;
      const selectedCurrency = getDefaultCurrency(prod);
      currencyField.setCurrency(selectedCurrency);
      currencyField.setFxRate("1");
      const converted = selectedCurrency === matCurrency
        ? cost
        : convertBetween(cost, matCurrency, selectedCurrency);
      setForm({
        damage_date: new Date().toISOString(),
        quantity: 0,
        cost_impact: converted,
        reason: "",
        material_id: initialMaterialId ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMaterialId, initialValues, products]);

  // Reconvert cost when currency changes
  useEffect(() => {
    if (materialCurrencyRef.current && baseCostRef.current > 0) {
      const converted = currencyField.currency === materialCurrencyRef.current
        ? baseCostRef.current
        : convertBetween(baseCostRef.current, materialCurrencyRef.current, currencyField.currency);
      setForm(p => ({ ...p, cost_impact: converted }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyField.currency]);

  const handleSave = async () => {
    if (!form.material_id || !form.quantity) return;
    await onSave({
      ...form,
      currency_code: currencyField.currency || undefined,
      fx_rate: parseFloat(currencyField.fxRate) || 1,
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
          <div className="space-y-2">
            <FieldLabel required>المادة</FieldLabel>
            <Select
              value={form.material_id ?? ""}
              onValueChange={(val) => {
                const mid = val;
                const prod = products.find((p) => p.id === mid);
                const qty = (form.quantity as number) || 1;
                const baseCost = prod ? parseFloat(prod.last_purchase_price || "0") * qty : 0;
                const matCurrency = prod?.default_purchase_currency || currencyField.baseCurrencyCode;
                baseCostRef.current = baseCost;
                materialCurrencyRef.current = matCurrency;
                const selectedCurrency = getDefaultCurrency(prod);
                currencyField.setCurrency(selectedCurrency);
                const converted = selectedCurrency === matCurrency
                  ? baseCost
                  : convertBetween(baseCost, matCurrency, selectedCurrency);
                setForm((p) => ({
                  ...p,
                  material_id: mid,
                  cost_impact: converted,
                }));
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
                const baseCost = prod ? parseFloat(prod.last_purchase_price || "0") * qty : 0;
                baseCostRef.current = baseCost;
                const converted = materialCurrencyRef.current && materialCurrencyRef.current !== currencyField.currency
                  ? convertBetween(baseCost, materialCurrencyRef.current, currencyField.currency)
                  : baseCost;
                setForm((p) => ({
                  ...p,
                  quantity: qty,
                  cost_impact: converted,
                }));
              }}
              className="bg-white border-slate-200 h-9 text-xs tabular-nums"
              placeholder="أدخل الكمية..."
            />
          </div>

          <CurrencyField
            label="تأثير التكلفة المالي"
            currency={currencyField.currency}
            onCurrencyChange={currencyField.setCurrency}
            amount={form.cost_impact || ""}
            onAmountChange={(val) => setForm((p) => ({ ...p, cost_impact: parseFloat(val) || 0 }))}
            symbol={currencyField.symbol}
            showCurrency={currencyField.hasMultipleCurrencies}
            currencies={currencyField.currencies}
          />

          <div className="space-y-2">
            <FieldLabel>تاريخ التلف</FieldLabel>
            <Input
              type="date"
              value={form.damage_date?.slice(0, 10) ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, damage_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200"
            />
          </div>

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
