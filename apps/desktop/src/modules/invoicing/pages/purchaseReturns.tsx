import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";
import { useExcelExport } from "@shared/hooks";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";
import { buildInvoiceLineExportColumns } from "../lib/invoice-export-columns";
import type { DocumentColumn } from "@widgets/document-shell/GenericDocumentGrid";

export default function PurchaseReturns() {
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
    returnType: "PurchaseReturn",
    partyType: "supplier",
  });

  const searchParams = new URLSearchParams(location.search);
  const supplierIdFilter = searchParams.get("supplierId") || undefined;

  const { exportData } = useExcelExport();
  const { currencies: availableCurrencies, hasMultipleCurrencies, convertBetween, baseCurrency } = useCurrencyContext();

  const handleDelete = useCallback(async (id: string) => {
    try {
      await returnService.deletePurchaseReturn(id);
      toast.success("تم حذف المرتجع بنجاح");
      loadData(false);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [loadData]);

  const handleExportRow = useCallback(async (ret: SalesReturnDto | PurchaseReturnDto) => {
    const fullReturn = await returnService.getPurchaseReturn(ret.id);
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

    // Build a simple column set for returns (no gridColumns from useDocumentFinancials)
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
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    availableCurrencies.forEach(curr => {
      summary[`line_total_${curr.code}`] = 'subtotal';
    });

    const totalVal = parseFloat(fullReturn.total_amount || "0");

    await exportData(
      enrichedLines,
      columns,
      `مرتجع_مشتريات_${fullReturn.return_number}`,
      {
        sheetName: "مرتجع مشتريات",
        autoFilter: true,
        summary,
        summaryLabel: "المجموع",
        additionalSummary: [
          { label: "الإجمالي", value: totalVal }
        ]
      }
    );
  }, [exportData, availableCurrencies, hasMultipleCurrencies, convertBetween, baseCurrency, materials, warehouses]);

  if (view === "editor") {
    return (
      <ReturnsEditor
        returnType="PurchaseReturn"
        partyType="supplier"
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
      partyIdFilter={supplierIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/purchase-returns/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "مرتجع مشتريات جديد", path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/purchase-returns/${ret.id}`, title: `تعديل ${ret.return_number}`, path: `/purchase-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/purchase-returns/${ret.id}-view`, title: `عرض ${ret.return_number}`, path: `/purchase-returns/${ret.id}?mode=view`, closable: true });
      }}
      onDelete={handleDelete}
      onExportRow={handleExportRow}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="supplier"
      title="مرتجعات المشتريات"
      createLabel="مرتجع جديد"
      searchPlaceholder="بحث برقم المرتجع أو المورد..."
      emptyMessage="لا توجد مرتجعات مشتريات مسجلة"
      statsLabel="إجمالي المرتجعات"
      statsColor="text-amber-600"
      preferenceKey="purchase-returns"
    />
  );
}
