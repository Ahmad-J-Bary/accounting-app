import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
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
import { useDocumentFinancials } from "@modules/invoicing/lib/useDocumentFinancials";

interface HeaderState {
  docNumber: string;
  issued_at: string;
  notes: string;
  currency_code: string;
  exchange_rate: string;
}

const defaultHeader = (): HeaderState => ({
  docNumber: "...",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "مواد أول المدة- رصيد افتتاحي للمواد",
  currency_code: "USD",
  exchange_rate: "1",
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
  
  const { currencies, rateMap } = useCurrencyContext();

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
    loadData(); 
    if (isNew) {
      invoiceService.getNextInvoiceNumber("OpeningBalance").then(num => {
        setHeader(s => ({ ...s, docNumber: num }));
      });
      // Use real exchange rate from rateMap instead of hardcoded "1"
      const rate = rateMap.get("SYP");
      if (rate) {
        setHeader(s => ({ ...s, exchange_rate: rate.toString() }));
      }
    }
  }, [loadData, isNew, rateMap]);

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
        currency_code: header.currency_code,
        exchange_rate: header.exchange_rate,
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

  const extraCols = useMemo<DocumentColumn[]>(() => [
    { key: "cost_price", header: "التكلفة ($)", width: "w-[90px]", align: "left", type: "readonly" },
    { key: "retail_price", header: "مفرق", width: "w-[90px]", align: "left", type: "number" },
    { key: "wholesale_price", header: "جملة", width: "w-[90px]", align: "left", type: "number" }
  ], []);

  // Adapt header for hook compatibility
  const headerShim = useMemo(() => ({
    currency_code: header.currency_code,
    exchange_rate: header.exchange_rate,
    discount_amount: "0",
    tax_amount: "0",
    extra_costs: "0",
    paid_amount: "0"
  }), [header.currency_code, header.exchange_rate]);

  const { 
    enrichedLines, 
    docSubtotal,
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency,
    gridColumns 
  } = useDocumentFinancials({
    lines,
    setLines,
    headerState: headerShim,
    setHeaderState: () => {}, // Not needed for opening balance yet
    currencies,
    invoiceType: "OpeningBalance",
    priceLabel: "التكلفة",
    extraColumns: extraCols
  });

  // Removed duplicate state logic

  return (
    <FinancialDocumentTemplate
      title="بضاعة أول المدة"
      statusBadge={<DocumentStatusBadge status="Draft" />}
      toolbar={
        <>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
            <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ وترحيل الرصيد"}
          </Button>
        </>
      }
      headerFields={
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">رقم القيد</label>
            <Input value={header.docNumber} readOnly className="h-9 font-mono font-bold bg-muted border-border" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">التاريخ</label>
            <Input type="date" value={header.issued_at} onChange={e => setHeader(s => ({ ...s, issued_at: e.target.value }))} className="h-9 font-bold border-border" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black text-muted-foreground uppercase">ملاحظات</label>
            <Input placeholder="أدخل أي ملاحظات هنا..." value={header.notes} onChange={e => setHeader(s => ({ ...s, notes: e.target.value }))} className="h-9 border-border" />
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
          subtotal={subtotal}
          discount={0}
          tax={0}
          extraCosts={0}
          net={net}
          currency={displayCurrency}
          status="Draft"
          invoiceType="OpeningBalance"
          currencies={currencies}
          onCurrencyChange={setDisplayCurrency}
          exchangeRate={parseFloat(header.exchange_rate)}
        >
        </SummaryPanel>
      }
      sidebar={null}
    />
  );
}