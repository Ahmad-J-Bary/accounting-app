import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { INVENTORY_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Settings2, Trash2, Download } from "lucide-react";
import { adjustmentService } from '@modules/inventory/api/adjustmentService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable, useExportSetup, useBaseCurrencyColumns } from '@shared/hooks';
import { AdjustmentsTable } from '@modules/inventory/components/AdjustmentsTable';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';
import { AdjustmentDetailPanel } from '@modules/inventory/components/AdjustmentDetailPanel';
import { dateCol, executeExport, addCurrencySummary, applyVisibilityToCurrencyCols, currencyAmountCols } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { formatNumber, getNumberingSystem } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function AdjustmentsPage() {
  const { t } = useLocalization();
  const queryClient = useQueryClient();

  const {
    filtered: adjustments,
    loading: adjLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockAdjustment>({
    queryKey: ["stock-adjustments"],
    fetchData: () => adjustmentService.list(),
    searchFields: ["material_name", "material_id", "notes", "reason", "reference"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockAdjustment | null>(null);
  const [saving, setSaving] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const pData = await materialService.list();
      setProducts(pData);
    } catch {
      toast.error(t("errors.failedLoadProducts", { namespace: "inventory",  }));
    } finally {
      setLoadingProducts(false);
    }
  }, [t]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleCreate = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    setSaving(true);
    try {
      await adjustmentService.create(payload);
      setShowDialog(false);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      toast.success(t("adjustments.created", { namespace: "inventory",  }));
    } catch (e: unknown) {
      toast.error(t("errors.save", { namespace: "inventory", vars: { error: String(e) } }));
    } finally {
      setSaving(false);
    }
  }, [refresh, queryClient, t]);

  const handleUpdate = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updateReq: UpdateStockAdjustmentRequest = {
        id: selectedItem.id,
        material_id: payload.material_id,
        actual_quantity: payload.actual_quantity,
        unit_cost: payload.unit_cost,
        currency_code: payload.currency_code,
        fx_rate: payload.fx_rate,
        reason: payload.reason,
        notes: payload.notes,
        adjustment_date: payload.adjustment_date,
      };
      await adjustmentService.update(updateReq);
      setShowDialog(false);
      setSelectedItem(null);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      toast.success(t("adjustments.updated", { namespace: "inventory",  }));
    } catch (e: unknown) {
      toast.error(t("errors.update", { namespace: "inventory", vars: { error: String(e) } }));
    } finally {
      setSaving(false);
    }
  }, [selectedItem, refresh, queryClient, t]);

  const handleSave = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    if (selectedItem) {
      await handleUpdate(payload);
    } else {
      await handleCreate(payload);
    }
  }, [selectedItem, handleCreate, handleUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("adjustments.deleteConfirm", { namespace: "inventory",  }))) return;
    try {
      await adjustmentService.delete(id);
      toast.success(t("toasts.deleted", { namespace: "inventory",  }));
      setSelectedItem(null);
      setShowDialog(false);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
    } catch (e) {
      toast.error(t("errors.delete", { namespace: "inventory", vars: { error: String(e) } }));
    }
  }, [refresh, queryClient, t]);

  const handleView = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const handleEditClick = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(true);
  }, []);

  const handleNewClick = useCallback(() => {
    setSelectedItem(null);
    setShowDialog(true);
  }, []);

  const handleRowClick = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const isLoading = adjLoading || refreshing || loadingProducts;

  const { hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { exportData, rateMap, currencies, formatAmount, currencyMode, ratesSheet, baseCode } = useExportSetup();

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("total_cost", t("labels.cost", { namespace: "inventory",  }), (row) => Math.abs(parseFloat((row as unknown as StockAdjustment).total_cost_base || "0")), currencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCode, rateMap);
    applyVisibilityToCurrencyCols(currCols, new Set(visibleColumnIds));
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = {
      system_quantity: 'subtotal',
      actual_quantity: 'subtotal',
      difference: 'subtotal',
    };
    addCurrencySummary(summary, "total_cost", currencies);

    const columns: ExcelExportColumn[] = [
      { id: "id", label: t("labels.number", { namespace: "common",  }), accessor: (row) => formatNumber(parseInt((row as unknown as StockAdjustment).reference ?? "0", 10) || 0), numeric: true },
      { id: "material_name", label: t("labels.material", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as StockAdjustment).material_name ?? "") },
      { id: "system_quantity", label: t("adjustments.systemQuantity", { namespace: "inventory",  }), accessor: (row) => parseFloat((row as unknown as StockAdjustment).system_quantity || "0"), numeric: true, decimalPlaces: 2 },
      { id: "actual_quantity", label: t("adjustments.actualQuantity", { namespace: "inventory",  }), accessor: (row) => parseFloat((row as unknown as StockAdjustment).actual_quantity || "0"), numeric: true, decimalPlaces: 2 },
      { id: "difference", label: t("adjustments.difference", { namespace: "inventory",  }), formula: "{col('actual_quantity')}{row}-{col('system_quantity')}{row}", numeric: true, decimalPlaces: 2 },
      ...currCols,
      { id: "notes", label: t("labels.note", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as StockAdjustment).notes ?? (row as unknown as StockAdjustment).reason ?? "") },
      dateCol("adjustment_date", t("labels.date", { namespace: "common",  }), (row) => (row as unknown as StockAdjustment).adjustment_date),
    ];
    await executeExport(exportData, {
      sheetName: t("adjustments.title", { namespace: "inventory",  }),
      filename: t("adjustments.title", { namespace: "inventory",  }),
      data: adjustments as unknown as Record<string, unknown>[],
      columns,
      summary,
      summaryLabel: t("labels.summary", { namespace: "inventory",  }),
      currencyRatesSheet: ratesSheet,
      numeralSystem: getNumberingSystem(),
    });
  }, [adjustments, currencies, formatAmount, currencyMode, baseCode, rateMap, exportData, hasSecondaryCurrencies, ratesSheet, visibleColumnIds, t]);

  const handleCloseForm = useCallback(() => {
    setShowDialog(false);
    if (!selectedItem) setSelectedItem(null);
  }, [selectedItem]);

  return (
    <OperationalTableTemplate
      title={t("adjustments.title", { namespace: "inventory",  })}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleNewClick} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
            <Plus className="w-4 h-4 ml-2" /> {t("adjustments.new", { namespace: "inventory",  })}
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleView(selectedItem)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> {t("actions.view", { namespace: "common",  })}
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleEditClick(selectedItem)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> {t("actions.edit", { namespace: "common",  })}
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleDelete(selectedItem.id)}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> {t("actions.delete", { namespace: "common",  })}
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> {t("labels.exportExcel", { namespace: "inventory",  })}
          </Button>
        </div>
      }
      tableContent={
          <AdjustmentsTable
            data={adjustments}
            loading={isLoading}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedItem?.id}
            onView={handleView}
            onEdit={handleEditClick}
            onDelete={handleDelete}
            onRowClick={handleRowClick}
            onVisibleColumnsChange={setVisibleColumnIds}
          />
      }
      sidePanel={
        selectedItem && !showDialog ? (
          <AdjustmentDetailPanel
            item={selectedItem}
            materials={products}
            onClose={() => setSelectedItem(null)}
            onEdit={handleEditClick}
            onDelete={handleDelete}
          />
        ) : showDialog ? (
          <AdjustmentForm
            onClose={handleCloseForm}
            products={products}
            onSave={handleSave}
            saving={saving}
            initialValues={selectedItem}
          />
        ) : null
      }
      isPanelOpen={!!selectedItem || showDialog}
    />
  );
}
