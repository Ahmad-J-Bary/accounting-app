import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Package } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { materialService } from '@modules/inventory/api/materialService';
import type { InvoiceDto, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

// Unified Components
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { DocumentStatusBadge } from "@modules/invoicing/components/DocumentStatusBadge";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { toBackendLines, type GridLine } from "@modules/invoicing/lib/invoiceUtils";

interface HeaderState {
  docNumber: string;
  issued_at: string;
  notes: string;
  currencyCode: string;
  exchangeRate: string;
}

const defaultHeader = (): HeaderState => ({
  docNumber: "...",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "مواد أول المدة- رصيد افتتاحي للمواد",
  currencyCode: "USD",
  exchangeRate: "1",
});

export default function OpeningBalance() {
  const location = useLocation();
  const { closeTab, activeTabId } = useTabs();
  
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [header, setHeader] = useState<HeaderState>(defaultHeader());
  const { lines, setLines, updateLine, removeLine, addLine, selectMaterial, totals } = useDocumentEditor({ 
    priceField: "last_purchase_price",
    materials
  });
  
  const { formatAmount, convertFromBase, currencies, baseCurrency } = useCurrencyContext();

  const { id } = useParams();
  const isNew = !id || location.pathname.includes("/new");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mats] = await Promise.all([
        materialService.listMaterials(),
      ]);
      setMaterials(mats);
    } catch (e: unknown) {
      toast.error("فشل تحميل البيانات: " + e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    // Refresh data and get next invoice number on mount
    loadData(); 
    if (isNew) {
      invoiceService.getNextInvoiceNumber("OpeningBalance").then(num => {
        setHeader(s => ({ ...s, docNumber: num }));
      });
    }
  }, [loadData, isNew]);

  const handleSave = async () => {
    if (lines.length === 0) {
      toast.error("أضف صنفاً واحداً على الأقل");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        invoice_number: header.docNumber,
        invoice_type: "OpeningBalance",
        lines: toBackendLines(lines),
        tax_amount: "0",
        discount_amount: "0",
        payment_method: "Deferred",
        amount_paid: "0",
        issued_at: new Date(header.issued_at).toISOString(),
        currency_code: header.currencyCode,
        exchange_rate: header.exchangeRate,
        notes: header.notes || undefined,
      };

      const result = await invoiceService.createInvoice(payload);
      await invoiceService.postInvoice(result.id);
      toast.success("تم ترحيل الرصيد الافتتاحي للمخزون بنجاح");
      
      if (isNew) {
        closeTab(activeTabId);
      } else {
        setHeader(defaultHeader());
        setLines([]);
        loadData();
      }
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const enrichedLines = useMemo(() => {
    return lines.map((line: GridLine) => {
      type EnrichedLine = GridLine & Record<string, string | number>;
      const enriched = { ...line } as EnrichedLine;
      const docPrice = parseFloat(line.unit_price || "0");
      const docTotal = (parseFloat(line.quantity || "0") * docPrice);
      
      currencies.forEach(curr => {
        const price = convertFromBase(docPrice, curr.code);
        const total = convertFromBase(docTotal, curr.code);
        enriched[`unit_price_${curr.code}`] = price.toFixed(2);
        enriched[`line_total_${curr.code}`] = formatAmount(total, { currencyCode: curr.code, hideSymbol: true });
      });
      return enriched;
    });
  }, [lines, currencies, convertFromBase, formatAmount]);

  const gridColumns = useMemo<DocumentColumn[]>(() => {
    const cols: DocumentColumn[] = [
      { key: "material_code", header: "الكود", width: "w-[100px]", align: "center", type: "material_code" },
      { key: "unit_barcode", header: "الباركود", width: "w-[120px]", align: "center", type: "material_barcode" },
      { key: "material_name", header: "الصنف (عربي)", width: "flex-[2]", align: "right", type: "material" },
      { key: "name_en", header: "الصنف (EN)", width: "flex-[1.5]", align: "left", type: "readonly" },
      { key: "quantity", header: "الكمية", width: "w-[80px]", align: "center", type: "number" },
      { key: "unit_name", header: "الوحدة", width: "w-[70px]", align: "center", type: "unit_select" },
    ];

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: curr.is_base ? "unit_price" : `unit_price_${curr.code}`, 
        header: `التكلفة (${s})`, 
        width: "w-[100px]", 
        align: "left", 
        type: curr.is_base ? "number" : "readonly" 
      });
    });

    cols.push({ key: "retail_price", header: "مفرق", width: "w-[90px]", align: "left", type: "number" });
    cols.push({ key: "wholesale_price", header: "جملة", width: "w-[90px]", align: "left", type: "number" });

    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ 
        key: `line_total_${curr.code}`, 
        header: `القيمة (${s})`, 
        width: "w-[110px]", 
        align: "left", 
        type: "readonly" 
      });
    });

    return cols;
  }, [currencies]);

  return (
    <FinancialDocumentTemplate
      title="بضاعة أول المدة"
      statusBadge={<DocumentStatusBadge status="Draft" />}
      toolbar={
        <>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ وترحيل الرصيد"}
          </Button>
        </>
      }
      headerFields={
        <>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">رقم القيد</label>
            <Input value={header.docNumber} readOnly className="h-10 font-mono font-bold bg-slate-50 border-slate-200" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">التاريخ</label>
            <Input type="date" value={header.issued_at} onChange={e => setHeader(s => ({ ...s, issued_at: e.target.value }))} className="h-10 font-bold border-slate-200" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات</label>
            <Input placeholder="أدخل أي ملاحظات هنا..." value={header.notes} onChange={e => setHeader(s => ({ ...s, notes: e.target.value }))} className="h-10 border-slate-200" />
          </div>
        </>
      }
      lineItemsGrid={
          <GenericDocumentGrid
            columns={gridColumns}
            lines={enrichedLines}
            onUpdateLine={updateLine}
            onRemoveLine={removeLine}
            onAddLine={addLine}
            onSelectMaterial={selectMaterial}
            materials={Object.values(materials)}
            preferenceKey="opening_balance_grid"
          />
      }
      summaryPanel={
        <SummaryPanel
          subtotal={totals.subtotal}
          discount={0}
          tax={0}
          extraCosts={0}
          net={totals.subtotal}
          currency={header.currencyCode}
          status="Draft"
          invoiceType="OpeningBalance"
        >
          <div className="pt-2 border-t border-slate-100 space-y-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">العملة وسعر الصرف</label>
                <select
                  value={header.currencyCode}
                  onChange={e => setHeader(s => ({ ...s, currencyCode: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 font-bold text-xs"
                >
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.code})</option>
                  ))}
                </select>
                {header.currencyCode !== baseCurrency?.code && (
                  <Input
                    type="number"
                    value={header.exchangeRate}
                    onChange={e => setHeader(s => ({ ...s, exchangeRate: e.target.value }))}
                    className="mt-2 h-8 text-left font-mono font-bold text-xs"
                    placeholder="سعر الصرف"
                  />
                )}
             </div>
          </div>
        </SummaryPanel>
      }
      sidebar={null}
    />
  );
}