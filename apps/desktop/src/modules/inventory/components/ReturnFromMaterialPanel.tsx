import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Undo2, X, ShoppingBag, ShoppingCart, Search, Plus } from "lucide-react";
import type { CustomerDto, SupplierDto, InvoiceDto, InvoiceLineDto, SalesReturnLineDto, PurchaseReturnLineDto, CreateSalesReturnRequest, CreatePurchaseReturnRequest, SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { FormPanel } from "@widgets/form-shell/FormPanel";
import { SidebarSection } from "@widgets/sidebar-shell/SidebarSection";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toast } from "sonner";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { returnService } from "@modules/invoicing/api/returnService";

interface InvoiceLineInstance {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  line: InvoiceLineDto;
}

interface SelectedReturnLine {
  key: string;
  materialId: string;
  materialName: string;
  invoiceLineId: string;
  invoiceNumber: string;
  invoiceDate: string;
  originalQuantity: string;
  originalPrice: string;
  returnQuantity: string;
  returnPrice: string;
  notes: string;
}

interface ReturnFromMaterialPanelProps {
  onClose: () => void;
  onSaved: () => void;
  initialReturnType?: "purchase" | "sales";
  initialPartyId?: string;
}

export function ReturnFromMaterialPanel({ onClose, onSaved, initialReturnType, initialPartyId }: ReturnFromMaterialPanelProps) {
  const [returnType, setReturnType] = useState<"purchase" | "sales">(initialReturnType || "purchase");
  const [partyId, setPartyId] = useState(initialPartyId || "");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [generalNotes, setGeneralNotes] = useState("");

  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [loadingParties, setLoadingParties] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLines, setSelectedLines] = useState<SelectedReturnLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [returns, setReturns] = useState<(SalesReturnDto | PurchaseReturnDto)[]>([]);

  const isSales = returnType === "sales";

  useEffect(() => {
    setLoadingParties(true);
    Promise.all([
      customerService.listCustomers(),
      supplierService.listSuppliers(),
    ]).then(([custs, supps]) => {
      setCustomers(custs);
      setSuppliers(supps);
    }).catch(() => toast.error("فشل تحميل العملاء والموردين"))
    .finally(() => setLoadingParties(false));
  }, []);

  useEffect(() => {
    if (!partyId) { setInvoices([]); setReturns([]); return; }
    setLoadingInvoices(true);
    Promise.all([
      invoiceService.listInvoicesByType(isSales ? "Sales" : "Purchase"),
      isSales ? returnService.listSalesReturns() : returnService.listPurchaseReturns(),
    ]).then(([allInvoices, allReturns]) => {
      const filteredInvoices = allInvoices.filter(inv =>
        isSales ? (inv as InvoiceDto).customer_id === partyId : (inv as InvoiceDto).supplier_id === partyId
      );
      setInvoices(filteredInvoices);
      const filteredReturns = (allReturns as Array<SalesReturnDto | PurchaseReturnDto>).filter(r =>
        isSales ? (r as SalesReturnDto).customer_id === partyId : (r as PurchaseReturnDto).supplier_id === partyId
      );
      setReturns(filteredReturns);
    })
      .catch(() => toast.error("فشل تحميل البيانات"))
      .finally(() => setLoadingInvoices(false));
  }, [partyId, isSales]);

  const partyInvoices = useMemo(() => {
    if (!partyId || !invoices.length) return [];
    return invoices.filter(inv =>
      isSales
        ? (inv as InvoiceDto).customer_id === partyId
        : (inv as InvoiceDto).supplier_id === partyId
    );
  }, [invoices, partyId, isSales]);

  // Build map of invoice_line_id → total returned qty (same-unit assumption)
  const returnedQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ret of returns) {
      for (const line of (ret.lines || [])) {
        const lid = line.invoice_line_id;
        if (lid) {
          map.set(lid, (map.get(lid) || 0) + parseFloat(line.quantity || "0"));
        }
      }
    }
    return map;
  }, [returns]);

  const invoiceLinesByMaterial = useMemo(() => {
    const map = new Map<string, InvoiceLineInstance[]>();
    if (!partyInvoices.length) return map;

    for (const inv of partyInvoices) {
      for (const line of (inv.lines || [])) {
        if (!line.material_id) continue;
        // Skip fully-returned lines
        const returnedQty = returnedQtyMap.get(line.id) || 0;
        const origQty = parseFloat(line.quantity || "0");
        if (origQty - returnedQty <= 0) continue;
        const key = line.material_id;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.issued_at,
          line,
        });
      }
    }
    return map;
  }, [partyInvoices, returnedQtyMap]);

  const materialKeys = useMemo(() => Array.from(invoiceLinesByMaterial.keys()), [invoiceLinesByMaterial]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return materialKeys;
    const q = searchQuery.toLowerCase();
    return materialKeys.filter(key => {
      const instances = invoiceLinesByMaterial.get(key);
      if (!instances?.length) return false;
      const name = instances[0].line.material_name?.toLowerCase() || "";
      return name.includes(q) || key.toLowerCase().includes(q);
    });
  }, [searchQuery, materialKeys, invoiceLinesByMaterial]);

  const selectedMaterialIds = useMemo(() => new Set(selectedLines.map(l => l.materialId)), [selectedLines]);

  const handleAddInstance = (instance: InvoiceLineInstance) => {
    const key = `${instance.invoiceId}_${instance.line.material_id}_${instance.line.unit_id || ""}_${Date.now()}`;
    const returnedQty = returnedQtyMap.get(instance.line.id) || 0;
    const origQty = parseFloat(instance.line.quantity || "0");
    const remainingQty = Math.max(0, origQty - returnedQty).toString();
    setSelectedLines(prev => [...prev, {
      key,
      materialId: instance.line.material_id,
      materialName: instance.line.material_name || instance.line.material_id,
      invoiceLineId: instance.line.id || "",
      invoiceNumber: instance.invoiceNumber,
      invoiceDate: instance.invoiceDate,
      originalQuantity: remainingQty,
      originalPrice: instance.line.unit_price,
      returnQuantity: remainingQty,
      returnPrice: instance.line.unit_price,
      notes: "",
    }]);
  };

  const updateSelectedLine = (key: string, field: keyof SelectedReturnLine, value: string) => {
    setSelectedLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  };

  const removeSelectedLine = (key: string) => {
    setSelectedLines(prev => prev.filter(l => l.key !== key));
  };

  const handleSave = async () => {
    if (!partyId) { toast.error("الرجاء اختيار الطرف"); return; }
    if (!selectedLines.length) { toast.error("الرجاء إضافة مادة واحدة على الأقل"); return; }

    setSaving(true);
    try {
      const partyName = isSales
        ? customers.find(c => c.id === partyId)?.name
        : suppliers.find(s => s.id === partyId)?.name;

      const lines = selectedLines.map(l => ({
        id: "",
        material_id: l.materialId,
        material_name: l.materialName,
        quantity: l.returnQuantity,
        unit_price: l.returnPrice,
        line_total: (parseFloat(l.returnQuantity) * parseFloat(l.returnPrice)).toFixed(2),
        notes: l.notes || undefined,
        invoice_line_id: l.invoiceLineId || undefined,
      }));

      if (isSales) {
        const payload: CreateSalesReturnRequest = {
          return_number: "",
          customer_id: partyId,
          customer_name: partyName,
          return_date: new Date(returnDate).toISOString(),
          lines: lines as SalesReturnLineDto[],
          notes: generalNotes || undefined,
        };
        await returnService.createSalesReturn(payload);
      } else {
        const payload: CreatePurchaseReturnRequest = {
          return_number: "",
          supplier_id: partyId,
          supplier_name: partyName,
          return_date: new Date(returnDate).toISOString(),
          lines: lines as PurchaseReturnLineDto[],
          notes: generalNotes || undefined,
        };
        await returnService.createPurchaseReturn(payload);
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

  const isSaveDisabled = saving || !partyId || !selectedLines.length;

  return (
    <FormPanel
      title={isSales ? "مرتجع مبيعات (إرجاع من زبون)" : "مرتجع مشتريات (إرجاع لمورد)"}
      icon={<Undo2 className={`w-5 h-5 ${isSales ? "text-blue-600" : "text-amber-600"}`} />}
      onClose={onClose}
      onSave={handleSave}
      isSaving={saving}
      saveDisabled={isSaveDisabled}
      saveLabel="تسجيل المرتجع"
    >
      <SidebarSection title="بيانات المرتجع" defaultOpen={true}>
        <div className="space-y-4 text-right">

          <div className="space-y-2">
            <FieldLabel>نوع المرتجع</FieldLabel>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={!isSales ? "default" : "outline"}
                onClick={() => { setReturnType("purchase"); setPartyId(""); setSelectedLines([]); }}
                className={`flex-1 ${!isSales ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              >
                <ShoppingBag className="w-4 h-4 ml-1" /> إرجاع لمورد
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isSales ? "default" : "outline"}
                onClick={() => { setReturnType("sales"); setPartyId(""); setSelectedLines([]); }}
                className={`flex-1 ${isSales ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              >
                <ShoppingCart className="w-4 h-4 ml-1" /> إرجاع من زبون
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel required>{isSales ? "الزبون" : "المورد"}</FieldLabel>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="w-full bg-white border-slate-200">
                <SelectValue placeholder={loadingParties ? "جار التحميل..." : `اختر ${isSales ? "الزبون" : "المورد"}...`} />
              </SelectTrigger>
              <SelectContent>
                {(isSales ? customers : suppliers).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel>تاريخ المرتجع</FieldLabel>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="bg-white border-slate-200" />
          </div>

        </div>
      </SidebarSection>

      {partyId && (
        <SidebarSection title="اختيار المواد من الفواتير" defaultOpen={true}>
          <div className="space-y-3">

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مادة..."
                className="bg-white border-slate-200 pr-9"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 bg-slate-50">
              {loadingInvoices ? (
                <p className="text-xs text-slate-400 text-center py-4">جار تحميل الفواتير...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  {searchQuery ? "لا توجد نتائج للبحث" : "اختر طرفاً لتحميل المواد من فواتيره"}
                </p>
              ) : (
                searchResults.map(key => {
                  const instances = invoiceLinesByMaterial.get(key) || [];
                  const name = instances[0]?.line.material_name || key;
                  return instances.map((inst, idx) => (
                    <div
                      key={`${inst.invoiceId}_${inst.line.material_id}_${idx}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-white border border-slate-200 text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      onClick={() => handleAddInstance(inst)}
                    >
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <div className="flex-1 min-w-0 text-right">
                        <span className="font-bold text-slate-800">{name}</span>
                      </div>
                      <div className="flex gap-3 shrink-0 text-slate-600">
                        <span>
                          الكمية: <strong dir="ltr" className="text-slate-900">{parseFloat(inst.line.quantity).toFixed(2)}</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                          {new Date(inst.invoiceDate).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    </div>
                  ));
                })
              )}
            </div>

          </div>
        </SidebarSection>
      )}

      {selectedLines.length > 0 && (
        <SidebarSection title="المواد المحددة للمرتجع" defaultOpen={true}>
          <div className="space-y-2">
            {selectedLines.map(line => (
              <div key={line.key} className="border rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="ghost" className="text-rose-500 h-6 px-2 text-xs" onClick={() => removeSelectedLine(line.key)}>
                    <X className="w-3 h-3 ml-1" /> حذف
                  </Button>
                  <div className="text-xs font-bold text-slate-800">{line.materialName}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500">الكمية الأصلية</span>
                    <div className="font-bold text-slate-700 bg-slate-50 rounded px-2 py-1" dir="ltr">
                      {parseFloat(line.originalQuantity).toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">السعر الأصلي</span>
                    <div className="font-bold text-slate-700 bg-slate-50 rounded px-2 py-1" dir="ltr">
                      {parseFloat(line.originalPrice).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <FieldLabel>كمية المرتجع</FieldLabel>
                    <Input
                      type="number" min="0" step="1"
                      value={line.returnQuantity}
                      onChange={e => updateSelectedLine(line.key, "returnQuantity", e.target.value)}
                      className="bg-white border-slate-200 h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel>سعر المرتجع</FieldLabel>
                    <Input
                      type="number" min="0" step="0.01"
                      value={line.returnPrice}
                      onChange={e => updateSelectedLine(line.key, "returnPrice", e.target.value)}
                      className="bg-white border-slate-200 h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <FieldLabel>ملاحظات</FieldLabel>
                  <Input
                    value={line.notes}
                    onChange={e => updateSelectedLine(line.key, "notes", e.target.value)}
                    placeholder="..."
                    className="bg-white border-slate-200 h-8 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mt-3">
            <FieldLabel>ملاحظات عامة</FieldLabel>
            <Input value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} placeholder="..." className="bg-white border-slate-200" />
          </div>

          <div className="mt-3 p-2 rounded-lg bg-slate-50 border text-xs">
            <span className="text-slate-600">إجمالي البنود: </span>
            <strong className="text-slate-900">{selectedLines.length}</strong>
          </div>
        </SidebarSection>
      )}
    </FormPanel>
  );
}
