import { useLocation } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, History, Settings2 } from "lucide-react";
import type { SupplierDto } from "@erp/shared-types";
import { toast } from "sonner";

import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { InvoiceList } from "../components/InvoiceList";
import { useInvoiceLifecycle } from "../hooks/useInvoiceLifecycle";
import { invoiceService } from "@modules/invoicing/api/invoiceService";

export default function PurchaseInvoices() {
  const location = useLocation();
  
  const {
    view,
    invoices,
    parties,
    currencies,
    materials,
    loading,
    refreshing,
    saving,
    search,
    setSearch,
    headerState,
    setHeaderState,
    updateLine,
    removeLine,
    addLine,
    selectMaterial,
    isReadOnly,
    loadData,
    handleSave,
    handleReopen,
    enrichedLines,
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency,
    gridColumns,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
  } = useInvoiceLifecycle({
    invoiceType: "Purchase",
    partyType: "supplier",
    priceField: "last_purchase_price"
  });

  const suppliers = parties as SupplierDto[];

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مشتريات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <>
            {isReadOnly && (
              <Button 
                size="sm" 
                onClick={() => {
                  closeTab(activeTabId);
                  openTab({
                    id: `/purchase-invoices/${headerState.id}`,
                    title: `تعديل فاتورة ${headerState.invoice_number}`,
                    path: `/purchase-invoices/${headerState.id}`,
                    closable: true
                  });
                }}
                className="bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 font-bold"
              >
                <Settings2 className="w-4 h-4 ml-2" /> تعديل الفاتورة
              </Button>
            )}
            
            {headerState.status === "Posted" && !isReadOnly ? (
              <>
                <Button 
                  size="sm" 
                  onClick={() => handleSave(true)} 
                  disabled={saving} 
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 font-bold"
                >
                  <Send className="w-4 h-4 ml-2" /> حفظ وترحيل التعديلات
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReopen}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
                >
                  <History className="w-4 h-4 ml-2" /> إلغاء الترحيل
                </Button>
              </>
            ) : headerState.status !== "Posted" && !isReadOnly ? (
              <>
                <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="bg-white border-slate-200 text-slate-700 font-bold">
                  <Save className="w-4 h-4 ml-2" /> {saving ? "جاري الحفظ..." : "حفظ مسودة"}
                </Button>
                <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
                  <Send className="w-4 h-4 ml-2" /> ترحيل الفاتورة
                </Button>
              </>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white">
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </>
        }
        headerFields={
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">رقم الفاتورة</label>
              <Input value={headerState.invoice_number} readOnly className="h-9 font-mono font-bold bg-slate-50 border-slate-200" />
            </div>
            
            <div className="md:col-span-2 space-y-1">
              <InvoicePartySelector
                type="supplier"
                parties={suppliers}
                readOnly={isReadOnly}
                selectedId={headerState.supplier_id || ""}
                selectedName={headerState.supplier_name || "مورد نقدي"}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, supplier_id: id, supplier_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, supplier_id: "", supplier_name: "مورد نقدي" }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الإصدار</label>
              <Input type="date" disabled={isReadOnly} value={headerState.issued_at} onChange={e => setHeaderState(s => ({ ...s, issued_at: e.target.value }))} className="h-9 font-bold border-slate-200 disabled:opacity-100 disabled:bg-slate-50 disabled:cursor-not-allowed" />
            </div>
            
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات المستند</label>
              <Input placeholder="أدخل أي ملاحظات إضافية هنا..." disabled={isReadOnly} value={headerState.notes} onChange={e => setHeaderState(s => ({ ...s, notes: e.target.value }))} className="h-9 border-slate-200 disabled:opacity-100 disabled:bg-slate-50 disabled:cursor-not-allowed" />
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
            readOnly={isReadOnly}
            preferenceKey="purchase_invoice_grid"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            extraCosts={parseFloat(headerState.extra_costs)}
            net={net}
            paid={parseFloat(headerState.paid_amount) + parseFloat(headerState.extra_paid_amount || "0")}
            currency={displayCurrency}
            invoiceType="Purchase"
            currencies={currencies}
            onCurrencyChange={setDisplayCurrency}
            exchangeRate={parseFloat(headerState.exchange_rate)}
            isReadOnly={isReadOnly}
            paymentMethod={headerState.payment_method}
            onPaymentMethodChange={(method) => {
              setHeaderState(s => ({ ...s, payment_method: method }));
            }}
            paidAmount={headerState.paid_amount}
            onPaidAmountChange={(amount) => setHeaderState(s => ({ ...s, paid_amount: amount }))}
            onExtraCostsChange={(value) => setHeaderState(s => ({ ...s, extra_costs: value }))}
            extraPaidAmount={headerState.extra_paid_amount}
            onExtraPaidAmountChange={(amount) => setHeaderState(s => ({ ...s, extra_paid_amount: amount }))}
          />
        }
        sidebar={null}
      />
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const supplierIdFilter = searchParams.get("supplierId") || undefined;

  return (
    <InvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      partyIdFilter={supplierIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/purchase-invoices/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "فاتورة مشتريات جديدة", path: uniqueId, closable: true });
      }}
      onEdit={(inv) => {
        openTab({ id: `/purchase-invoices/${inv.id}`, title: `تعديل فاتورة ${inv.invoice_number}`, path: `/purchase-invoices/${inv.id}`, closable: true });
      }}
      onView={(inv) => {
        openTab({ id: `/purchase-invoices/${inv.id}-view`, title: `عرض فاتورة ${inv.invoice_number}`, path: `/purchase-invoices/${inv.id}?mode=view`, closable: true });
      }}
      onPost={async (id) => { await invoiceService.postInvoice(id); loadData(false); }}
      onDelete={async (id) => {
        try { await invoiceService.deleteInvoice(id); toast.success("تم حذف الفاتورة والقيود المرتبطة بها"); loadData(false); }
        catch (e) { toast.error("فشل الحذف: " + e); }
      }}
      onReopen={async (id) => {
        try { await invoiceService.reopenInvoice(id); toast.success("تم إلغاء الترحيل وإعادة الفاتورة لمسودة"); loadData(false); }
        catch (e) { toast.error("فشل العملية: " + e); }
      }}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="supplier"
      title="فواتير المشتريات"
      createLabel="فاتورة جديدة"
      searchPlaceholder="بحث برقم الفاتورة أو المورد..."
      emptyMessage="لا توجد فواتير مشتريات مسجّلة"
      statsLabel="إجمالي المشتريات"
      statsColor="text-rose-600"
      preferenceKey="purchase_invoices"
      showSubtotal
      showExtraCosts
    />
  );
}
