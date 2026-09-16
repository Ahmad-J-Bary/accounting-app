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
      toast.success(t("return.deleteSuccess", { namespace: "invoicing",  }));
      loadData(false);
    } catch (e) {
      toast.error(t("return.deleteError", { namespace: "invoicing", vars: { error: String(e) },  }));
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
      { key: "material_image", header: t("return.colImage", { namespace: "invoicing",  }), width: "w-[40px]", align: "center", type: "image", defaultVisible: false },
      { key: "material_code", header: t("return.colCode", { namespace: "invoicing",  }), width: "w-[100px]", type: "material_code" },
      { key: "material_name", header: t("return.colMaterial", { namespace: "invoicing",  }), width: "flex-[2]", type: "material" },
      { key: "quantity", header: t("labels.quantity", { namespace: "common",  }), width: "w-[80px]", type: "number" },
      { key: "unit_name", header: t("labels.unit", { namespace: "common",  }), width: "w-[70px]", type: "unit_select" },
      ...availableCurrencies.map(curr => ({
        key: baseCode === curr.code ? 'unit_price' : `unit_price_${curr.code}`,
        header: t("return.colPrice", { namespace: "invoicing", vars: { currency: curr.symbol || curr.code },  }),
        width: "w-[100px]",
        type: "number" as const,
      })),
      ...availableCurrencies.map(curr => ({
        key: `line_total_${curr.code}`,
        header: t("return.colTotal", { namespace: "invoicing", vars: { currency: curr.symbol || curr.code },  }),
        width: "w-[110px]",
        type: "number" as const,
      })),
      { key: "expiry_date", header: t("return.colExpiry", { namespace: "invoicing",  }), width: "w-[110px]", type: "date" },
      { key: "notes", header: t("labels.notes", { namespace: "common",  }), width: "flex-[1]", type: "text" },
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
      t,
    });

    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {};
    addCurrencySummary(summary, "line_total", availableCurrencies);

    const totalVal = parseFloat(fullReturn.total_amount || "0");

    await executeExport(exportData, {
      sheetName: t("return.salesSheetTitle", { namespace: "invoicing",  }),
      filename: t("return.salesFilename", { namespace: "invoicing", vars: { number: fullReturn.return_number },  }),
      data: enrichedLines,
      columns,
      summary,
      summaryLabel: t("document.summaryLabel", { namespace: "invoicing",  }),
      additionalSummary: [
        { label: t("labels.total", { namespace: "common",  }), value: totalVal }
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
        openTab({ id: uniqueId, title: t("return.newSalesReturn", { namespace: "invoicing",  }), path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}`, title: t("return.editTabTitle", { namespace: "invoicing", vars: { number: ret.return_number },  }), path: `/sales-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}-view`, title: t("return.viewTabTitle", { namespace: "invoicing", vars: { number: ret.return_number },  }), path: `/sales-returns/${ret.id}?mode=view`, closable: true });
      }}
      onDelete={handleDelete}
      onExportRow={handleExportRow}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title={t("return.salesListTitle", { namespace: "invoicing",  })}
      createLabel={t("return.createLabel", { namespace: "invoicing",  })}
      searchPlaceholder={t("return.salesSearchPlaceholder", { namespace: "invoicing",  })}
      emptyMessage={t("return.salesEmpty", { namespace: "invoicing",  })}
      statsLabel={t("return.statsLabel", { namespace: "invoicing",  })}
      statsColor="text-primary"
      preferenceKey="sales-returns"
    />
  );
}
