import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@shared/ui/input";
import { Textarea } from "@shared/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { CreateStockAdjustmentRequest, StockAdjustment, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { stockMovementService } from '@modules/inventory/api/stockMovementService';
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { useCurrencyField } from "@shared/hooks/useCurrencyField";
import { CurrencyField } from "@shared/ui/CurrencyField";

interface AdjustmentFormProps {
  onClose: () => void;
  products: MaterialDto[];
  onSave: (payload: CreateStockAdjustmentRequest) => Promise<void>;
  saving: boolean;
  initialValues?: StockAdjustment | null;
  initialMaterialId?: string;
}

export function AdjustmentForm({ onClose, products, onSave, saving, initialValues, initialMaterialId }: AdjustmentFormProps) {
  const isEditMode = !!initialValues;

  const currencyField = useCurrencyField({
    initialCurrency: initialValues?.currency_code || undefined,
    initialFxRate: initialValues?.fx_rate || undefined,
    disableAutoFx: isEditMode,
  });

  const [form, setForm] = useState<Partial<CreateStockAdjustmentRequest>>({
    adjustment_date: new Date().toISOString(),
    actual_quantity: 0,
    material_id: "",
    unit_cost: 0,
  });
  const [systemQuantity, setSystemQuantity] = useState<number>(0);
  const [unitCostPerUnit, setUnitCostPerUnit] = useState<number>(0);
  const [, setLoadingBalance] = useState(false);

  const formRef = useRef(form);
  formRef.current = form;
  const baseCostRef = useRef(0);
  const materialCurrencyRef = useRef("");

  const { currencies, baseCurrencyCode, getDefaultCurrency, setCurrency: setCurrencyFn, convertBetween } = currencyField;

  const fetchBalance = useCallback(async (materialId: string, actualQuantity?: number) => {
    setLoadingBalance(true);
    try {
      const balance = await stockMovementService.getStockBalance(materialId);
      const balNum = parseFloat(balance);
      setSystemQuantity(balNum);
      const mat = products.find(p => p.id === materialId);
      const unitCost = mat ? parseFloat(mat.last_purchase_price || "0") : 0;
      setUnitCostPerUnit(unitCost);
      const matCurrency = mat?.default_purchase_currency || baseCurrencyCode;
      materialCurrencyRef.current = matCurrency;
      const preferred = mat?.default_purchase_currency;
      const preferredActive = preferred && currencies.some(c => c.is_active && c.code === preferred);
      setCurrencyFn(preferredActive ? preferred : baseCurrencyCode || getDefaultCurrency());
      const actual = actualQuantity ?? formRef.current.actual_quantity ?? 0;
      const diff = Math.abs(balNum - actual);
      const baseCost = diff * unitCost;
      baseCostRef.current = baseCost;
      const converted = currencyField.currency === matCurrency
        ? baseCost
        : convertBetween(baseCost, matCurrency, currencyField.currency);
      setForm(p => ({ ...p, unit_cost: converted }));
    } catch {
      toast.error("فشل تحميل رصيد المخزون");
    } finally {
      setLoadingBalance(false);
    }
  }, [products, currencies, baseCurrencyCode, getDefaultCurrency, setCurrencyFn, convertBetween, currencyField.currency]);

  const fetchBalanceRef = useRef(fetchBalance);
  fetchBalanceRef.current = fetchBalance;

  useEffect(() => {
    if (initialValues) {
      const sys = parseFloat(initialValues.system_quantity || "0");
      setSystemQuantity(sys);
      const perUnit = parseFloat(initialValues.unit_cost || "0");
      setUnitCostPerUnit(perUnit);
      const savedCurrency = initialValues.currency_code || currencyField.baseCurrencyCode;
      const savedFxRate = parseFloat(initialValues.fx_rate || "1");
      currencyField.setCurrency(savedCurrency);
      currencyField.setFxRate(initialValues.fx_rate || "1");
      const totalCost = parseFloat(initialValues.total_cost || "0");
      const baseCost = totalCost * savedFxRate;
      baseCostRef.current = baseCost;
      materialCurrencyRef.current = savedCurrency;
      setForm({
        material_id: initialValues.material_id,
        actual_quantity: parseFloat(initialValues.actual_quantity),
        unit_cost: totalCost,
        notes: initialValues.notes || initialValues.reason || "",
        adjustment_date: initialValues.adjustment_date,
      });
    } else {
      setForm({
        adjustment_date: new Date().toISOString(),
        actual_quantity: 0,
        material_id: initialMaterialId || "",
        unit_cost: 0,
      });
      setSystemQuantity(0);
      setUnitCostPerUnit(0);
      currencyField.setCurrency(currencyField.getDefaultCurrency());
      currencyField.setFxRate("1");
      if (initialMaterialId) {
        fetchBalanceRef.current(initialMaterialId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, initialMaterialId]);

  // Reconvert cost when currency changes
  useEffect(() => {
    if (materialCurrencyRef.current && baseCostRef.current > 0) {
      const converted = currencyField.currency === materialCurrencyRef.current
        ? baseCostRef.current
        : convertBetween(baseCostRef.current, materialCurrencyRef.current, currencyField.currency);
      setForm(p => ({ ...p, unit_cost: converted }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyField.currency]);

  const handleMaterialChange = async (val: string) => {
    setForm(p => ({ ...p, material_id: val }));
    if (val) {
      await fetchBalance(val);
    }
  };

  const handleActualQuantityChange = (val: number) => {
    const actual = isNaN(val) ? 0 : val;
    setForm(p => ({ ...p, actual_quantity: actual }));
    const diff = Math.abs(systemQuantity - actual);
    const baseCost = diff * unitCostPerUnit;
    baseCostRef.current = baseCost;
    const converted = materialCurrencyRef.current && materialCurrencyRef.current !== currencyField.currency
      ? convertBetween(baseCost, materialCurrencyRef.current, currencyField.currency)
      : baseCost;
    setForm(p => ({ ...p, unit_cost: converted }));
  };

  const handleSave = async () => {
    if (!form.material_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    const payload: CreateStockAdjustmentRequest = {
      material_id: form.material_id,
      actual_quantity: form.actual_quantity,
      unit_cost: form.unit_cost ?? 0,
      currency_code: currencyField.currency || undefined,
      fx_rate: parseFloat(currencyField.fxRate) || 1,
      reason: form.notes || undefined,
      notes: form.notes || undefined,
      adjustment_date: form.adjustment_date,
    };
    await onSave(payload);
  };

  return (
    <FormPanel
      title={isEditMode ? "تعديل تسوية جرد" : "تسوية جرد جديدة"}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={saving || !form.material_id || form.actual_quantity === undefined || form.actual_quantity === null}
      saveLabel={isEditMode ? "حفظ التعديل" : "تسوية"}
    >
      <SidebarSection title="بيانات التسوية" defaultOpen={true}>
        <div className="space-y-4 text-right">
          <div className="space-y-2">
            <FieldLabel required>المادة</FieldLabel>
            <Select value={form.material_id ?? ""} onValueChange={handleMaterialChange}>
              <SelectTrigger className="w-full bg-white border-slate-200"><SelectValue placeholder="اختر المادة..." /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.material_id && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <Calculator className="w-3.5 h-3.5 text-slate-400" />
              <span>رصيد النظام: <strong className="text-slate-800">{systemQuantity.toFixed(2)}</strong></span>
              <span className="text-slate-300">|</span>
              <span>تكلفة الوحدة: <strong className="text-slate-800">{unitCostPerUnit.toFixed(2)} {currencyField.symbol}</strong></span>
            </div>
          )}
          <div className="space-y-2">
            <FieldLabel required>الكمية المجرودة</FieldLabel>
            <Input type="number" min="0" step="1"
              value={form.actual_quantity ?? ""}
              onChange={e => handleActualQuantityChange(parseFloat(e.target.value))}
              className="bg-white border-slate-200 h-9 text-xs tabular-nums"
              placeholder="أدخل الكمية..." />
          </div>
          <CurrencyField
            label="التكلفة (محسوبة تلقائياً)"
            currency={currencyField.currency}
            onCurrencyChange={currencyField.setCurrency}
            amount={form.unit_cost ?? ""}
            onAmountChange={(val) => setForm(p => ({ ...p, unit_cost: parseFloat(val) || 0 }))}
            symbol={currencyField.symbol}
            showCurrency={currencyField.hasMultipleCurrencies}
            currencies={currencyField.currencies}
          />
          <div className="space-y-2">
            <FieldLabel>تاريخ التسوية</FieldLabel>
            <Input type="date"
              value={form.adjustment_date?.slice(0, 10) ?? ""}
              onChange={e => setForm(p => ({ ...p, adjustment_date: new Date(e.target.value).toISOString() }))}
              className="bg-white border-slate-200" />
          </div>
          <div className="space-y-2">
            <FieldLabel>ملاحظة</FieldLabel>
            <Textarea value={form.notes ?? ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-white border-slate-200 min-h-[60px]" placeholder="سبب التسوية..." />
          </div>
        </div>
      </SidebarSection>
    </FormPanel>
  );
}
