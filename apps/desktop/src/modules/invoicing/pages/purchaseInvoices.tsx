import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DocumentToolbar } from "@widgets/document-shell/DocumentToolbar";
import type { SupplierDto, CategoryDto, CreateMaterialRequest } from "@erp/shared-types";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { MaterialForm } from "@modules/inventory/components/MaterialForm";
import { toast } from "sonner";

import { HeaderField } from '@shared/ui/header-field';
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
    docSubtotal,
    subtotal,
    net,
    displayCurrency,
    setDisplayCurrency,
    gridColumns,
    dynamicVisibleColumns,
    priceHistoryMap,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
    warehouses,
  } = useInvoiceLifecycle({
    invoiceType: "Purchase",
    partyType: "supplier",
    priceField: "last_purchase_price"
  });

  const suppliers = parties as SupplierDto[];

  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [savingMaterial, setSavingMaterial] = useState(false);

  useEffect(() => {
    categoryService.listCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSaveMaterial = async (data: CreateMaterialRequest) => {
    setSavingMaterial(true);
    try {
      await materialService.createMaterial(data);
      toast.success("تم إضافة المادة بنجاح");
      setMaterialFormOpen(false);
      loadData(false);
    } catch (e) {
      toast.error("فشل إضافة المادة: " + e);
    } finally {
      setSavingMaterial(false);
    }
  };

  if (view === "editor") {
    return (
      <FinancialDocumentTemplate
        title="فاتورة مشتريات"
        statusBadge={<DocumentStatusBadge status={headerState.status} />}
        toolbar={
          <DocumentToolbar
            status={headerState.status}
            isReadOnly={isReadOnly}
            saving={saving}
            onNewMaterial={() => setMaterialFormOpen(true)}
            onEdit={isReadOnly && headerState.id ? () => {
              closeTab(activeTabId);
              openTab({
                id: `/purchase-invoices/${headerState.id}`,
                title: `تعديل فاتورة ${headerState.invoice_number}`,
                path: `/purchase-invoices/${headerState.id}`,
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

            <HeaderField label="المورد" className="lg:col-span-2">
              <InvoicePartySelector
                type="supplier"
                parties={suppliers}
                readOnly={isReadOnly}
                selectedId={headerState.supplier_id || ""}
                selectedName={headerState.supplier_name || "مورد نقدي"}
                onSelect={(id, name) => setHeaderState(s => ({ ...s, supplier_id: id, supplier_name: name }))}
                onClear={() => setHeaderState(s => ({ ...s, supplier_id: "", supplier_name: "مورد نقدي" }))}
                hideLabel
                noBorder
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
            preferenceKey="purchase_invoice_grid"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
            dynamicVisibleColumns={dynamicVisibleColumns}
            priceHistoryMap={priceHistoryMap}
          />
        }
        summaryPanel={
          <SummaryPanel
            subtotal={subtotal}
            tax={parseFloat(headerState.tax_amount)}
            extraCosts={parseFloat(headerState.extra_costs)}
            net={net}
            paid={parseFloat(headerState.paid_amount) + parseFloat(headerState.extra_paid_amount || "0")}
            currency={displayCurrency}
            invoiceType="Purchase"
            currencies={currencies}
            onCurrencyChange={setDisplayCurrency}
            exchangeRate={parseFloat(headerState.exchange_rate)}
            docCurrency={headerState.currency_code}
            docSubtotal={docSubtotal}
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
        sidebar={
          materialFormOpen ? (
            <MaterialForm
              open={materialFormOpen}
              onClose={() => setMaterialFormOpen(false)}
              material={null}
              categories={categories}
              onSave={handleSaveMaterial}
              saving={savingMaterial}
            />
          ) : null
        }
        isSidebarOpen={materialFormOpen}
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
      onEditOpeningBalance={(inv) => {
        openTab({ id: `/opening-balance/${inv.id}`, title: `تعديل بضاعة أول المدة`, path: `/opening-balance/${inv.id}`, closable: true });
      }}
      onViewOpeningBalance={(inv) => {
        openTab({ id: `/opening-balance/${inv.id}-view`, title: `عرض بضاعة أول المدة`, path: `/opening-balance/${inv.id}?mode=view`, closable: true });
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
      showDiscount
      showExtraCosts
    />
  );
}
