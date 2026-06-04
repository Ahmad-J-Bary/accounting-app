import { useLocation } from "react-router-dom";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Save, Send, Printer, History, Settings2 } from "lucide-react";
import type { CustomerDto } from "@erp/shared-types";
import { toast } from "sonner";

import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { GenericDocumentGrid, SummaryPanel } from "@widgets/unified-grid";
import { InvoiceList } from '../components/InvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useInvoiceLifecycle } from '../hooks/useInvoiceLifecycle';
import { invoiceService } from "@modules/invoicing/api/invoiceService";

export default function SalesInvoices() {
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
    invoiceType: "Sales",
    partyType: "customer",
    priceField: "last_sale_price"
  });

  const customers = parties as CustomerDto[];

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مبيعات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <>
            {isReadOnly && (
              <Button 
                size="sm" 
                onClick={() => {
                  closeTab(activeTabId);
                  openTab({
                    id: `/sales-invoices/${headerState.id}`,
                    title: `تعديل ${headerState.invoice_number}`,
                    path: `/sales-invoices/${headerState.id}`,
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
            <Button variant="outline" size="sm" onClick={() => window.print()} className="bg-white font-bold border-slate-200">
              <Printer className="w-4 h-4 ml-2 text-slate-500" /> طباعة
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
                type="customer"
                parties={customers}
                selectedId={headerState.customer_id || ""}
                selectedName={headerState.customer_name || "زبون نقدي"}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, customer_id: id, customer_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, customer_id: "", customer_name: "زبون نقدي" }))}
                readOnly={isReadOnly}
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
            preferenceKey="sales_invoice_grid_v2"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
            discount={parseFloat(headerState.discount_amount)}
            tax={parseFloat(headerState.tax_amount)}
            extraCosts={parseFloat(headerState.extra_costs || "0")}
            net={net}
            paid={parseFloat(headerState.paid_amount)}
            currency={displayCurrency}
            invoiceType="Sales"
            currencies={currencies}
            onCurrencyChange={setDisplayCurrency}
            exchangeRate={parseFloat(headerState.exchange_rate)}
            isReadOnly={isReadOnly}
            paymentMethod={headerState.payment_method}
            onPaymentMethodChange={(method) => {
              setHeaderState(s => ({
                ...s,
                payment_method: method,
                paid_amount: method === "cash" ? net.toString() : (method === "credit" ? "0" : s.paid_amount)
              }));
            }}
            paidAmount={headerState.paid_amount}
            onPaidAmountChange={(amount) => setHeaderState(s => ({ ...s, paid_amount: amount }))}
          />
        }
        sidebar={null}
      />
    );
  }

  const searchParams = new URLSearchParams(location.search);
  const customerIdFilter = searchParams.get("customerId") || undefined;

  return (
    <InvoiceList
      invoices={invoices}
      loading={loading || refreshing}
      search={search}
      partyIdFilter={customerIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/sales-invoices/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "فاتورة مبيعات جديدة", path: uniqueId, closable: true });
      }}
      onEdit={(inv) => {
        openTab({ id: `/sales-invoices/${inv.id}`, title: `تعديل ${inv.invoice_number}`, path: `/sales-invoices/${inv.id}`, closable: true });
      }}
      onView={(inv) => {
        openTab({ id: `/sales-invoices/${inv.id}-view`, title: `عرض ${inv.invoice_number}`, path: `/sales-invoices/${inv.id}?mode=view`, closable: true });
      }}
      onPost={(id) => invoiceService.postInvoice(id).then(() => loadData(false))}
      onDelete={(id) => invoiceService.deleteInvoice(id).then(() => loadData(false))}
      onReopen={(id) => invoiceService.reopenInvoice(id).then(() => loadData(false))}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title="فواتير المبيعات"
      createLabel="فاتورة جديدة"
      searchPlaceholder="بحث برقم الفاتورة أو الزبون..."
      emptyMessage="لا توجد فواتير مبيعات مسجّلة"
      statsLabel="إجمالي المبيعات"
      statsColor="text-blue-600"
      preferenceKey="sales_invoices_v2"
    />
  );
}
