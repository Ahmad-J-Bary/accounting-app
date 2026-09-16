import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { INVENTORY_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { Button } from "@shared/ui/button";
import { Plus, Download } from "lucide-react";
import { damagedService } from '@modules/inventory/api/damagedService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, UpdateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable, useExportSetup, useBaseCurrencyColumns } from '@shared/hooks';
import { DamagedTable } from '@modules/inventory/components/DamagedTable';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { DamagedDetailPanel } from '@modules/inventory/components/DamagedDetailPanel';
import { dateCol, executeExport, addCurrencySummary, applyVisibilityToCurrencyCols, currencyAmountCols } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { getNumberingSystem } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function DamagedPage() {
  const { t } = useLocalization();
  const queryClient = useQueryClient();

  const {
    filtered: items,
    loading: itemsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    queryKey: ["damaged-items"],
    fetchData: () => damagedService.list(),
    searchFields: ["material_name", "material_id", "reason"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DamagedItem | null>(null);
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

  const handleCreate = useCallback(async (payload: CreateDamagedItemRequest) => {
    setSaving(true);
    try {
      await damagedService.create(payload);
      setShowDialog(false);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      toast.success(t("damaged.created", { namespace: "inventory",  }));
    } catch (e: unknown) {
      toast.error(t("errors.save", { namespace: "inventory", vars: { error: String(e) } }));
    } finally {
      setSaving(false);
    }
  }, [refresh, queryClient, t]);

  const handleUpdate = useCallback(async (payload: CreateDamagedItemRequest) => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updateReq: UpdateDamagedItemRequest = {
        id: selectedItem.id,
        ...payload,
      };
      await damagedService.update(updateReq);
      setShowDialog(false);
      setSelectedItem(null);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
      toast.success(t("damaged.updated", { namespace: "inventory",  }));
    } catch (e: unknown) {
      toast.error(t("errors.update", { namespace: "inventory", vars: { error: String(e) } }));
    } finally {
      setSaving(false);
    }
  }, [selectedItem, refresh, queryClient, t]);

  const handleSave = useCallback(async (payload: CreateDamagedItemRequest) => {
    if (selectedItem) {
      await handleUpdate(payload);
    } else {
      await handleCreate(payload);
    }
  }, [selectedItem, handleCreate, handleUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("damaged.deleteConfirm", { namespace: "inventory",  }))) return;
    try {
      await damagedService.delete(id);
      toast.success(t("toasts.deleted", { namespace: "inventory",  }));
      setSelectedItem(null);
      setShowDialog(false);
      refresh(true);
      await invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
    } catch (e) {
      toast.error(t("errors.delete", { namespace: "inventory", vars: { error: String(e) } }));
    }
  }, [refresh, queryClient, t]);

  const handleView = useCallback((item: DamagedItem) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const handleEditClick = useCallback((item: DamagedItem) => {
    setSelectedItem(item);
    setShowDialog(true);
  }, []);

  const handleNewClick = useCallback(() => {
    setSelectedItem(null);
    setShowDialog(true);
  }, []);

  const isLoading = itemsLoading || refreshing || loadingProducts;

  const { hasSecondaryCurrencies } = useBaseCurrencyColumns();
  const { exportData, rateMap, currencies, formatAmount, currencyMode, ratesSheet, baseCode } = useExportSetup();

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("loss", t("damaged.loss", { namespace: "inventory",  }), (row) => parseFloat((row as unknown as DamagedItem).loss_base || (row as unknown as DamagedItem).cost_impact_base || "0"), currencies, formatAmount, "", hasSecondaryCurrencies, hasSecondaryCurrencies, currencyMode, baseCode, rateMap);
    applyVisibilityToCurrencyCols(currCols, new Set(visibleColumnIds));
    const summary: Record<string, 'sum' | 'subtotal' | 'average' | null> = { quantity: 'subtotal' };
    addCurrencySummary(summary, "loss", currencies);

    const columns: ExcelExportColumn[] = [
      { id: "id", label: t("labels.number", { namespace: "common",  }), accessor: (row) => {
        const i = row as unknown as DamagedItem;
        if (i.reference) return parseInt(i.reference, 10) || 0;
        return "—";
      } },
      { id: "material_name", label: t("labels.material", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as DamagedItem).material_name ?? "") },
      { id: "quantity", label: t("labels.quantity", { namespace: "common",  }), accessor: (row) => Math.round(parseFloat((row as unknown as DamagedItem).quantity || "0")), numeric: true },
      ...currCols,
      { id: "reason", label: t("labels.reason", { namespace: "common",  }), accessor: (row) => String((row as unknown as DamagedItem).reason ?? "") },
      dateCol("damage_date", t("labels.date", { namespace: "common",  }), (row) => (row as unknown as DamagedItem).damage_date),
    ];
    await executeExport(exportData, {
      sheetName: t("damaged.title", { namespace: "inventory",  }),
      filename: t("damaged.title", { namespace: "inventory",  }),
      data: items as unknown as Record<string, unknown>[],
      columns,
      summary,
      summaryLabel: t("labels.summary", { namespace: "inventory",  }),
      currencyRatesSheet: ratesSheet,
      numeralSystem: getNumberingSystem(),
    });
  }, [items, currencies, formatAmount, currencyMode, baseCode, rateMap, exportData, hasSecondaryCurrencies, ratesSheet, visibleColumnIds, t]);

  // Build initial values for form when editing
  const formInitialValues = selectedItem
    ? {
        material_id: selectedItem.material_id,
        quantity: parseFloat(selectedItem.quantity),
        reason: selectedItem.reason,
        damage_date: selectedItem.damage_date,
        cost_impact: selectedItem.cost_impact,
        currency_code: selectedItem.currency_code || undefined,
        fx_rate: selectedItem.fx_rate || undefined,
        notes: selectedItem.notes,
      }
    : undefined;

  return (
    <OperationalTableTemplate
      title={t("damaged.title", { namespace: "inventory",  })}
      toolbar={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleNewClick}
            className="bg-destructive hover:bg-destructive/80 shadow-lg shadow-destructive/20 font-bold"
          >
            <Plus className="w-4 h-4 ml-2" /> {t("damaged.register", { namespace: "inventory",  })}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-muted hover:bg-muted font-bold">
            <Download className="w-4 h-4 ml-2 text-muted-foreground" /> {t("labels.exportExcel", { namespace: "inventory",  })}
          </Button>
        </div>
      }
      tableContent={
          <DamagedTable
            items={items}
            loading={isLoading}
            search={search}
            onSearchChange={setSearch}
            selectedId={selectedItem?.id}
            onView={handleView}
            onEdit={handleEditClick}
            onDelete={handleDelete}
            onVisibleColumnsChange={setVisibleColumnIds}
          />
      }
      sidePanel={
        selectedItem && !showDialog ? (
          <DamagedDetailPanel
            item={selectedItem}
            materials={products}
            onClose={() => setSelectedItem(null)}
            onEdit={handleEditClick}
            onDelete={handleDelete}
          />
        ) : showDialog ? (
          <DamagedForm
            onClose={() => {
              setShowDialog(false);
              if (!selectedItem) setSelectedItem(null);
            }}
            products={products}
            onSave={handleSave}
            saving={saving}
            initialMaterialId={formInitialValues?.material_id}
            initialValues={formInitialValues}
          />
        ) : null
      }
      isPanelOpen={!!selectedItem || showDialog}
    />
  );
}
