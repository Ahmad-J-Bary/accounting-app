import { useState, useMemo } from "react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { returnService } from "@modules/invoicing/api/returnService";
import { toReturnBackendLines } from "@modules/invoicing/lib/invoiceUtils";
import type { CustomerDto, SupplierDto, MaterialDto, SalesReturnLineDto, PurchaseReturnLineDto } from "@erp/shared-types";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";

interface ReturnsEditorProps {
  returnType: "PurchaseReturn" | "SalesReturn";
  partyType: "supplier" | "customer";
  parties: (SupplierDto | CustomerDto)[];
  materials: MaterialDto[];
  onSaved: () => void;
  onClose: () => void;
}

export function ReturnsEditor({ returnType, partyType, parties, materials, onSaved, onClose }: ReturnsEditorProps) {
  const isSales = returnType === "SalesReturn";
  const [saving, setSaving] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [partyName, setPartyName] = useState(isSales ? "زبون نقدي" : "مورد نقدي");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const {
    lines,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
  } = useDocumentEditor({
    priceField: isSales ? "last_sale_price" : "last_purchase_price",
    materials,
  });

  const columns = useMemo<DocumentColumn[]>(() => [
    { key: "material_name", header: "الصنف", width: "flex-[2]", type: "material", defaultVisible: true },
    { key: "original_quantity", header: "الكمية الأصلية", width: "w-[90px]", type: "readonly", defaultVisible: true },
    { key: "original_price", header: "السعر الأصلي", width: "w-[90px]", type: "readonly", defaultVisible: true },
    { key: "quantity", header: "كمية المرتجع", width: "w-[90px]", type: "number", defaultVisible: true },
    { key: "unit_price", header: "سعر المرتجع", width: "w-[100px]", type: "number", defaultVisible: true },
    { key: "line_total", header: "الإجمالي", width: "w-[110px]", type: "readonly", defaultVisible: true },
    { key: "notes", header: "ملاحظات", width: "flex-[1]", type: "text", defaultVisible: true },
  ], []);

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
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onAddLine={addLine}
          onSelectMaterial={(idx, mat) => selectMaterial(idx, mat)}
          materials={materials}
          preferenceKey={`${returnType === "SalesReturn" ? "sales" : "purchase"}-returns-editor`}
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
