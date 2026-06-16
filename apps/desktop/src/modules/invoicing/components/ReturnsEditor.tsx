import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { ReturnMaterialSearchPanel, type ReturnOccurrenceItem } from "../components/ReturnMaterialSearchPanel";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { returnService } from "@modules/invoicing/api/returnService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { toReturnBackendLines, newGridLine } from "@modules/invoicing/lib/invoiceUtils";
import type { GridLine } from "@modules/invoicing/lib/invoiceUtils";
import type { CustomerDto, SupplierDto, MaterialDto, SalesReturnLineDto, PurchaseReturnLineDto, WarehouseDto, SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";

interface ReturnsEditorProps {
  returnType: "PurchaseReturn" | "SalesReturn";
  partyType: "supplier" | "customer";
  parties: (SupplierDto | CustomerDto)[];
  materials: MaterialDto[];
  warehouses: WarehouseDto[];
  onSaved: () => void;
  onClose: () => void;
}

export function ReturnsEditor({ returnType, partyType, parties, materials, warehouses, onSaved, onClose }: ReturnsEditorProps) {
  const isSales = returnType === "SalesReturn";
  const [saving, setSaving] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [partyName, setPartyName] = useState(isSales ? "زبون نقدي" : "مورد نقدي");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const {
    lines,
    updateLine,
    removeLine: originalRemoveLine,
    addLine,
    selectMaterial,
    setLines,
  } = useDocumentEditor({
    priceField: isSales ? "last_sale_price" : "last_purchase_price",
    materials,
  });

  // Wrapped removeLine that also removes occurrence key!
  const removeLine = useCallback((index: number) => {
    const line = lines[index];
    if (line?.occurrence_key) {
      setSelectedOccurrenceKeys(prev => {
        const next = new Set(prev);
        next.delete(line.occurrence_key);
        return next;
      });
    }
    originalRemoveLine(index);
  }, [lines, originalRemoveLine]);

  // Track selected occurrence keys to prevent duplicates!
  const [selectedOccurrenceKeys, setSelectedOccurrenceKeys] = useState<Set<string>>(new Set());
  const [occurrences, setOccurrences] = useState<ReturnOccurrenceItem[]>([]);
  const pendingOccurrenceRef = useRef<ReturnOccurrenceItem | null>(null);

  // Build invoice-line occurrences when partyId changes
  useEffect(() => {
    if (!partyId) {
      setOccurrences([]);
      setSelectedOccurrenceKeys(new Set());
      return;
    }
    const invType = isSales ? "Sales" as const : "Purchase" as const;
    Promise.all([
      invoiceService.listInvoicesByType(invType),
      isSales ? returnService.listSalesReturns() : returnService.listPurchaseReturns(),
    ]).then(([invoices, returns]) => {
      const filteredInvs = isSales
        ? invoices.filter((inv) => inv.customer_id === partyId)
        : invoices.filter((inv) => inv.supplier_id === partyId);

      // Build returned qty map: invoice_line_id → total returned base quantity
      const returnedQtyMap = new Map<string, number>();
      const filteredReturns = (returns as Array<SalesReturnDto | PurchaseReturnDto>).filter(r =>
        isSales ? (r as SalesReturnDto).customer_id === partyId : (r as PurchaseReturnDto).supplier_id === partyId
      );
      for (const ret of filteredReturns) {
        for (const line of ret.lines) {
          const lid = line.invoice_line_id;
          if (lid) {
            const material = materials.find((m) => m.id === line.material_id);
            const unit = material?.units.find((u) => u.id === line.unit_id);
            const conv = parseFloat(unit?.conversion_factor || "1") || 1;
            const baseQty = parseFloat(line.quantity) * conv;
            returnedQtyMap.set(lid, (returnedQtyMap.get(lid) || 0) + baseQty);
          }
        }
      }

      const items: ReturnOccurrenceItem[] = [];
      const seen = new Set<string>();
      for (const inv of filteredInvs) {
        for (const line of inv.lines) {
          const material = materials.find((m) => m.id === line.material_id);
          if (!material) continue;
          // Unique key per invoice + line identifier (using invoice ID, material ID, quantity, price, unit to avoid duplicates)
          const key = `${inv.id}_${line.material_id}_${line.quantity}_${line.unit_price}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // Derive unit info from material when not provided on invoice line
          const invUnit = line.unit_id ? material.units.find(u => u.id === line.unit_id) : undefined;
          const unitName = line.unit_name || invUnit?.name || "";
          const convFactor = line.conversion_factor || invUnit?.conversion_factor || "1";

          // Compute remaining quantity (subtract already-returned amounts)
          const origBase = parseFloat(line.quantity) * parseFloat(convFactor);
          const returnedBase = returnedQtyMap.get(line.id) || 0;
          const remainingBase = Math.max(0, origBase - returnedBase);
          const remainingQty = remainingBase / parseFloat(convFactor);
          if (remainingQty <= 0) continue; // Skip fully-returned lines

          items.push({
            material,
            original_quantity: remainingQty.toString(),
            original_price: line.unit_price,
            unit_id: line.unit_id || invUnit?.id,
            unit_name: unitName,
            conversion_factor: convFactor,
            warehouse_id: line.warehouse_id,
            id: line.id,
            invoice_id: inv.id,
            invoice_date: inv.issued_at,
            invoice_number: inv.invoice_number,
          });
        }
      }
      setOccurrences(items);
      setSelectedOccurrenceKeys(new Set());
    }).catch((e) => console.error("Failed to fetch partner invoices", e));
  }, [partyId, isSales, materials]);

  // Clear lines when partyId changes
  useEffect(() => {
    setLines([newGridLine()]);
  }, [partyId, setLines]);

  const columns = useMemo<DocumentColumn[]>(() => [
    { key: "material_image", header: "صورة", width: "w-[40px]", type: "image", defaultVisible: false },
    { key: "material_code", header: "الكود", width: "w-[100px]", type: "material_code", defaultVisible: true },
    { key: "unit_barcode", header: "الباركود", width: "w-[120px]", type: "material_barcode", defaultVisible: false },
    { key: "material_name", header: "الصنف (عربي)", width: "flex-[2]", type: "material", defaultVisible: true },
    { key: "name_en", header: "الصنف (EN)", width: "flex-[1.5]", type: "readonly", defaultVisible: false },
    { key: "warehouse_qty", header: "المتوفر", width: "w-[70px]", type: "readonly", defaultVisible: true },
    { key: "original_quantity", header: "الكمية الأصلية", width: "w-[120px]", type: "readonly", defaultVisible: true },
    { key: "original_price", header: "السعر الأصلي", width: "w-[90px]", type: "readonly", defaultVisible: true },
    { key: "quantity", header: "كمية المرتجع", width: "w-[90px]", type: "number", defaultVisible: true },
    { key: "unit_name", header: "الوحدة", width: "w-[100px]", type: "unit_select", defaultVisible: true },
    { key: "warehouse_id", header: "المستودع", width: "w-[140px]", type: "warehouse_select", defaultVisible: true },
    { key: "unit_price", header: "سعر المرتجع", width: "w-[100px]", type: "number", defaultVisible: true },
    { key: "line_total", header: "الإجمالي", width: "w-[110px]", type: "readonly", defaultVisible: true },
    { key: "notes", header: "ملاحظات", width: "flex-[1]", type: "text", defaultVisible: true },
  ], []);

  // Read current lines for clamping
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Wrapped updateLine: clamp return quantity and recalc prices on unit change
  const wrappedUpdateLine = useCallback((index: number, updates: Partial<GridLine>) => {
    let postUpdates: Partial<GridLine> | null = null;

    if ('unit_id' in updates) {
      const currentLine = linesRef.current[index];
      if (currentLine?.original_price_base) {
        const material = materials.find(m => m.id === currentLine.material_id);
        const newUnit = material?.units.find(u => u.id === updates.unit_id);
        if (newUnit) {
          const newConv = parseFloat(newUnit.conversion_factor || "1") || 1;
          const basePrice = parseFloat(currentLine.original_price_base) || 0;
          const newPrice = (basePrice * newConv).toFixed(2);
          postUpdates = { original_price: newPrice, unit_price: newPrice, conversion_factor: newUnit.conversion_factor?.toString() };
        }
      }
    }

    if ('quantity' in updates) {
      const currentLine = linesRef.current[index];
      if (currentLine?.original_quantity_raw && currentLine?.original_conversion_factor) {
        const origQty = parseFloat(currentLine.original_quantity_raw) || 0;
        const origConv = parseFloat(currentLine.original_conversion_factor) || 1;
        const baseQty = origQty * origConv;
        const currentConv = parseFloat(currentLine.conversion_factor || "1") || 1;
        const maxQty = baseQty / currentConv;
        const newQty = parseFloat(updates.quantity || "0");
        if (maxQty > 0 && newQty > maxQty) {
          updates = { ...updates, quantity: maxQty.toString() };
        }
      }
    }

    updateLine(index, updates);
    if (postUpdates) {
      updateLine(index, postUpdates);
    }
  }, [updateLine, materials]);

  // Intercept material selection to inject original invoice-line data
  const handleSelectMaterial = useCallback((index: number, material: MaterialDto) => {
    selectMaterial(index, material);
    const occ = pendingOccurrenceRef.current;
    if (occ) {
      // Generate unique key to mark as selected
      const occKey = `${occ.invoice_id}_${occ.material.id}_${occ.original_quantity}_${occ.original_price}`;

      // Compute two-line display for original_quantity with unit info
      const rawQty = parseFloat(occ.original_quantity);
      const conv = parseFloat(occ.conversion_factor || "1");
      const baseUnit = occ.material.units.find(u => u.is_base);
      const baseUnitName = baseUnit?.name || "";
      const unitName = occ.unit_name || "";
      const baseQty = rawQty * conv;

      let displayQty: string;
      if (conv > 1 && unitName && baseUnitName) {
        displayQty = `${rawQty} ${unitName}\n${baseQty} ${baseUnitName}`;
      } else {
        displayQty = `${rawQty} ${unitName || baseUnitName}`;
      }

      wrappedUpdateLine(index, {
        original_quantity: displayQty,
        original_quantity_raw: occ.original_quantity,
        original_conversion_factor: occ.conversion_factor || "1",
        original_price: occ.original_price,
        original_price_base: (parseFloat(occ.original_price) / parseFloat(occ.conversion_factor || "1")).toFixed(2),
        quantity: occ.original_quantity,
        unit_price: occ.original_price,
        unit_id: occ.unit_id,
        unit_name: occ.unit_name,
        warehouse_id: occ.warehouse_id,
        occurrence_key: occKey,
        invoice_line_id: occ.id,
      });

      setSelectedOccurrenceKeys(prev => new Set(prev).add(occKey));
      pendingOccurrenceRef.current = null;
    }
  }, [selectMaterial, wrappedUpdateLine]);

  // Custom search panel: shows invoice-line occurrences only when partner has invoices, and filters already selected ones!
  const searchPanelRenderer = useMemo(() => {
    if (!partyId || occurrences.length === 0) return undefined;
    
    // Filter out already selected occurrences
    const filteredOccurrences = occurrences.filter(occ => {
      const occKey = `${occ.invoice_id}_${occ.material.id}_${occ.original_quantity}_${occ.original_price}`;
      return !selectedOccurrenceKeys.has(occKey);
    });
    
    return (props: {
      search: string;
      searchType: "name" | "code" | "barcode";
      style: React.CSSProperties | null;
      onSelect: (material: MaterialDto) => void;
      onClose: () => void;
    }) => (
      <ReturnMaterialSearchPanel
        occurrences={filteredOccurrences}
        search={props.search}
        searchType={props.searchType}
        style={props.style}
        onSelect={(occ) => {
          pendingOccurrenceRef.current = occ;
          props.onSelect(occ.material);
        }}
        onClose={props.onClose}
      />
    );
  }, [occurrences, partyId, selectedOccurrenceKeys]);

  const totalAmount = useMemo(() =>
    lines.reduce((sum, l) => sum + (parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0")), 0), [lines]);

  const handleSave = async () => {
    if (!partyId && isSales) { toast.error("الرجاء اختيار الزبون"); return; }
    if (!partyId && !isSales) { toast.error("الرجاء اختيار المورد"); return; }
    const validLines = lines.filter(l => l.material_id);
    if (!validLines.length) { toast.error("الرجاء إضافة مادة واحدة على الأقل"); return; }

    setSaving(true);
    try {
      const backendLines = toReturnBackendLines(lines);

      if (isSales) {
        await returnService.createSalesReturn({
          return_number: "",
          customer_id: partyId,
          customer_name: partyName,
          return_date: new Date(returnDate).toISOString(),
          lines: backendLines as SalesReturnLineDto[],
          notes: notes || undefined,
        });
      } else {
        await returnService.createPurchaseReturn({
          return_number: "",
          supplier_id: partyId,
          supplier_name: partyName,
          return_date: new Date(returnDate).toISOString(),
          lines: backendLines as PurchaseReturnLineDto[],
          notes: notes || undefined,
        });
      }

      toast.success("تم تسجيل المرتجع بنجاح");
      onSaved();
    } catch (e) {
      toast.error("فشل تسجيل المرتجع: " + e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FinancialDocumentTemplate
      title={returnType === "SalesReturn" ? "مرتجع مبيعات" : "مرتجع مشتريات"}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClose} className="h-9 border-slate-200 hover:bg-slate-50">
            <X className="w-4 h-4 ml-2" /> إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ المرتجع"}
          </Button>
        </div>
      }
      headerFields={
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ المرتجع</label>
            <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="h-9 font-bold border-slate-200" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <InvoicePartySelector
              type={partyType}
              parties={parties}
              selectedId={partyId}
              selectedName={partyName}
              onSelect={(id, name) => { setPartyId(id); setPartyName(name); }}
              onClear={() => { setPartyId(""); setPartyName(isSales ? "زبون نقدي" : "مورد نقدي"); }}
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات</label>
            <Input placeholder="ملاحظات إضافية..." value={notes} onChange={e => setNotes(e.target.value)} className="h-9 border-slate-200" />
          </div>
        </>
      }
      lineItemsGrid={
        <GenericDocumentGrid
          columns={columns}
          lines={lines}
          onUpdateLine={wrappedUpdateLine}
          onRemoveLine={removeLine}
          onAddLine={addLine}
          onSelectMaterial={handleSelectMaterial}
          materials={materials}
          warehouses={warehouses}
          preferenceKey={`${returnType === "SalesReturn" ? "sales" : "purchase"}-returns-editor`}
          searchPanelRenderer={searchPanelRenderer}
        />
      }
      summaryPanel={
        <SummaryPanel
          subtotal={totalAmount}
          discount={0}
          tax={0}
          net={totalAmount}
          invoiceType={isSales ? "Sales" : "Purchase"}
          isReadOnly={true}
        />
      }
      sidebar={null}
    />
  );
}
