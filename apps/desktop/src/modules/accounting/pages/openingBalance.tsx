import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTabs } from '@app/providers/TabContext';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save } from "lucide-react";
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid, type DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { DocumentStatusBadge } from "@modules/invoicing/components/DocumentStatusBadge";
import { useDocumentEditor } from "@modules/invoicing/hooks/useDocumentEditor";
import { toBackendLines } from "@modules/invoicing/lib/invoiceUtils";
import { useDocumentFinancials } from "@modules/invoicing/lib/useDocumentFinancials";

interface HeaderState {
  docNumber: string;
  issued_at: string;
  notes: string;
  currency_code: string;
  exchange_rate: string;
}

const defaultHeader = (baseCode?: string): HeaderState => ({
  docNumber: "...",
  issued_at: new Date().toISOString().split("T")[0],
  notes: "مواد أول المدة- رصيد افتتاحي للمواد",
  currency_code: baseCode || "",
  exchange_rate: "1",
});

export default function OpeningBalance() {
  const location = useLocation();
  const { closeTab, activeTabId, openTab } = useTabs();
  
  const [materials, setMaterials] = useState<MaterialDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { currencies, rateMap, baseCurrency } = useCurrencyContext();
  const [header, setHeader] = useState<HeaderState>(defaultHeader(baseCurrency?.code));
  const { lines, setLines, updateLine, removeLine, addLine, selectMaterial, totals } = useDocumentEditor({ 
    priceField: "last_purchase_price",
    materials
  });
  
  const isNew = location.pathname.includes("/new") || !location.pathname.includes("/edit");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const mats = await materialService.listMaterials();
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
      const rate = rateMap.get(baseCurrency?.code);
      if (rate) {
        setHeader(s => ({ ...s, exchange_rate: rate.toString() }));
      }
    }
  }, [loadData, isNew, rateMap, baseCurrency?.code]);

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
      
      closeTab(activeTabId);
      openTab({
        id: 'purchase-invoices',
        title: 'فواتير المشتريات',
        path: '/purchase-invoices',
        closable: true,
      });
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const extraCols = useMemo<DocumentColumn[]>(() => {
    const foreignCurr = (currencies || []).find(c => c.code !== baseCurrency?.code);
    const baseSym = baseCurrency?.symbol || baseCurrency?.code || "ل.س";
    const foreignSym = foreignCurr?.symbol || foreignCurr?.code || "$";
    return [
      { key: "retail_price", header: `مفرق (${foreignSym})`, width: "w-[90px]", align: "left", type: "number" },
      { key: "retail_price_SYP", header: `مفرق (${baseSym})`, width: "w-[90px]", align: "left", type: "number" },
      { key: "wholesale_price", header: `جملة (${foreignSym})`, width: "w-[90px]", align: "left", type: "number" },
      { key: "wholesale_price_SYP", header: `جملة (${baseSym})`, width: "w-[90px]", align: "left", type: "number" },
    ];
  }, [currencies, baseCurrency]);

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
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency,
    gridColumns 
  } = useDocumentFinancials({
    lines,
    setLines,
    headerState: headerShim,
    setHeaderState: () => {},
    currencies,
    invoiceType: "OpeningBalance",
    priceLabel: "التكلفة",
    extraColumns: extraCols
  });

  return (
    <FinancialDocumentTemplate
      title="بضاعة أول المدة"
      statusBadge={<DocumentStatusBadge status="Draft" />}
      toolbar={
        <>
          <Button size="sm" onClick={handleSave} disabled={saving || loading} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
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
          docCurrency={header.currency_code}
          exchangeRate={header.exchange_rate}
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
          invoiceType="OpeningBalance"
          currencies={currencies}
          onCurrencyChange={setDisplayCurrency}
          exchangeRate={parseFloat(header.exchange_rate)}
        />
      }
      sidebar={null}
    />
  );
}