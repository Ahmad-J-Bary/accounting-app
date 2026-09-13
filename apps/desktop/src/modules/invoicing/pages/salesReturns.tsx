import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";
import { useExportSetup } from "@shared/hooks";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { executeExport, addCurrencySummary } from "@shared/lib/excel";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { buildInvoiceLineExportColumns } from "../lib/invoice-export-columns";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";

export default function SalesReturns() {
  const { t } = useLocalization();
  const location = useLocation();

  const {
    view,
    isReadOnly,
    returns,
    parties,
    materials,
    warehouses,
    loading,
    refreshing,
    search,
    setSearch,
    loadData,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
    editingReturn,
  } = useReturnLifecycle({
    returnType: "SalesReturn",
    partyType: "customer",
  });

  const searchParams = new URLSearchParams(location.search);
  const customerIdFilter = searchParams.get("customerId") || undefined;

  const { exportData, currencyMode, baseCode, ratesSheet } = useExportSetup();
  const { currencies: availableCurrencies, hasMultipleCurrencies, convertBetween } = useCurrencyContext();

  const handleDelete = useCallback(async (id: string) => {
    try {
      await returnService.deleteSalesReturn(id);
      toast.success(t("return.deleteSuccess", { namespace: "invoicing", fallback: "تم حذف المرتجع بنجاح" }));
      loadData(false);
    } catch (e) {
      toast.error(t("return.deleteError", { namespace: "invoicing", vars: { error: String(e) }, fallback: "فشل الحذف: {{error}}" }));
    }
  }, [loadData, t]);

  const handleExportRow = useCallback(async (ret: SalesReturnDto | PurchaseReturnDto) => {
    const fullReturn = await returnService.getSalesReturn(ret.id);
    const rawLines = fullReturn.lines || [];

    const materialMap = new Map(materials.map(m => [m.id, m]));

    const enrichedLines = rawLines.map(line => {
      const enriched = { ...line } as Record<string, unknown>;
      const mat = materialMap.get(line.material_id);
      if (mat) {
        enriched.material_image = mat.image_path || null;
        enriched.material_code = mat.code || '';
        enriched.name_en = mat.name_en || '';
        enriched.unit_barcode = mat.barcode || '';
      }

      const qty = parseFloat(line.quantity || "0");
      const price = parseFloat(line.unit_price || "0");
      availableCurrencies.forEach(curr => {
        const convertedPrice = baseCode === curr.code
          ? price
          : convertBetween(price, baseCode, curr.code);
        const priceKey = baseCode === curr.code ? 'unit_price' : `unit_price_${curr.code}`;
        if (baseCode !== curr.code) enriched[priceKey] = convertedPrice.toFixed(curr.decimals);
        enriched[`line_total_${curr.code}`] = (convertedPrice * qty).toFixed(curr.decimals);
      });
      return enriched;
    });

    const returnCols: DocumentColumn[] = [
      { key: "material_image", header: t("return.colImage", { namespace: "invoicing", fallback: "صورة" }), width: "w-[40px]", align: "center", type: "image", defaultVisible: false },
      { key: "material_code", header: t("return.colCode", { namespace: "invoicing", fallback: "الكود" }), width: "w-[100px]", type: "material_code" },
      { key: "material_name", header: t("return.colMaterial", { namespace: "invoicing", fallback: "الصنف" }), width: "flex-[2]", type: "material" },
      { key: "quantity", header: t("labels.quantity", { namespace: "common", fallback: "الكمية" }), width: "w-[80px]", type: "number" },
      { key: "unit_name", header: t("labels.unit", { namespace: "common", fallback: "الوحدة" }), width: "w-[70px]", type: "unit_select" },
      ...availableCurrencies.map(curr => ({
        key: baseCode === curr.code ? 'unit_price' : `unit_price_${curr.code}`,
        header: t("return.colPrice", { namespace: "invoicing", vars: { currency: curr.symbol || curr.code }, fallback: `السعر (${curr.symbol || curr.code})` }),
        width: "w-[100px]",
        type: "number" as const,
      })),
      ...availableCurrencies.map(curr => ({
        key: `line_total_${curr.code}`,
        header: t("return.colTotal", { namespace: "invoicing", vars: { currency: curr.symbol || curr.code }, fallback: `الإجمالي (${curr.symbol || curr.code})` }),
        width: "w-[110px]",
        type: "number" as const,
      })),
      { key: "expiry_date", header: t("return.colExpiry", { namespace: "invoicing", fallback: "تاريخ الانتهاء" }), width: "w-[110px]", type: "date" },
      { key: "notes", header: t("labels.notes", { namespace: "common", fallback: "ملاحظات" }), width: "flex-[1]", type: "text" },
    ];

    const hiddenColumnIds = returnCols.filter(c => c.defaultVisible === false).map(c => c.key);
    const columns = buildInvoiceLineExportColumns({
      gridColumns: returnCols,
      hiddenColumnIds,
      currencies: availableCurrencies,
      hasMultipleCurrencies,
      materials,
      warehouses,
      currencyMode,
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    addCurrencySummary(summary, "line_total", availableCurrencies);

    const totalVal = parseFloat(fullReturn.total_amount || "0");

    await executeExport(exportData, {
      sheetName: t("return.salesSheetTitle", { namespace: "invoicing", fallback: "مرتجع مبيعات" }),
      filename: t("return.salesFilename", { namespace: "invoicing", vars: { number: fullReturn.return_number }, fallback: `مرتجع_مبيعات_${fullReturn.return_number}` }),
      data: enrichedLines,
      columns,
      summary,
      summaryLabel: t("document.summaryLabel", { namespace: "invoicing", fallback: "المجموع" }),
      additionalSummary: [
        { label: t("labels.total", { namespace: "common", fallback: "الإجمالي" }), value: totalVal }
      ],
      currencyRatesSheet: ratesSheet,
    });
  }, [exportData, availableCurrencies, hasMultipleCurrencies, convertBetween, baseCode, materials, warehouses, currencyMode, ratesSheet, t]);

  if (view === "editor") {
    return (
      <ReturnsEditor
        returnType="SalesReturn"
        partyType="customer"
        parties={parties}
        materials={materials}
        warehouses={warehouses}
        onSaved={() => { loadData(false); closeTab(activeTabId); }}
        onClose={() => closeTab(activeTabId)}
        returnId={editingReturn?.id}
        readOnly={isReadOnly}
      />
    );
  }

  return (
    <ReturnsList
      returns={returns}
      loading={loading || refreshing}
      search={search}
      partyIdFilter={customerIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/sales-returns/new-${Date.now()}`;
        openTab({ id: uniqueId, title: t("return.newSalesReturn", { namespace: "invoicing", fallback: "مرتجع مبيعات جديد" }), path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}`, title: t("return.editTabTitle", { namespace: "invoicing", vars: { number: ret.return_number }, fallback: `تعديل ${ret.return_number}` }), path: `/sales-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}-view`, title: t("return.viewTabTitle", { namespace: "invoicing", vars: { number: ret.return_number }, fallback: `عرض ${ret.return_number}` }), path: `/sales-returns/${ret.id}?mode=view`, closable: true });
      }}
      onDelete={handleDelete}
      onExportRow={handleExportRow}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title={t("return.salesListTitle", { namespace: "invoicing", fallback: "مرتجعات المبيعات" })}
      createLabel={t("return.createLabel", { namespace: "invoicing", fallback: "مرتجع جديد" })}
      searchPlaceholder={t("return.salesSearchPlaceholder", { namespace: "invoicing", fallback: "بحث برقم المرتجع أو الزبون..." })}
      emptyMessage={t("return.salesEmpty", { namespace: "invoicing", fallback: "لا توجد مرتجعات مبيعات مسجلة" })}
      statsLabel={t("return.statsLabel", { namespace: "invoicing", fallback: "إجمالي المرتجعات" })}
      statsColor="text-blue-600"
      preferenceKey="sales-returns"
    />
  );
}
