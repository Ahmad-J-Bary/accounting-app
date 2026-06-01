import { useState, useEffect, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Plus, X, Undo2 } from "lucide-react";
import type { MaterialDto, MaterialUnitDto, CustomerDto, SupplierDto, InvoiceDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toast } from "sonner";

export type ReturnLineForm = {
  material_id: string;
  quantity: string;
  unit_price: string;
  unit_id: string;
  notes: string;
  line_total: string;
};

export type ReturnsFormState = {
  customer_id: string;
  supplier_id: string;
  return_date: string;
  notes: string;
  purchase_invoice_id: string;
  lines: ReturnLineForm[];
};

interface ReturnsFormProps {
  type: "sales" | "purchase";
  onClose: () => void;
  onSave: (lines: ReturnLineForm[]) => Promise<void>;
  saving: boolean;
  customers?: CustomerDto[];
  suppliers?: SupplierDto[];
  invoices?: InvoiceDto[];
  materials: MaterialDto[];
  form: ReturnsFormState;
  setForm: React.Dispatch<React.SetStateAction<ReturnsFormState>>;
}

export function ReturnsForm({
  type, onClose, onSave, saving, customers, suppliers, invoices, materials, form, setForm,
}: ReturnsFormProps) {
  const isSales = type === "sales";
  const icon = <Undo2 className={`w-5 h-5 ${isSales ? "text-blue-600" : "text-amber-600"}`} />;
  const safeLines = Array.isArray(form.lines) ? form.lines : [];
  const safeMaterials = useMemo(() => Array.isArray(materials) ? materials : [], [materials]);

  const { currencies, baseCurrency, rateMap } = useCurrencyContext();
  const [displayCurrency, setDisplayCurrency] = useState("");

  useEffect(() => {
    if (!displayCurrency && baseCurrency?.code) {
      setDisplayCurrency(baseCurrency.code);
    }
  }, [baseCurrency, displayCurrency]);

  const currencyRate = useMemo(() => {
    if (!displayCurrency || !baseCurrency || displayCurrency === baseCurrency.code) return 1;
    return rateMap.get(displayCurrency) || 1;
  }, [displayCurrency, baseCurrency, rateMap]);

  const filteredInvoices = useMemo(() => {
    if (!invoices || !form.supplier_id) return [];
    return invoices.filter(inv => inv.supplier_id === form.supplier_id && inv.status === "Posted");
  }, [invoices, form.supplier_id]);

  const selectedPurchaseInvoice = useMemo(() => {
    if (isSales || !form.purchase_invoice_id) return null;
    return filteredInvoices.find(inv => inv.id === form.purchase_invoice_id) || null;
  }, [filteredInvoices, form.purchase_invoice_id, isSales]);

  const formatMoney = (value: number) => value.toFixed(4);

  const getInvoiceBasePrice = (invoiceLine: InvoiceDto["lines"][number]) => {
    if (invoiceLine.unit_price_v2?.base_amount) {
      return parseFloat(invoiceLine.unit_price_v2.base_amount) || 0;
    }
    const rate = parseFloat(selectedPurchaseInvoice?.exchange_rate || "1") || 1;
    const docPrice = parseFloat(invoiceLine.unit_price || "0") || 0;
    return rate > 0 ? docPrice / rate : docPrice;
  };

  const getInvoiceLineForMaterial = (materialId: string, unitId?: string) => {
    if (!selectedPurchaseInvoice?.lines?.length) return null;
    const candidates = selectedPurchaseInvoice.lines.filter(l => l.material_id === materialId);
    if (!candidates.length) return null;
    if (unitId) {
      const exact = candidates.find(l => (l.unit_id || "") === unitId);
      if (exact) return exact;
    }
    return candidates[0];
  };

  const purchaseInvoiceMaterials = useMemo(() => {
    if (!selectedPurchaseInvoice?.lines?.length) return safeMaterials;
    const materialIds = new Set(selectedPurchaseInvoice.lines.map(l => l.material_id).filter(Boolean));
    return safeMaterials.filter(m => materialIds.has(m.id));
  }, [safeMaterials, selectedPurchaseInvoice]);

  const validatePurchaseLines = (lines: ReturnLineForm[]) => {
    const requestedBaseByMaterial = new Map<string, number>();
    const requestedInvoiceQtyByKey = new Map<string, number>();
    const invoiceQtyByKey = new Map<string, number>();

    if (selectedPurchaseInvoice?.lines?.length) {
      selectedPurchaseInvoice.lines.forEach(line => {
        const key = `${line.material_id}::${line.unit_id || ""}`;
        invoiceQtyByKey.set(key, (invoiceQtyByKey.get(key) || 0) + (parseFloat(line.quantity || "0") || 0));
      });
    }

    for (const line of lines) {
      const material = safeMaterials.find(m => m.id === line.material_id);
      if (!material) return "تعذر التحقق من المادة المحددة.";

      const unit = material.units.find(u => u.id === line.unit_id) || material.units.find(u => u.is_base);
      const factor = parseFloat(unit?.conversion_factor || "1") || 1;
      const qty = parseFloat(line.quantity || "0") || 0;
      const effectiveQty = qty * factor;
      const available = parseFloat(material.total_available || "0") || 0;
      const materialRequested = (requestedBaseByMaterial.get(material.id) || 0) + effectiveQty;
      requestedBaseByMaterial.set(material.id, materialRequested);

      if (materialRequested - available > 0.0001) {
        return `كمية المرتجع للمادة ${material.name} تتجاوز المتوفر في المخزون.`;
      }

      if (selectedPurchaseInvoice) {
        const key = `${line.material_id}::${line.unit_id || ""}`;
        const requestedQty = (requestedInvoiceQtyByKey.get(key) || 0) + qty;
        requestedInvoiceQtyByKey.set(key, requestedQty);
        const invoiceQty = invoiceQtyByKey.get(key) || 0;
        if (requestedQty - invoiceQty > 0.0001) {
          return `كمية المرتجع للمادة ${material.name} تتجاوز الكمية الموجودة في الفاتورة المحددة.`;
        }
      }
    }

    return null;
  };

  const handleCurrencyChange = (newCode: string) => {
    if (!baseCurrency || newCode === displayCurrency) return;
    const oldRate = displayCurrency === baseCurrency.code ? 1 : (rateMap.get(displayCurrency) || 1);
    const newRate = newCode === baseCurrency.code ? 1 : (rateMap.get(newCode) || 1);
    if (oldRate === newRate) { setDisplayCurrency(newCode); return; }
    const factor = newRate / oldRate;
    setForm(f => ({
      ...f,
      lines: f.lines.map(l => ({
        ...l,
        unit_price: formatMoney(parseFloat(l.unit_price || "0") * factor),
        line_total: formatMoney(parseFloat(l.line_total || "0") * factor),
      })),
    }));
    setDisplayCurrency(newCode);
  };

  const toBase = (value: string): string => {
    if (currencyRate === 1) return value;
    return (parseFloat(value || "0") / currencyRate).toFixed(4);
  };

  const handleAddLine = () => {
    setForm(f => ({
      ...f,
      lines: [...(Array.isArray(f.lines) ? f.lines : []), { material_id: "", quantity: "1", unit_price: "0", unit_id: "", notes: "", line_total: "0" }],
    }));
  };

  const handleLineChange = (idx: number, field: keyof ReturnLineForm, value: string) => {
    setForm(f => {
      const lines = (Array.isArray(f.lines) ? f.lines : []).map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, [field]: value };

        if (field === "material_id") {
          const mat = safeMaterials.find(m => m.id === value);
          if (mat) {
            const invoiceLine = !isSales ? getInvoiceLineForMaterial(value) : null;
            const allowedUnits = invoiceLine
              ? mat.units.filter(u => !invoiceLine.unit_id || u.id === invoiceLine.unit_id)
              : mat.units;
            const baseUnit = allowedUnits.find(u => u.is_base) || allowedUnits[0] || mat.units.find(u => u.is_base);
            updated.unit_id = invoiceLine?.unit_id || baseUnit?.id || "";
            const basePrice = invoiceLine
              ? getInvoiceBasePrice(invoiceLine)
              : (
                isSales
                  ? (parseFloat(mat.last_sale_price_base || mat.last_sale_price || "0") || 0)
                  : (parseFloat(mat.last_purchase_price_base || mat.last_purchase_price || "0") || 0)
              );
            updated.unit_price = formatMoney(basePrice * currencyRate);
            const q = parseFloat(updated.quantity) || 1;
            const p = parseFloat(updated.unit_price) || 0;
            updated.line_total = formatMoney(q * p);
          }
        }

        if (field === "unit_id" && line.material_id) {
          const mat = safeMaterials.find(m => m.id === line.material_id);
          if (mat) {
            const unit = mat.units.find(u => u.id === value);
            if (unit) {
              let unitPrice = "0";
              if (!isSales && selectedPurchaseInvoice) {
                const invoiceLine = getInvoiceLineForMaterial(line.material_id, value);
                unitPrice = formatMoney(invoiceLine ? getInvoiceBasePrice(invoiceLine) : 0);
              } else if (isSales) {
                const sp = mat.sale_prices?.find(p => p.unit_id === value);
                if (sp?.price_base || sp?.price) {
                  unitPrice = sp.price_base || sp.price;
                } else {
                  const factor = parseFloat(unit.conversion_factor) || 1;
                  const basePrice = parseFloat(mat.last_sale_price_base || mat.last_sale_price || "0") || 0;
                  unitPrice = formatMoney(basePrice * factor);
                }
              } else {
                const pp = mat.purchase_prices?.find(p => p.unit_id === value);
                if (pp?.price_base || pp?.price) {
                  unitPrice = pp.price_base || pp.price;
                } else {
                  const factor = parseFloat(unit.conversion_factor) || 1;
                  const basePrice = parseFloat(mat.last_purchase_price_base || mat.last_purchase_price || "0") || 0;
                  unitPrice = formatMoney(basePrice * factor);
                }
              }
              updated.unit_price = formatMoney(parseFloat(unitPrice) * currencyRate);
              const q = parseFloat(updated.quantity) || 1;
              const p = parseFloat(updated.unit_price) || 0;
              updated.line_total = formatMoney(q * p);
            }
          }
        }

        if (field === "quantity") {
          const mat = safeMaterials.find(m => m.id === line.material_id);
          if (mat) {
            const unit = mat.units.find(u => u.id === line.unit_id) || mat.units.find(u => u.is_base);
            const factor = parseFloat(unit?.conversion_factor || "1") || 1;
            const effectiveQty = (parseFloat(value) || 0) * factor;
            const available = parseFloat(mat.total_available || "0") || 0;
            if (effectiveQty > available) {
              toast.error(`كمية المرتجع للمادة ${mat.name} تتجاوز المتوفر في المخزون (${available.toFixed(2)} وحدة أساسية)`);
            }
          }
          const q = parseFloat(value) || 0;
          const p = parseFloat(updated.unit_price) || 0;
          updated.line_total = formatMoney(q * p);
        }

        if (field === "unit_price") {
          const p = parseFloat(value) || 0;
          const q = parseFloat(updated.quantity) || 0;
          updated.line_total = formatMoney(q * p);
        }

        if (field === "line_total") {
          const total = parseFloat(value) || 0;
          const q = parseFloat(updated.quantity) || 1;
          updated.unit_price = total > 0 ? formatMoney(total / q) : "0";
        }

        return updated;
      });
      return { ...f, lines };
    });
  };

  const handleRemoveLine = (idx: number) => {
    if (safeLines.length <= 1) return;
    setForm(f => ({ ...f, lines: (Array.isArray(f.lines) ? f.lines : []).filter((_, i) => i !== idx) }));
  };

  const handleSelectInvoice = (invoiceId: string) => {
    if (!invoiceId) return;
    const invoice = filteredInvoices.find(inv => inv.id === invoiceId);
    if (!invoice || !invoice.lines) return;
    const newLines = invoice.lines
      .filter(l => l.material_id)
      .map(l => {
        const basePrice = l.unit_price_v2?.base_amount
          ? (parseFloat(l.unit_price_v2.base_amount) || 0)
          : ((parseFloat(l.unit_price || "0") || 0) / (parseFloat(invoice.exchange_rate || "1") || 1));
        const qty = parseFloat(l.quantity) || 0;
        return {
          material_id: l.material_id,
          quantity: formatMoney(qty),
          unit_price: formatMoney(basePrice * currencyRate),
          unit_id: l.unit_id || "",
          notes: "",
          line_total: formatMoney(qty * basePrice * currencyRate),
        };
      });
    if (newLines.length > 0) {
      setForm(f => ({ ...f, purchase_invoice_id: invoiceId, lines: newLines }));
    }
  };

  const getMaterialUnits = (materialId: string): MaterialUnitDto[] => {
    if (!materialId) return [];
    const material = safeMaterials.find(m => m.id === materialId);
    if (!material) return [];
    if (!selectedPurchaseInvoice) return material.units ?? [];

    const allowedUnitIds = new Set(
      selectedPurchaseInvoice.lines
        .filter(l => l.material_id === materialId)
        .map(l => l.unit_id)
        .filter((unitId): unitId is string => !!unitId)
    );

    if (!allowedUnitIds.size) return material.units ?? [];
    return material.units.filter(u => allowedUnitIds.has(u.id));
  };

  const isSaveDisabled = saving
    || (isSales ? !form.customer_id : !form.supplier_id)
    || safeLines.length === 0
    || safeLines.some(l => !l.material_id);

  const currencyOptions = useMemo(() => {
    if (!currencies.length) return null;
    return currencies.map(c => (
      <SelectItem key={c.code} value={c.code} className="text-[11px]">
        {c.symbol || c.code}
      </SelectItem>
    ));
  }, [currencies]);

  const CurrencySelect = () => (
    <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
      <SelectTrigger className="w-14 h-9 bg-white border-slate-200 px-1 text-[10px] font-bold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{currencyOptions}</SelectContent>
    </Select>
  );

  return (
    <FormPanel
      title={isSales ? "مرتجع مبيعات جديد" : "مرتجع مشتريات جديد"}
      icon={icon}
      onClose={onClose}
      onSave={() => {
        const lines = currencyRate !== 1
          ? form.lines.map(l => ({ ...l, unit_price: (parseFloat(l.unit_price || "0") / currencyRate).toFixed(2), line_total: (parseFloat(l.line_total || "0") / currencyRate).toFixed(2) }))
          : form.lines;
        if (!isSales) {
          const validationError = validatePurchaseLines(lines);
          if (validationError) { toast.error(validationError); return; }
        }
        onSave(lines);
      }}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="حفظ المرتجع"
    >
      <SidebarSection title="بيانات المرتجع" defaultOpen={true}>
        <div className="space-y-4 text-right">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <FieldLabel required>{isSales ? "العميل" : "المورد"}</FieldLabel>
              <Select
                value={isSales ? form.customer_id : form.supplier_id}
                onValueChange={(val) => setForm(f => ({
                  ...f,
                  [isSales ? "customer_id" : "supplier_id"]: val,
                }))}
              >
                <SelectTrigger className="w-full bg-white border-slate-200">
                  <SelectValue placeholder={isSales ? "اختر العميل..." : "اختر المورد..."} />
                </SelectTrigger>
                <SelectContent>
                  {(isSales ? customers : suppliers)?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <FieldLabel>التاريخ</FieldLabel>
              <Input
                type="date"
                value={form.return_date}
                onChange={(e) => setForm(f => ({ ...f, return_date: e.target.value }))}
                className="bg-white border-slate-200"
              />
            </div>
          </div>

          {!isSales && filteredInvoices.length > 0 && (
            <div className="space-y-1.5">
              <FieldLabel>اختيار من فاتورة مشتريات</FieldLabel>
              <Select value="" onValueChange={handleSelectInvoice}>
                <SelectTrigger className="w-full bg-white border-amber-200 text-amber-700">
                  <SelectValue placeholder="اختر فاتورة لتعبئة الأسعار تلقائياً..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id} className="text-xs">
                      {inv.invoice_number} — {inv.supplier_name || "مورد"} ({new Date(inv.issued_at).toLocaleDateString("ar-SA")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-amber-600 font-medium">سيتم تعبئة المواد والأسعار من الفاتورة المحددة</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">المواد</span>
              <Button size="sm" variant="outline" onClick={handleAddLine} className="text-xs h-7">
                <Plus className="w-3 h-3 ml-1" /> إضافة مادة
              </Button>
            </div>

            {safeLines.map((line, idx) => {
              const units = getMaterialUnits(line.material_id);
              return (
                <div key={idx} className="border rounded-lg p-3 space-y-3 bg-slate-50">
                  <div className="flex justify-between items-center">
                    {safeLines.length > 1 ? (
                      <Button size="sm" variant="ghost" className="text-rose-500 h-6 px-2 text-xs" onClick={() => handleRemoveLine(idx)}>
                        <X className="w-3 h-3 ml-1" /> حذف
                      </Button>
                    ) : <div />}
                    <span className="text-xs text-slate-400">مادة {idx + 1}</span>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel required>المادة</FieldLabel>
                    <Select
                      value={line.material_id}
                      onValueChange={(val) => handleLineChange(idx, "material_id", val)}
                    >
                      <SelectTrigger className="w-full bg-white border-slate-200">
                        <SelectValue placeholder="اختر المادة..." />
                      </SelectTrigger>
                      <SelectContent>
                        {safeMaterials.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <FieldLabel>الكمية</FieldLabel>
                      <Input
                        type="number" min="0" step="1"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>الوحدة</FieldLabel>
                      <Select
                        value={line.unit_id}
                        onValueChange={(val) => handleLineChange(idx, "unit_id", val)}
                        disabled={!line.material_id}
                      >
                        <SelectTrigger className="w-full bg-white border-slate-200">
                          <SelectValue placeholder={line.material_id ? "اختر..." : "اختر مادة أولاً"} />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}{u.is_base ? " (أساسية)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1.5 items-end">
                    <div className="space-y-1">
                      <FieldLabel>السعر الفردي</FieldLabel>
                      <Input
                        type="number" min="0" step="0.01"
                        value={line.unit_price}
                        onChange={(e) => handleLineChange(idx, "unit_price", e.target.value)}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <div className="pb-1.5">
                      <CurrencySelect />
                    </div>
                    <div className="space-y-1">
                      <FieldLabel>المجموع</FieldLabel>
                      <Input
                        type="number" min="0" step="0.01"
                        value={line.line_total}
                        onChange={(e) => handleLineChange(idx, "line_total", e.target.value)}
                        className="bg-white border-slate-200 font-bold"
                      />
                    </div>
                    <div className="pb-1.5">
                      <CurrencySelect />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <FieldLabel>ملاحظة</FieldLabel>
                    <Input
                      value={line.notes}
                      onChange={(e) => handleLineChange(idx, "notes", e.target.value)}
                      placeholder="..."
                      className="bg-white border-slate-200"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <FieldLabel>ملاحظات عامة</FieldLabel>
            <Input
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="ملاحظات..."
              className="bg-white border-slate-200"
            />
          </div>

        </div>
      </SidebarSection>
    </FormPanel>
  );
}
