import { useState } from "react";
import { useLocation } from "react-router-dom";
import { DocumentToolbar } from "@widgets/document-shell/DocumentToolbar";
import type { CustomerDto } from "@erp/shared-types";

import { HeaderField } from '@shared/ui/header-field';
import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { GenericDocumentGrid, SummaryPanel } from "@widgets/document-shell";
import { InvoiceList } from '../components/InvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useInvoiceLifecycle } from '../hooks/useInvoiceLifecycle';
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { customerService } from "@modules/partners/api/customerService";

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
    dynamicVisibleColumns,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
    warehouses,
  } = useInvoiceLifecycle({
    invoiceType: "Sales",
    partyType: "customer",
    priceField: "last_sale_price"
  });

  const customers = parties as CustomerDto[];
  const [isSearchingParty, setIsSearchingParty] = useState(false);

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مبيعات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <DocumentToolbar
            status={headerState.status}
            isReadOnly={isReadOnly}
            saving={saving}
            onEdit={isReadOnly && headerState.id ? () => {
              closeTab(activeTabId);
              openTab({
                id: `/sales-invoices/${headerState.id}`,
                title: `تعديل ${headerState.invoice_number}`,
                path: `/sales-invoices/${headerState.id}`,
                closable: true,
              });
            } : undefined}
            onSaveDraft={() => handleSave(false)}
            onSaveAndPost={() => handleSave(true)}
            onReopen={handleReopen}
          />
        }
        headerFields={
          <>
            <HeaderField label="رقم الفاتورة" value={headerState.invoice_number} readOnly inputClassName="font-mono font-bold" />

            <HeaderField label="تاريخ الإصدار" type="date" value={headerState.issued_at} onChange={v => setHeaderState(s => ({ ...s, issued_at: v }))} disabled={isReadOnly} inputClassName="font-bold" />

            <HeaderField label="العميل" className="lg:col-span-2">
              <InvoicePartySelector
                type="customer"
                parties={customers}
                selectedId={headerState.customer_id || ""}
                selectedName={headerState.customer_name || "زبون نقدي"}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, customer_id: id, customer_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, customer_id: "", customer_name: "زبون نقدي" }))}
                readOnly={isReadOnly}
                hideLabel
                noBorder
                onSearchActive={setIsSearchingParty}
                onCreateParty={async (name) => {
                  const c = await customerService.create({ code: "", name, phone: null, address: null });
                  loadData(false);
                  return { id: c.id, name: c.name };
                }}
              />
            </HeaderField>

            <HeaderField label="ملاحظات المستند" value={headerState.notes} onChange={v => setHeaderState(s => ({ ...s, notes: v }))} disabled={isReadOnly} placeholder="أدخل أي ملاحظات إضافية هنا..." className="md:col-span-3 lg:col-span-2" />
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
            warehouses={warehouses}
            readOnly={isReadOnly}
            preferenceKey="sales_invoice_grid_v2"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
            dynamicVisibleColumns={dynamicVisibleColumns}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
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
            isCashParty={!isSearchingParty && (!headerState.customer_name || headerState.customer_name === "زبون نقدي")}
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
      showSubtotal={true}
      showDiscountGranted={true}
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
