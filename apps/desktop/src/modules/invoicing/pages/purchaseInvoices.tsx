import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentToolbar } from "@widgets/document-shell/DocumentToolbar";
import type { SupplierDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, InvoiceDto } from "@erp/shared-types";
import { materialService } from "@modules/inventory/api/materialService";
import { categoryService } from "@modules/inventory/api/categoryService";
import { MaterialForm } from "@modules/inventory/components/MaterialForm";
import { toast } from "sonner";
import { useExportSetup } from "@shared/hooks";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { executeExport } from "@shared/lib/excel";

import { HeaderField } from '@shared/ui/header-field';
import { FinancialDocumentTemplate } from "@widgets/templates/FinancialDocumentTemplate";
import { GenericDocumentGrid } from "@widgets/document-shell/GenericDocumentGrid";
import { SummaryPanel } from "@widgets/document-shell/SummaryPanel";
import { InvoicePartySelector } from "../components/InvoicePartySelector";
import { DocumentStatusBadge } from "../components/DocumentStatusBadge";
import { InvoiceList } from "../components/InvoiceList";
import { useInvoiceLifecycle } from "../hooks/useInvoiceLifecycle";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { supplierService } from "@modules/partners/api/supplierService";
import { invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";
import { buildInvoiceLineExportColumns } from "../lib/invoice-export-columns";
export default function PurchaseInvoices() {
  const location = useLocation();
  const queryClient = useQueryClient();
  
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
    onPartyCreated,
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
  const [isSearchingParty, setIsSearchingParty] = useState(false);

  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [gridVisibleColumnIds, setGridVisibleColumnIds] = useState<string[]>([]);

  useEffect(() => {
    categoryService.list().then(setCategories).catch(() => {});
  }, []);

  const handleSaveMaterial = async (data: CreateMaterialRequest | UpdateMaterialRequest) => {
    setSavingMaterial(true);
    try {
      await materialService.create(data as CreateMaterialRequest);
      toast.success("تم إضافة المادة بنجاح");
      setMaterialFormOpen(false);
      loadData(false);
    } catch (e) {
      toast.error("فشل إضافة المادة: " + e);
    } finally {
      setSavingMaterial(false);
    }
  };

  const { exportData, currencyMode, ratesSheet } = useExportSetup();
  const { hasMultipleCurrencies, currencies: availableCurrencies, convertBetween } = useCurrencyContext();

  const handleExport = useCallback(async () => {
    if (enrichedLines.length === 0) {
      toast.error("لا توجد بنود للتصدير");
      return;
    }

    // Enrich lines with material info for export
    const materialList = Object.values(materials);
    const materialMap = new Map(materialList.map(m => [m.id, m]));
    const enrichedForExport = enrichedLines.map(line => {
      const r = { ...line } as Record<string, unknown>;
      const mat = materialMap.get(String(line.material_id));
      if (mat) {
        r.material_image = mat.image_path || null;
        r.material_code = mat.code || '';
        r.name_en = mat.name_en || '';
        r.unit_barcode = mat.barcode || '';
      }
      return r;
    });

    const hiddenColumnIds = gridVisibleColumnIds.length > 0
      ? gridColumns.map(c => c.key).filter(k => !gridVisibleColumnIds.includes(k))
      : gridColumns.filter(c => c.defaultVisible === false).map(c => c.key);

    const columns = buildInvoiceLineExportColumns({
      gridColumns,
      hiddenColumnIds,
      currencies,
      hasMultipleCurrencies,
      materials: materialList,
      warehouses,
      currencyMode,
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    const baseCode = currencies[0]?.code || '';
    currencies.forEach(c => {
      const suffix = c.code === baseCode ? '' : `_${c.code}`;
      summary[`line_total_${c.code}`] = 'subtotal';
      summary[`discount_value${suffix}`] = 'subtotal';
    });

    const paidVal = parseFloat(headerState.paid_amount) + parseFloat(headerState.extra_paid_amount || "0");
    const remainingVal = net - paidVal;

    await executeExport(exportData, {
      sheetName: "فاتورة مشتريات",
      filename: `فاتورة_مشتريات_${headerState.invoice_number}`,
      data: enrichedForExport,
      columns,
      summary,
      summaryLabel: "المجموع",
      additionalSummary: [
        { label: "طريقة الدفع / التسوية", value: headerState.payment_method === "Deferred" ? "آجل" : "نقدي" },
        { label: "الضريبة", value: parseFloat(headerState.tax_amount) || 0 },
        { label: "التكاليف الإضافية", value: parseFloat(headerState.extra_costs) || 0 },
        { label: "المجموع الكلي (الصافي)", value: net },
        { label: "المبلغ المدفوع", value: paidVal },
        { label: "المبلغ المتبقي", value: remainingVal }
      ],
      currencyRatesSheet: ratesSheet,
    });
  }, [exportData, currencies, hasMultipleCurrencies, enrichedLines, headerState, net, gridColumns, gridVisibleColumnIds, materials, warehouses, currencyMode, ratesSheet]);

  const handleExportRow = useCallback(async (inv: InvoiceDto) => {
    const fullInv = await invoiceService.getInvoiceById(inv.id);
    const materialList = Object.values(materials);
    const materialMap = new Map(materialList.map(m => [m.id, m]));
    const warehouseMap = new Map(warehouses.map(w => [w.id, w]));

    const enrichedLines = fullInv.lines.map(line => {
      const enriched = { ...line } as Record<string, unknown>;
      const mat = materialMap.get(line.material_id);
      if (mat) {
        enriched.material_image = mat.image_path || null;
        enriched.material_code = mat.code || '';
        enriched.name_en = mat.name_en || '';
        enriched.unit_barcode = mat.barcode || '';
      }
      const whId = line.warehouse_id;
      if (whId) enriched.warehouse_name = warehouseMap.get(whId)?.name || whId;

      const qty = parseFloat(line.quantity || "0");
      const price = parseFloat(line.unit_price || "0");
      availableCurrencies.forEach(curr => {
        const convertedPrice = fullInv.currency_code === curr.code
          ? price
          : convertBetween(price, fullInv.currency_code, curr.code);
        enriched[`unit_price_${curr.code}`] = convertedPrice.toFixed(curr.decimals);
        enriched[`line_total_${curr.code}`] = (convertedPrice * qty).toFixed(curr.decimals);
        const discPct = parseFloat(String(line.discount_percent || '0'));
        enriched[`discount_value_${curr.code}`] = (qty * convertedPrice * discPct / 100).toFixed(curr.decimals);
      });
      return enriched;
    });

    const hiddenColumnIds = gridColumns.filter(c => c.defaultVisible === false).map(c => c.key);

    const columns = buildInvoiceLineExportColumns({
      gridColumns,
      hiddenColumnIds,
      currencies: availableCurrencies,
      hasMultipleCurrencies,
      materials: materialList,
      warehouses,
      currencyMode,
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    const baseCode = availableCurrencies[0]?.code || '';
    availableCurrencies.forEach(c => {
      const suffix = c.code === baseCode ? '' : `_${c.code}`;
      summary[`line_total_${c.code}`] = 'subtotal';
      summary[`discount_value${suffix}`] = 'subtotal';
    });

    const subtotalVal = parseFloat(fullInv.subtotal_amount || "0");
    const discountVal = parseFloat(fullInv.discount_amount || "0");
    const extraCostsVal = parseFloat(fullInv.extra_costs || "0");
    const netVal = subtotalVal - discountVal + extraCostsVal;
    const paidVal = parseFloat(fullInv.amount_paid || "0");
    const remainingVal = netVal - paidVal;

    await executeExport(exportData, {
      sheetName: "فاتورة مشتريات",
      filename: `فاتورة_مشتريات_${fullInv.invoice_number}`,
      data: enrichedLines,
      columns,
      summary,
      summaryLabel: "المجموع",
      additionalSummary: [
        { label: "طريقة الدفع / التسوية", value: fullInv.payment_method === "Deferred" ? "آجل" : "نقدي" },
        { label: "المجموع الكلي (الصافي)", value: netVal },
        { label: "المبلغ المدفوع", value: paidVal },
        { label: "المبلغ المتبقي", value: remainingVal }
      ],
      currencyRatesSheet: ratesSheet,
    });
  }, [exportData, availableCurrencies, hasMultipleCurrencies, convertBetween, materials, warehouses, gridColumns, currencyMode, ratesSheet]);

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
            onExport={handleExport}
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
                onSearchActive={setIsSearchingParty}
                onCreateParty={async (name) => {
                  const s = await supplierService.create({ code: "", name, phone: null, address: null });
                  onPartyCreated(s);
                  return { id: s.id, name: s.name };
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
            preferenceKey="purchase_invoice_grid"
            docCurrency={headerState.currency_code}
            exchangeRate={headerState.exchange_rate}
            dynamicVisibleColumns={dynamicVisibleColumns}
            priceHistoryMap={priceHistoryMap}
            onVisibleColumnsChange={setGridVisibleColumnIds}
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
            isCashParty={!isSearchingParty && (!headerState.supplier_name || headerState.supplier_name === "مورد نقدي")}
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
      onPost={async (id) => {
        await invoiceService.postInvoice(id);
        await invalidateAccountingMutationQueries(queryClient);
        await loadData(false);
      }}
      onDelete={async (id) => {
        try {
          await invoiceService.deleteInvoice(id);
          await invalidateAccountingMutationQueries(queryClient);
          toast.success("تم حذف الفاتورة والقيود المرتبطة بها");
          await loadData(false);
        }
        catch (e) { toast.error("فشل الحذف: " + e); }
      }}
      onReopen={async (id) => {
        try {
          await invoiceService.reopenInvoice(id);
          await invalidateAccountingMutationQueries(queryClient);
          toast.success("تم إلغاء الترحيل وإعادة الفاتورة لمسودة");
          await loadData(false);
        }
        catch (e) { toast.error("فشل العملية: " + e); }
      }}
      formatMonetaryAmount={formatMonetaryAmount}
      onExportRow={handleExportRow}
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
