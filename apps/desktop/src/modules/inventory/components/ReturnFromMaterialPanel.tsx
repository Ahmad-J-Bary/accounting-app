import { useState, useEffect, useMemo, useCallback } from "react";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Button } from "@shared/ui/button";
import { Undo2, X, ShoppingBag, ShoppingCart, Search, Plus, Building2, Calendar, FileText, Package, CheckCircle2, Ruler } from "lucide-react";
import type { CustomerDto, SupplierDto, InvoiceDto, InvoiceLineDto, SalesReturnLineDto, PurchaseReturnLineDto, SalesReturnDto, PurchaseReturnDto, MaterialDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toast } from "sonner";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";
import { materialService } from "@modules/inventory/api/materialService";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@shared/lib/utils";

// ── Helpers ──

const getPartyId = (inv: InvoiceDto, isSales: boolean): string =>
  isSales ? (inv as InvoiceDto).customer_id ?? "" : (inv as InvoiceDto).supplier_id ?? "";

const getReturnPartyId = (ret: SalesReturnDto | PurchaseReturnDto, isSales: boolean): string =>
  isSales ? (ret as SalesReturnDto).customer_id : (ret as PurchaseReturnDto).supplier_id;

const parseConv = (v?: string): number => Math.max(0.001, parseFloat(v || "1") || 1);

const parseNum = (v?: string): number => parseFloat(v || "0") || 0;

// ── Interfaces ──

interface InvoiceLineInstance {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  line: InvoiceLineDto;
  unitId: string;
  unitName: string;
  conversionFactor: string;
  availableQty: number;
}

interface SelectedReturnLine {
  key: string;
  occKey: string;
  materialId: string;
  materialName: string;
  invoiceLineId: string;
  invoiceNumber: string;
  invoiceDate: string;
  originalQuantity: string;       // Remaining quantity in selected unit (clamped)
  originalQuantityRaw: string;    // Remaining quantity in original invoice unit
  originalConversionFactor: string;// Original conversion factor
  originalQuantityBase: string;   // Remaining quantity in base units
  originalPrice: string;          // Price in selected unit
  originalPriceBase: string;      // Unit price in base unit
  unitId: string;
  unitName: string;
  conversionFactor: string;
  returnQuantity: string;
  returnPrice: string;
  notes: string;
}

interface ReturnFormState {
  returnType: "purchase" | "sales";
  partyId: string;
  returnDate: string;
  generalNotes: string;
}

interface ReturnFromMaterialPanelProps {
  open?: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialReturnType?: "purchase" | "sales";
  initialPartyId?: string;
  initialMaterialId?: string;
  materials?: MaterialDto[];
}

const getInitialFormState = (type?: "purchase" | "sales", party?: string): ReturnFormState => ({
  returnType: type || "purchase",
  partyId: party || "",
  returnDate: new Date().toISOString().slice(0, 10),
  generalNotes: "",
});

// Derive unit info from invoice line + optional material lookup
function deriveUnitInfo(line: InvoiceLineDto, materials?: MaterialDto[]) {
  let unitId = line.unit_id || "";
  let unitName = line.unit_name || "";
  let convFactor = line.conversion_factor || "";

  if (materials?.length) {
    const mat = materials.find(m => m.id === line.material_id);
    if (mat) {
      const invUnit = unitId ? mat.units.find(u => u.id === unitId) : undefined;
      unitId = unitId || invUnit?.id || "";
      unitName = unitName || invUnit?.name || mat.units.find(u => u.is_base)?.name || "";
      convFactor = convFactor || invUnit?.conversion_factor || mat.units.find(u => u.is_base)?.conversion_factor || "1";
    }
  }
  return { unitId, unitName, conversionFactor: convFactor || "1" };
}

// ── Component ──

export function ReturnFromMaterialPanel({
  open = true,
  onClose,
  onSaved,
  initialReturnType,
  initialPartyId,
  initialMaterialId,
  materials: materialsProp
}: ReturnFromMaterialPanelProps) {
  const [form, setForm] = useState<ReturnFormState>(() => getInitialFormState(initialReturnType, initialPartyId));

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [prevReturns, setPrevReturns] = useState<(SalesReturnDto | PurchaseReturnDto)[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLines, setSelectedLines] = useState<SelectedReturnLine[]>([]);
  const [saving, setSaving] = useState(false);

  const isSales = form.returnType === "sales";

  // Fetch materials internally if not passed via props
  const { data: fetchedMaterials = [] } = useQuery<MaterialDto[]>({
    queryKey: ["materials"],
    queryFn: () => materialService.listMaterials(),
    enabled: !materialsProp || materialsProp.length === 0,
  });

  const allMaterials = useMemo(() => {
    return materialsProp && materialsProp.length > 0 ? materialsProp : fetchedMaterials;
  }, [materialsProp, fetchedMaterials]);

  // Reset
  const resetAll = useCallback(() => {
    setForm(getInitialFormState(initialReturnType, initialPartyId));
    setInvoices([]);
    setPrevReturns([]);
    setSelectedLines([]);
    setSearchQuery("");
  }, [initialReturnType, initialPartyId]);

  useEffect(() => { if (open) resetAll(); }, [open, resetAll]);

  // Load parties
  useEffect(() => {
    setLoadingParties(true);
    Promise.all([customerService.listCustomers(), supplierService.listSuppliers()])
      .then(([custs, supps]) => { setCustomers(custs); setSuppliers(supps); })
      .catch(() => toast.error("فشل تحميل العملاء والموردين"))
      .finally(() => setLoadingParties(false));
  }, []);

  // Load invoices & returns
  useEffect(() => {
    if (!form.partyId) { setInvoices([]); setPrevReturns([]); return; }
    setLoadingInvoices(true);
    Promise.all([
      invoiceService.listInvoicesByType(isSales ? "Sales" : "Purchase"),
      isSales ? returnService.listSalesReturns() : returnService.listPurchaseReturns(),
    ]).then(([allInvoices, allReturns]) => {
      setInvoices(allInvoices.filter(inv => getPartyId(inv, isSales) === form.partyId));
      setPrevReturns(
        (allReturns as Array<SalesReturnDto | PurchaseReturnDto>)
          .filter(r => getReturnPartyId(r, isSales) === form.partyId)
      );
    })
      .catch(() => toast.error("فشل تحميل البيانات"))
      .finally(() => setLoadingInvoices(false));
  }, [form.partyId, isSales]);

  // Returned quantities map (in base units, matching ReturnsEditor)
  const returnedQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ret of prevReturns) {
      for (const line of (ret.lines || [])) {
        const lid = line.invoice_line_id;
        if (lid) {
          let conv = 1;
          if (allMaterials?.length) {
            const mat = allMaterials.find(m => m.id === line.material_id);
            const unit = mat?.units.find(u => u.id === line.unit_id);
            conv = unit ? parseConv(unit.conversion_factor) : 1;
          }
          map.set(lid, (map.get(lid) || 0) + parseNum(line.quantity) * conv);
        }
      }
    }
    return map;
  }, [prevReturns, allMaterials]);

  // Session returned quantities (from selectedLines in this session)
  const sessionReturnedMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of selectedLines) {
      const lid = line.invoiceLineId;
      if (lid) {
        const conv = parseConv(line.conversionFactor);
        map.set(lid, (map.get(lid) || 0) + parseNum(line.returnQuantity) * conv);
      }
    }
    return map;
  }, [selectedLines]);

  // Combined returned quantities (historical returns + current session)
  const combinedReturnedMap = useMemo(() => {
    const map = new Map(returnedQtyMap);
    for (const [lid, baseQty] of sessionReturnedMap) {
      map.set(lid, (map.get(lid) || 0) + baseQty);
    }
    return map;
  }, [returnedQtyMap, sessionReturnedMap]);

  // Invoice lines grouped by material (unit-aware)
  const invoiceLinesByMaterial = useMemo(() => {
    const map = new Map<string, InvoiceLineInstance[]>();
    if (!invoices.length) return map;
    for (const inv of invoices) {
      for (const line of (inv.lines || [])) {
        if (!line.material_id) continue;
        const { unitId, unitName, conversionFactor } = deriveUnitInfo(line, allMaterials);
        const conv = parseConv(conversionFactor);
        const origQty = parseNum(line.quantity);
        const origBase = origQty * conv;
        const returnedBase = combinedReturnedMap.get(line.id) || 0;
        const remainingBase = origBase - returnedBase;
        if (remainingBase <= 0) continue;
        const availableQty = remainingBase / conv;
        const key = line.material_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.issued_at,
          line,
          unitId,
          unitName,
          conversionFactor,
          availableQty,
        });
      }
    }
    return map;
  }, [invoices, combinedReturnedMap, allMaterials]);

  const materialKeys = useMemo(() => Array.from(invoiceLinesByMaterial.keys()), [invoiceLinesByMaterial]);

  const searchResults = useMemo(() => {
    const keys = initialMaterialId
      ? materialKeys.filter(k => k === initialMaterialId)
      : materialKeys;

    if (!searchQuery.trim()) return keys;
    const q = searchQuery.toLowerCase();
    return keys.filter(key => {
      const instances = invoiceLinesByMaterial.get(key);
      const name = instances?.[0]?.line.material_name?.toLowerCase() || "";
      return name.includes(q) || key.toLowerCase().includes(q);
    });
  }, [searchQuery, materialKeys, invoiceLinesByMaterial, initialMaterialId]);

  // ── Selected-line helpers ──

  const [selectedOccurrenceKeys, setSelectedOccurrenceKeys] = useState<Set<string>>(new Set());

  const handleAddInstance = useCallback((inst: InvoiceLineInstance) => {
    const occKey = `${inst.invoiceId}_${inst.line.material_id}_${inst.line.quantity}_${inst.line.unit_price}`;
    if (selectedOccurrenceKeys.has(occKey)) { toast.error("هذه المادة مضافة مسبقاً"); return; }

    const key = `${occKey}_${Date.now()}`;
    const conv = parseConv(inst.conversionFactor);
    const origQty = parseNum(inst.line.quantity);
    const origBase = origQty * conv;
    const histReturnedBase = returnedQtyMap.get(inst.line.id) || 0;
    const sessionReturnedBase = sessionReturnedMap.get(inst.line.id) || 0;
    const remainingBase = Math.max(0, origBase - histReturnedBase - sessionReturnedBase);
    const remainingQty = (remainingBase / conv).toString();
    const priceBase = parseNum(inst.line.unit_price) / conv;

    setSelectedLines(prev => [...prev, {
      key, occKey,
      materialId: inst.line.material_id,
      materialName: inst.line.material_name || inst.line.material_id,
      invoiceLineId: inst.line.id || "",
      invoiceNumber: inst.invoiceNumber,
      invoiceDate: inst.invoiceDate,
      originalQuantity: remainingQty,
      originalQuantityRaw: remainingQty,
      originalConversionFactor: inst.conversionFactor,
      originalQuantityBase: remainingBase.toString(),
      originalPrice: inst.line.unit_price,
      originalPriceBase: priceBase.toFixed(6),
      unitId: inst.unitId,
      unitName: inst.unitName,
      conversionFactor: inst.conversionFactor,
      returnQuantity: remainingQty,
      returnPrice: inst.line.unit_price,
      notes: "",
    }]);
    setSelectedOccurrenceKeys(prev => new Set(prev).add(occKey));
  }, [returnedQtyMap, sessionReturnedMap, selectedOccurrenceKeys]);

  const updateSelectedLine = useCallback((key: string, fields: Partial<SelectedReturnLine>) => {
    setSelectedLines(prev => prev.map(l => l.key === key ? { ...l, ...fields } : l));
  }, []);

  const removeSelectedLine = useCallback((key: string) => {
    setSelectedLines(prev => {
      const removed = prev.find(l => l.key === key);
      if (removed) {
        setSelectedOccurrenceKeys(p => { const n = new Set(p); n.delete(removed.occKey); return n; });
      }
      return prev.filter(l => l.key !== key);
    });
  }, []);

  // Clamp returnQuantity & recalc returnPrice when unit changes
  const handleUnitChange = useCallback((key: string, newUnitId: string) => {
    setSelectedLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const mat = allMaterials.find(m => m.id === l.materialId);
      const newUnit = mat?.units.find(u => u.id === newUnitId);
      if (!newUnit) return l;
      const newConv = parseConv(newUnit.conversion_factor);
      const baseQty = parseNum(l.originalQuantityBase);
      const maxQty = baseQty / newConv;
      const curQty = parseNum(l.returnQuantity);
      const clampedQty = Math.min(curQty, maxQty);
      const basePrice = parseNum(l.originalPriceBase);
      const newPrice = (basePrice * newConv).toFixed(2);
      return {
        ...l,
        unitId: newUnitId,
        unitName: newUnit.name,
        conversionFactor: newUnit.conversion_factor,
        originalPrice: newPrice,
        returnPrice: newPrice,
        originalQuantity: maxQty.toString(),
        returnQuantity: clampedQty.toString(),
      };
    }));
  }, [allMaterials]);

  // Clamp returnQuantity when user edits it
  const handleReturnQuantityChange = useCallback((key: string, val: string) => {
    setSelectedLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const conv = parseConv(l.conversionFactor);
      const maxBase = parseNum(l.originalQuantityBase);
      const maxQty = maxBase / conv;
      const parsedVal = parseFloat(val);
      const newQty = Math.min(Math.max(0, parsedVal || 0), maxQty);
      return { ...l, returnQuantity: val === "" ? "" : newQty.toString() };
    }));
  }, []);

  // ── Save ──

  const handleSave = async () => {
    if (!form.partyId) { toast.error("الرجاء اختيار الطرف"); return; }
    if (!selectedLines.length) { toast.error("الرجاء إضافة مادة واحدة على الأقل"); return; }
    setSaving(true);
    try {
      const partyName = isSales
        ? customers.find(c => c.id === form.partyId)?.name
        : suppliers.find(s => s.id === form.partyId)?.name;

      const lines = selectedLines.map(l => ({
        id: "",
        material_id: l.materialId,
        material_name: l.materialName,
        quantity: l.returnQuantity || "0",
        unit_id: l.unitId || undefined,
        unit_name: l.unitName || undefined,
        conversion_factor: l.conversionFactor,
        unit_price: l.returnPrice,
        line_total: (parseNum(l.returnQuantity) * parseNum(l.returnPrice)).toFixed(2),
        notes: l.notes || undefined,
        invoice_line_id: l.invoiceLineId || undefined,
      }));

      if (isSales) {
        await returnService.createSalesReturn({
          return_number: "",
          customer_id: form.partyId,
          customer_name: partyName,
          return_date: new Date(form.returnDate).toISOString(),
          lines: lines as SalesReturnLineDto[],
          notes: form.generalNotes || undefined,
        });
      } else {
        await returnService.createPurchaseReturn({
          return_number: "",
          supplier_id: form.partyId,
          supplier_name: partyName,
          return_date: new Date(form.returnDate).toISOString(),
          lines: lines as PurchaseReturnLineDto[],
          notes: form.generalNotes || undefined,
        });
      }

      toast.success("تم تسجيل المرتجع بنجاح");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("فشل تسجيل المرتجع: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handleReturnTypeChange = useCallback((type: "purchase" | "sales") => {
    setForm(prev => ({ ...prev, returnType: type, partyId: "" }));
    setInvoices([]);
    setPrevReturns([]);
    setSelectedLines([]);
    setSearchQuery("");
    setSelectedOccurrenceKeys(new Set());
  }, []);

  const isSaveDisabled = saving || !form.partyId || !selectedLines.length;

  const sumTotal = useMemo(() =>
    selectedLines.reduce((acc, l) => acc + parseNum(l.returnQuantity) * parseNum(l.returnPrice), 0),
  [selectedLines]);

  if (!open) return null;

  return (
    <FormPanel
      title={`مرتجع ${isSales ? "مبيعات" : "مشتريات"} (${isSales ? "إرجاع من زبون" : "إرجاع لمورد"})`}
      icon={<Undo2 className={`w-5 h-5 ${isSales ? "text-blue-600" : "text-amber-600"}`} />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="تسجيل المرتجع"
      width="lg"
    >
      {/* ── بيانات المرتجع ── */}
      <SidebarSection icon={<Undo2 className="w-3.5 h-3.5" />} title="بيانات المرتجع" defaultOpen={true}>
        <div className="space-y-4 text-right">
          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5">
              <Undo2 className="w-3.5 h-3.5 text-slate-400" /> نوع المرتجع
            </FieldLabel>
            
            {/* Premium Segmented Control */}
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
              <button
                type="button"
                onClick={() => handleReturnTypeChange("purchase")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200",
                  !isSales
                    ? "bg-white text-amber-700 shadow-sm border border-slate-200/40"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <ShoppingBag className={cn("w-3.5 h-3.5", !isSales ? "text-amber-600" : "text-slate-400")} />
                إرجاع لمورد (مشتريات)
              </button>
              <button
                type="button"
                onClick={() => handleReturnTypeChange("sales")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200",
                  isSales
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/40"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <ShoppingCart className={cn("w-3.5 h-3.5", isSales ? "text-blue-600" : "text-slate-400")} />
                إرجاع من زبون (مبيعات)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5" required>
              <Building2 className="w-3.5 h-3.5 text-slate-400" /> {isSales ? "الزبون" : "المورد"}
            </FieldLabel>
            <Select value={form.partyId} onValueChange={val => setForm(p => ({ ...p, partyId: val }))}>
              <SelectTrigger className="w-full bg-white border-slate-200 h-9 rounded-lg">
                <SelectValue placeholder={loadingParties ? "جار التحميل..." : `اختر ${isSales ? "الزبون" : "المورد"}...`} />
              </SelectTrigger>
              <SelectContent>
                {(isSales ? customers : suppliers).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> تاريخ المرتجع
            </FieldLabel>
            <Input type="date" value={form.returnDate}
              onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))}
              className="bg-white border-slate-200 h-9 rounded-lg" />
          </div>
        </div>
      </SidebarSection>

      {/* ── اختيار المواد من الفواتير ── */}
      {form.partyId && (
        <SidebarSection icon={<Package className="w-3.5 h-3.5" />} title="اختيار المواد من الفواتير" defaultOpen={true}>
          <div className="space-y-3">
            {!initialMaterialId && (
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن مادة..."
                  className="bg-white border-slate-200 h-9 pr-9 transition-all duration-200 focus:border-blue-300 rounded-lg" />
              </div>
            )}

            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200/60 rounded-xl p-2.5 bg-slate-50/50 custom-scrollbar">
              {loadingInvoices ? (
                <div className="space-y-2 py-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-md bg-slate-200 animate-pulse" />)}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-8 text-slate-400">
                  <Package className="w-9 h-9 opacity-30" />
                  <p className="text-xs font-semibold">
                    {searchQuery ? "لا توجد نتائج للبحث" : invoices.length === 0 ? "لا توجد فواتير سابقة لهذا الطرف" : "جميع بنود الفواتير مسترجعة بالكامل"}
                  </p>
                </div>
              ) : (
                searchResults.map(key => {
                  const instances = invoiceLinesByMaterial.get(key) || [];
                  const name = instances[0]?.line.material_name || key;
                  return instances.map((inst, idx) => {
                    const occKey = `${inst.invoiceId}_${inst.line.material_id}_${inst.line.quantity}_${inst.line.unit_price}`;
                    const isAdded = selectedOccurrenceKeys.has(occKey);
                    return (
                      <div key={`${inst.invoiceId}_${inst.line.material_id}_${idx}`}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-xs transition-all duration-200",
                          isAdded
                            ? "bg-slate-100 border-slate-200/60 opacity-60 cursor-not-allowed text-slate-400"
                            : "bg-white border-slate-200 hover:bg-blue-50/45 hover:border-blue-200 hover:shadow-sm cursor-pointer"
                        )}
                        onClick={() => !isAdded && handleAddInstance(inst)}
                      >
                        <div className={cn(
                          "w-6.5 h-6.5 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                          isAdded
                            ? "bg-slate-50 border-slate-200 text-slate-400"
                            : "bg-blue-50/60 border-blue-100/80 text-blue-600"
                        )}>
                          {isAdded ? <CheckCircle2 className="w-3 h-3 text-slate-400" /> : <Plus className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <span className="font-bold block truncate text-slate-800">{name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            فاتورة رقم: {inst.invoiceNumber} • {new Date(inst.invoiceDate).toLocaleDateString("ar-SA")}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0 pl-1">
                          <span className="font-mono font-black text-slate-700">
                            {inst.availableQty.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-slate-400">{inst.unitName}</span>
                        </div>
                      </div>
                    );
                  });
                })
              )}
            </div>

            {!loadingInvoices && invoices.length > 0 && (
              <div className="flex items-center justify-between px-2 text-[10px] text-slate-400 font-semibold">
                <div className="flex items-center gap-2">
                  <Package className="w-3 h-3" />
                  <span>المواد المتوفرة بالفواتير: {searchResults.length}</span>
                  <span className="text-slate-300">•</span>
                  <span>عدد الفواتير: {invoices.length}</span>
                </div>
                <span>المختارة: {selectedLines.length}</span>
              </div>
            )}
          </div>
        </SidebarSection>
      )}

      {/* ── المواد المحددة للمرتجع ── */}
      {selectedLines.length > 0 && (
        <SidebarSection icon={<ShoppingBag className="w-3.5 h-3.5" />} title="المواد المحددة للمرتجع" defaultOpen={true}>
          <div className="space-y-4">
            {/* Selected lines - Scroll removed from here, grows naturally with sidebar */}
            <div className="space-y-3.5">
              {selectedLines.map(line => {
                const mat = allMaterials?.find(m => m.id === line.materialId);
                const units = mat?.units || [];
                return (
                  <div
                    key={line.key}
                    className="border border-slate-200 rounded-xl p-4 space-y-3.5 bg-white shadow-sm hover:border-slate-300 transition-all text-right"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">{line.materialName}</span>
                      </div>
                      <Button size="sm" variant="ghost"
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-7 px-2.5 rounded-lg text-[11px] font-bold"
                        onClick={() => removeSelectedLine(line.key)}>
                        <X className="w-3 h-3 ml-1" /> حذف البند
                      </Button>
                    </div>

                    {/* Original stats grid */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50/60 p-3 rounded-lg border border-slate-100/70 text-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400 text-[10px] font-bold">الكمية الأصلية المتاحة</span>
                        <div className="font-mono font-bold text-slate-800" dir="ltr">
                          {parseFloat(line.originalQuantity).toFixed(2)} {line.unitName || ""}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 text-[10px] font-bold">السعر الأصلي للفاتورة</span>
                        <div className="font-mono font-bold text-slate-800" dir="ltr">
                          {parseFloat(line.originalPrice).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Inputs grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Unit select */}
                      <div className="space-y-1.5 col-span-2">
                        <FieldLabel className="flex items-center gap-1.5 text-[11px]">
                          <Ruler className="w-3.5 h-3.5 text-slate-400" /> الوحدة المرتجعة
                        </FieldLabel>
                        {units.length > 0 ? (
                          <Select value={line.unitId} onValueChange={val => handleUnitChange(line.key, val)}>
                            <SelectTrigger className="bg-white border-slate-200 h-9 text-xs w-full rounded-lg">
                              <SelectValue placeholder="اختر الوحدة" />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map(u => (
                                <SelectItem key={u.id} value={u.id} className="text-xs">
                                  {u.name}{u.conversion_factor !== "1" ? ` (×${u.conversion_factor})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-9 rounded-lg px-3 bg-slate-50 border border-slate-150 flex items-center text-xs text-slate-600">
                            {line.unitName || "—"}
                          </div>
                        )}
                      </div>

                      {/* Return Qty */}
                      <div className="space-y-1.5">
                        <FieldLabel className="text-[11px] font-bold text-slate-600">كمية المرتجع</FieldLabel>
                        <Input type="number" min="0" step="any"
                          value={line.returnQuantity}
                          onChange={e => handleReturnQuantityChange(line.key, e.target.value)}
                          className="bg-white border-slate-200 h-9 text-xs text-left font-mono" dir="ltr" />
                        <div className="text-[9px] text-slate-400 px-0.5 mt-0.5">
                          الحد الأقصى: {parseFloat(line.originalQuantity).toFixed(2)} {line.unitName}
                        </div>
                      </div>

                      {/* Return Price */}
                      <div className="space-y-1.5">
                        <FieldLabel className="text-[11px] font-bold text-slate-600">سعر المرتجع</FieldLabel>
                        <Input type="number" min="0" step="0.01"
                          value={line.returnPrice}
                          onChange={e => updateSelectedLine(line.key, { returnPrice: e.target.value })}
                          className="bg-white border-slate-200 h-9 text-xs text-left font-mono" dir="ltr" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <FieldLabel className="text-[11px] font-bold text-slate-600">ملاحظات البند</FieldLabel>
                      <Input value={line.notes}
                        onChange={e => updateSelectedLine(line.key, { notes: e.target.value })}
                        placeholder="سبب الإرجاع..." className="bg-white border-slate-200 h-8.5 text-xs rounded-lg" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* General notes */}
            <div className="space-y-1.5 text-right">
              <FieldLabel className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> ملاحظات عامة
              </FieldLabel>
              <Input value={form.generalNotes}
                onChange={e => setForm(p => ({ ...p, generalNotes: e.target.value }))}
                placeholder="تفاصيل إضافية عن المرتجع الكلي..." className="bg-white border-slate-200 h-9.5 rounded-lg" />
            </div>

            {/* Premium Summary bar */}
            <div className="rounded-xl border border-slate-150 bg-gradient-to-l from-slate-50 to-white p-4 space-y-3 text-right">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ملخص المرتجع</h4>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                <span className="text-slate-500 font-semibold">عدد المواد المختارة</span>
                <span className="font-bold text-slate-800">{selectedLines.length} صنف</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-semibold">إجمالي المرتجع</span>
                <span className={cn(
                  "text-sm font-black tabular-nums",
                  isSales ? "text-blue-700" : "text-amber-700"
                )}>
                  {sumTotal.toFixed(2)} ر.س
                </span>
              </div>
            </div>
          </div>
        </SidebarSection>
      )}
    </FormPanel>
  );
}
