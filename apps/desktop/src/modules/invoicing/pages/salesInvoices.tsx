import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentToolbar } from "@widgets/document-shell/DocumentToolbar";
import type { CustomerDto, InvoiceDto } from "@erp/shared-types";
import { toast } from "sonner";

import { HeaderField } from '@shared/ui/header-field';
import { FinancialDocumentTemplate } from '@widgets/templates/FinancialDocumentTemplate';
import { GenericDocumentGrid, SummaryPanel } from "@widgets/document-shell";
import { InvoiceList } from '../components/InvoiceList';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';
import { InvoicePartySelector } from '../components/InvoicePartySelector';
import { useInvoiceLifecycle } from '../hooks/useInvoiceLifecycle';
import { invoiceService } from "@modules/invoicing/api/invoiceService";
import { customerService } from "@modules/partners/api/customerService";
import { invalidateAccountingMutationQueries } from "@shared/hooks/queryClient";
import { useExportSetup } from "@shared/hooks";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { executeExport } from "@shared/lib/excel";
import { buildInvoiceLineExportColumns } from "../lib/invoice-export-columns";

export default function SalesInvoices() {
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const {
    view,
    invoices,
    parties,
    currencies: invoiceCurrencies,
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
    onPartyCreated,
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
  const [gridVisibleColumnIds, setGridVisibleColumnIds] = useState<string[]>([]);

  const { exportData, currencyMode, ratesSheet } = useExportSetup();
  const { currencies: availableCurrencies, hasMultipleCurrencies, convertBetween } = useCurrencyContext();

  const handleExport = useCallback(async () => {
    if (enrichedLines.length === 0) {
      toast.error("لا توجد بنود للتصدير");
      return;
    }

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
      const baseCode = availableCurrencies[0]?.code || '';
      r.discount_value = String(parseFloat(String(r[`discount_value_${baseCode}`] ?? '0')) || 0);
      return r;
    });

    const hiddenColumnIds = gridVisibleColumnIds.length > 0
      ? gridColumns.map(c => c.key).filter(k => !gridVisibleColumnIds.includes(k))
      : gridColumns.filter(c => c.defaultVisible === false).map(c => c.key);

    const columns = buildInvoiceLineExportColumns({
      gridColumns,
      hiddenColumnIds,
      currencies: availableCurrencies,
      hasMultipleCurrencies,
      materials: materialList,
      warehouses,
      currencyMode,
    });

    const summary: Record<string, string> = {};
    const baseCode = availableCurrencies[0]?.code || '';
    availableCurrencies.forEach(c => {
      const suffix = c.code === baseCode ? '' : `_${c.code}`;
      summary[`line_total_${c.code}`] = 'subtotal';
      summary[`discount_value${suffix}`] = 'subtotal';
      summary[`cost_price_${c.code}`] = 'subtotal';
      summary[`profit_amount_${c.code}`] = 'subtotal';
    });
    summary.discount = `IFERROR({col('discount_value')}{summaryRow}/({col('discount_value')}{summaryRow}+{col('line_total_${baseCode}')}{summaryRow})*100,0)`;

    const paidVal = parseFloat(headerState.paid_amount || "0");
    const remainingVal = net - paidVal;

    await executeExport(exportData, {
      sheetName: "فاتورة مبيعات",
      filename: `فاتورة_مبيعات_${headerState.invoice_number}`,
      data: enrichedForExport,
      columns,
      summary,
      summaryLabel: "المجموع",
      additionalSummary: [
        { label: "طريقة الدفع / التسوية", value: headerState.payment_method === "Deferred" ? "آجل" : "نقدي" },
        { label: "الضريبة", value: parseFloat(headerState.tax_amount) || 0 },
        { label: "التكاليف الإضافية", value: parseFloat(headerState.extra_costs || "0") || 0 },
        { label: "المجموع الكلي (الصافي)", value: net },
        { label: "المبلغ المدفوع", value: paidVal },
        { label: "المبلغ المتبقي", value: remainingVal }
      ],
      currencyRatesSheet: ratesSheet,
    });
  }, [exportData, availableCurrencies, hasMultipleCurrencies, enrichedLines, headerState, net, gridColumns, gridVisibleColumnIds, materials, warehouses, currencyMode, ratesSheet]);

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
      const baseCode = availableCurrencies[0]?.code || '';
      enriched.discount_value = String(parseFloat(String(enriched[`discount_value_${baseCode}`] ?? '0')) || 0);
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

    const summary: Record<string, string> = {};
    const baseCode = availableCurrencies[0]?.code || '';
    availableCurrencies.forEach(c => {
      const suffix = c.code === baseCode ? '' : `_${c.code}`;
      summary[`line_total_${c.code}`] = 'subtotal';
      summary[`discount_value${suffix}`] = 'subtotal';
      summary[`cost_price_${c.code}`] = 'subtotal';
      summary[`profit_amount_${c.code}`] = 'subtotal';
    });
    summary.discount = `IFERROR({col('discount_value')}{summaryRow}/({col('discount_value')}{summaryRow}+{col('line_total_${baseCode}')}{summaryRow})*100,0)`;

    const subtotalVal = parseFloat(fullInv.subtotal_amount || "0");
    const discountVal = parseFloat(fullInv.discount_amount || "0");
    const extraCostsVal = parseFloat(fullInv.extra_costs || "0");
    const netVal = subtotalVal - discountVal + extraCostsVal;
    const paidVal = parseFloat(fullInv.amount_paid || "0");
    const remainingVal = netVal - paidVal;

    await executeExport(exportData, {
      sheetName: "فاتورة مبيعات",
      filename: `فاتورة_مبيعات_${fullInv.invoice_number}`,
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
            onExport={handleExport}
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
                  onPartyCreated(c);
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
            onVisibleColumnsChange={setGridVisibleColumnIds}
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
            currencies={invoiceCurrencies}
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
      onPost={async (id) => {
        await invoiceService.postInvoice(id);
        await invalidateAccountingMutationQueries(queryClient);
        await loadData(false);
      }}
      onDelete={async (id) => {
        await invoiceService.deleteInvoice(id);
        await invalidateAccountingMutationQueries(queryClient);
        await loadData(false);
      }}
      onReopen={async (id) => {
        await invoiceService.reopenInvoice(id);
        await invalidateAccountingMutationQueries(queryClient);
        await loadData(false);
      }}
      formatMonetaryAmount={formatMonetaryAmount}
      onExportRow={handleExportRow}
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
