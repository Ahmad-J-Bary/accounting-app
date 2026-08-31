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
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";

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
  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const hasSecondaryCurrencies = currencies.length > 1;
  const [form, setForm] = useState<Partial<CreateStockAdjustmentRequest>>({
    adjustment_date: new Date().toISOString(),
    actual_quantity: 0,
    material_id: "",
    unit_cost: 0,
  });
  const [systemQuantity, setSystemQuantity] = useState<number>(0);
  const [unitCostPerUnit, setUnitCostPerUnit] = useState<number>(0);
  const [, setLoadingBalance] = useState(false);
  const [currency, setCurrency] = useState<string>("");
  const [fxRate, setFxRate] = useState<string>("1");
  const currencySymbol = currencies.find(c => c.code === currency)?.symbol ?? "";

  const formRef = useRef(form);
  formRef.current = form;

  const fetchBalance = useCallback(async (materialId: string, actualQuantity?: number) => {
    setLoadingBalance(true);
    try {
      const balance = await stockMovementService.getStockBalance(materialId);
      const balNum = parseFloat(balance);
      setSystemQuantity(balNum);
      const mat = products.find(p => p.id === materialId);
      const unitCost = mat ? parseFloat(mat.last_purchase_price || "0") : 0;
      setUnitCostPerUnit(unitCost);
      const baseCode = baseCurrency?.code ?? "";
      const preferred = mat?.default_purchase_currency;
      const preferredActive = preferred && currencies.some(c => c.is_active && c.code === preferred);
      setCurrency(preferredActive ? preferred : baseCode || (currencies[0]?.code ?? ""));
      const actual = actualQuantity ?? formRef.current.actual_quantity ?? 0;
      const diff = Math.abs(balNum - actual);
      setForm(p => ({ ...p, unit_cost: diff * unitCost }));
    } catch {
      toast.error("فشل تحميل رصيد المخزون");
    } finally {
      setLoadingBalance(false);
    }
  }, [products, currencies, baseCurrency]);

  useEffect(() => {
    if (initialValues) {
      const sys = parseFloat(initialValues.system_quantity || "0");
      setSystemQuantity(sys);
      const perUnit = parseFloat(initialValues.unit_cost || "0");
      setUnitCostPerUnit(perUnit);
      setCurrency(initialValues.currency_code || baseCurrency?.code || "");
      setFxRate(initialValues.fx_rate || "1");
      setForm({
        material_id: initialValues.material_id,
        actual_quantity: parseFloat(initialValues.actual_quantity),
        unit_cost: parseFloat(initialValues.total_cost || "0"),
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
      setCurrency(baseCurrency?.code ?? "");
      setFxRate("1");
      if (initialMaterialId) {
        fetchBalance(initialMaterialId);
      }
    }
  }, [initialValues, initialMaterialId, fetchBalance, baseCurrency]);

  // Auto-fill exchange rate when the selected currency changes.
  useEffect(() => {
    if (currency) {
      const rate = getExchangeRate(currency, rateMap, baseCurrency?.code);
      setFxRate(String(rate));
    }
  }, [currency, rateMap, baseCurrency]);

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
    setForm(p => ({ ...p, unit_cost: diff * unitCostPerUnit }));
  };

  const handleSave = async () => {
    if (!form.material_id || form.actual_quantity === undefined || !form.adjustment_date) return;
    const payload: CreateStockAdjustmentRequest = {
      material_id: form.material_id,
      actual_quantity: form.actual_quantity,
      unit_cost: form.unit_cost ?? 0,
      currency_code: currency || undefined,
      fx_rate: parseFloat(fxRate) || 1,
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
              <span>تكلفة الوحدة: <strong className="text-slate-800">{unitCostPerUnit.toFixed(2)} {currencySymbol}</strong></span>
            </div>
          )}
          <div className="space-y-2">
            <FieldLabel required>الكمية المجرودة</FieldLabel>
            <Input type="number" min="0" step="1"
              value={form.actual_quantity ?? ""}
              onChange={e => handleActualQuantityChange(parseFloat(e.target.value))}
              className="bg-white border-slate-200"
              placeholder="أدخل الكمية..." />
          </div>
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
              <FieldLabel>التكلفة (محسوبة تلقائياً)</FieldLabel>
              <div className="relative">
                <Input type="number" min="0" step="0.01"
                  value={form.unit_cost ?? ""}
                  onChange={e => setForm(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))}
                  className="bg-white border-slate-200 pl-10"
                  placeholder="0" />
                {currencySymbol && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{currencySymbol}</span>
                )}
              </div>
            </div>
          </div>
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
