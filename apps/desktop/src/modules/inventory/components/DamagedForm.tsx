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
  });

  const { convertBetween, baseCurrencyCode, currencies, getDefaultCurrency } = currencyField;

  // Source-of-truth for the auto-computed cost, expressed in the material's
  // purchase currency. The damaged workflow displays the canonical carrying
  // cost but does not let the user override it from the form.
  const baseCostRef = useRef(0);
  const materialCurrencyRef = useRef("");

  const getDefaultCurrencyFor = useCallback((mat?: MaterialDto): string => {
    const preferred = mat?.default_purchase_currency;
    const preferredActive = preferred && currencies.some(c => c.is_active && c.code === preferred);
    return preferredActive ? preferred : baseCurrencyCode || getDefaultCurrency();
  }, [currencies, baseCurrencyCode, getDefaultCurrency]);

  const unitCostInMaterialCurrency = useCallback((mat?: MaterialDto): number => {
    return mat ? parseFloat(mat.last_purchase_price || "0") : 0;
  }, []);

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
      const savedCurrency = initialValues.currency_code || baseCurrencyCode;
      currencyField.setCurrency(savedCurrency);
      // Back-reference the stored cost into the material's purchase currency
      // so that a currency change keeps a correct value. Use the stored
      // (historical) fx_rate instead of current live rates so the stored
      // amount is preserved exactly (1 base = fx_rate foreign).
      const costImpact = parseFloat(String(initialValues.cost_impact || "0"));
      const prod = products.find(p => p.id === initialValues.material_id);
      const matCurrency = prod?.default_purchase_currency || baseCurrencyCode;
      materialCurrencyRef.current = matCurrency;
      if (savedCurrency === matCurrency) {
        baseCostRef.current = costImpact;
      } else {
        baseCostRef.current = convertBetween(costImpact, savedCurrency, matCurrency);
      }
    } else {
      const prod = products.find(p => p.id === initialMaterialId);
      const unitCost = unitCostInMaterialCurrency(prod);
      const matCurrency = prod?.default_purchase_currency || baseCurrencyCode;
      const qty = 0;
      materialCurrencyRef.current = matCurrency;
      baseCostRef.current = unitCost * qty;
      const selectedCurrency = getDefaultCurrencyFor(prod);
      currencyField.setCurrency(selectedCurrency);
      currencyField.setFxRate("1");
      setForm({
        damage_date: new Date().toISOString(),
        quantity: qty,
        cost_impact: 0,
        reason: "",
        material_id: initialMaterialId ?? "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMaterialId, initialValues, products]);

  // Recompute the displayed cost when the selected currency changes.
  useEffect(() => {
    if (!materialCurrencyRef.current) return;
    if (baseCostRef.current <= 0) return;
    const converted = currencyField.currency === materialCurrencyRef.current
      ? baseCostRef.current
      : convertBetween(baseCostRef.current, materialCurrencyRef.current, currencyField.currency);
    setForm(p => ({ ...p, cost_impact: converted }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyField.currency]);

  const handleMaterialChange = (val: string) => {
    const prod = products.find((p) => p.id === val);
    const qty = (form.quantity as number) || 1;
    const matCurrency = prod?.default_purchase_currency || baseCurrencyCode;
    materialCurrencyRef.current = matCurrency;
    const unitCost = unitCostInMaterialCurrency(prod);
    baseCostRef.current = unitCost * qty;
    const selectedCurrency = getDefaultCurrencyFor(prod);
    currencyField.setCurrency(selectedCurrency);
    const converted = selectedCurrency === matCurrency
      ? baseCostRef.current
      : convertBetween(baseCostRef.current, matCurrency, selectedCurrency);
    setForm((p) => ({
      ...p,
      material_id: val,
      cost_impact: converted,
    }));
  };

  const handleQuantityChange = (val: string) => {
    const qty = parseFloat(val) || 0;
    const prod = products.find((p) => p.id === form.material_id);
    const unitCost = unitCostInMaterialCurrency(prod);
    const matCurrency = materialCurrencyRef.current || prod?.default_purchase_currency || baseCurrencyCode;
    materialCurrencyRef.current = matCurrency;
    baseCostRef.current = unitCost * qty;
    const converted = matCurrency === currencyField.currency
      ? baseCostRef.current
      : convertBetween(baseCostRef.current, matCurrency, currencyField.currency);
    setForm((p) => ({
      ...p,
      quantity: qty,
      cost_impact: converted,
    }));
  };

  const handleSave = async () => {
    if (!form.material_id || !form.quantity) return;
    await onSave({
      material_id: form.material_id,
      quantity: form.quantity,
      reason: form.reason || undefined,
      damage_date: form.damage_date || new Date().toISOString(),
      cost_impact: form.cost_impact ?? 0,
      notes: form.notes,
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
            <Select value={form.material_id ?? ""} onValueChange={handleMaterialChange}>
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
              onChange={(e) => handleQuantityChange(e.target.value)}
              className="bg-white border-slate-200 h-9 text-xs tabular-nums"
              placeholder="أدخل الكمية..."
            />
          </div>

          <CurrencyField
            label="تأثير التكلفة"
            currency={currencyField.currency}
            onCurrencyChange={currencyField.setCurrency}
            amount={form.cost_impact || ""}
            onAmountChange={(val) => {
              const newAmount = parseFloat(val) || 0;
              const matCurrency = materialCurrencyRef.current;
              if (currencyField.currency === matCurrency) {
                baseCostRef.current = newAmount;
              } else {
                baseCostRef.current = convertBetween(newAmount, currencyField.currency, matCurrency);
              }
              setForm((p) => ({ ...p, cost_impact: newAmount }));
            }}
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
