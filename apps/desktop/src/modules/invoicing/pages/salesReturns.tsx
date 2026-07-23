import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";
import { useExcelExport } from "@shared/hooks";
import { useExportSettings } from "@shared/hooks/useExportSettings";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { buildInvoiceLineExportColumns } from "../lib/invoice-export-columns";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";
import { buildCurrencyRatesSheetOptions } from "@shared/lib/excel";

export default function SalesReturns() {
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

  const { exportData } = useExcelExport();
  const { currencies: availableCurrencies, hasMultipleCurrencies, convertBetween, baseCurrency, rateMap } = useCurrencyContext();
  const { currencyMode } = useExportSettings();

  const handleDelete = useCallback(async (id: string) => {
    try {
      await returnService.deleteSalesReturn(id);
      toast.success("تم حذف المرتجع بنجاح");
      loadData(false);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [loadData]);

  const handleExportRow = useCallback(async (ret: SalesReturnDto | PurchaseReturnDto) => {
    const fullReturn = await returnService.getSalesReturn(ret.id);
    const rawLines = fullReturn.lines || [];

    const baseCode = baseCurrency?.code || "";
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
      { key: "material_image", header: "صورة", width: "w-[40px]", align: "center", type: "image", defaultVisible: false },
      { key: "material_code", header: "الكود", width: "w-[100px]", type: "material_code" },
      { key: "material_name", header: "الصنف", width: "flex-[2]", type: "material" },
      { key: "quantity", header: "الكمية", width: "w-[80px]", type: "number" },
      { key: "unit_name", header: "الوحدة", width: "w-[70px]", type: "unit_select" },
      ...availableCurrencies.map(curr => ({
        key: baseCode === curr.code ? 'unit_price' : `unit_price_${curr.code}`,
        header: `السعر (${curr.symbol || curr.code})`,
        width: "w-[100px]",
        type: "number" as const,
      })),
      ...availableCurrencies.map(curr => ({
        key: `line_total_${curr.code}`,
        header: `الإجمالي (${curr.symbol || curr.code})`,
        width: "w-[110px]",
        type: "number" as const,
      })),
      { key: "expiry_date", header: "تاريخ الانتهاء", width: "w-[110px]", type: "date" },
      { key: "notes", header: "ملاحظات", width: "flex-[1]", type: "text" },
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
    availableCurrencies.forEach(curr => {
      summary[`line_total_${curr.code}`] = 'subtotal';
    });

    const totalVal = parseFloat(fullReturn.total_amount || "0");

    const currencyRatesSheet = buildCurrencyRatesSheetOptions(baseCurrency, availableCurrencies, rateMap, currencyMode).currencyRatesSheet;

    await exportData(
      enrichedLines,
      columns,
      `مرتجع_مبيعات_${fullReturn.return_number}`,
      {
        sheetName: "مرتجع مبيعات",
        autoFilter: true,
        summary,
        summaryLabel: "المجموع",
        additionalSummary: [
          { label: "الإجمالي", value: totalVal }
        ],
        currencyRatesSheet,
      }
    );
  }, [exportData, availableCurrencies, hasMultipleCurrencies, convertBetween, baseCurrency, materials, warehouses, currencyMode, rateMap]);

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
        openTab({ id: uniqueId, title: "مرتجع مبيعات جديد", path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}`, title: `تعديل ${ret.return_number}`, path: `/sales-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}-view`, title: `عرض ${ret.return_number}`, path: `/sales-returns/${ret.id}?mode=view`, closable: true });
      }}
      onDelete={handleDelete}
      onExportRow={handleExportRow}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title="مرتجعات المبيعات"
      createLabel="مرتجع جديد"
      searchPlaceholder="بحث برقم المرتجع أو الزبون..."
      emptyMessage="لا توجد مرتجعات مبيعات مسجلة"
      statsLabel="إجمالي المرتجعات"
      statsColor="text-blue-600"
      preferenceKey="sales-returns"
    />
  );
}
