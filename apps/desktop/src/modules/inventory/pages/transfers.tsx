import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { transferService } from '@modules/inventory/api/transferService';
import { Button } from "@shared/ui/button";
import type { StockMovement, CreateTransferRequest } from '@erp/shared-types';
import type { TransferRow } from '@modules/inventory/components/TransferTable';
import { TransferDetailPanel } from '@modules/inventory/components/TransferDetailPanel';
import { TransferTable } from '@modules/inventory/components/TransferTable';
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';
import { useStockMovements, useMaterials } from "@shared/hooks/queries/useMaterialQueries";
import { useWarehouses } from "@shared/hooks/queries/useWarehouseQueries";
import { INVENTORY_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { useExportSetup } from "@shared/hooks";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { dateCol, executeExport } from "@shared/lib/excel";
import { toLocalString, getNumberingSystem } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function Transfers() {
  const { t } = useLocalization();
  const { data: movements = [] } = useStockMovements();

  const { data: warehouses = [] } = useWarehouses();

  const { data: products = [] } = useMaterials();

  const queryClient = useQueryClient();
  const stockByWarehouse = useMemo(() => buildStockByWarehouse(movements), [movements]);

  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferFormMode, setTransferFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [transferFormData, setTransferFormData] = useState<{ request: CreateTransferRequest; reference: string } | null>(null);
  const [transferDetailData, setTransferDetailData] = useState<TransferRow | null>(null);
  const [, setWarehouseTransferPreset] = useState<{ materialId: string; sourceWarehouseId: string } | null>(null);

  const handleCreateTransfer = useCallback(async (req: CreateTransferRequest) => {
    setSavingTransfer(true);
    try {
      await transferService.create(req);
      toast.success(t('transfers.created', { namespace: "inventory",  }));
      setTransferFormOpen(false);
      setTransferFormData(null);
      void invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [queryClient, t]);

  const handleUpdateTransfer = useCallback(async (req: CreateTransferRequest) => {
    if (!transferFormData) return;
    setSavingTransfer(true);
    try {
      await transferService.update({ ...req, reference: transferFormData.reference });
      toast.success(t('transfers.updated', { namespace: "inventory",  }));
      setTransferFormOpen(false);
      setTransferFormData(null);
      void invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [transferFormData, queryClient, t]);

  const handleDeleteTransfer = useCallback(async (reference: string) => {
    try {
      await transferService.delete(reference);
      toast.success(t('transfers.deleted', { namespace: "inventory",  }));
      setTransferDetailData(null);
      void invalidateKeys(queryClient, INVENTORY_MUTATION_KEYS);
    } catch (e) {
      toast.error(e as string);
    }
  }, [queryClient, t]);

  const handleViewTransfer = useCallback((row: TransferRow) => {
    setTransferDetailData(row);
  }, []);

  const handleEditFromDetail = useCallback((reference: string) => {
    if (!transferDetailData) return;
    setTransferFormData({
      request: {
        source_warehouse_id: transferDetailData.source_warehouse_id,
        dest_warehouse_id: transferDetailData.dest_warehouse_id,
        material_id: transferDetailData.material_id,
        quantity: transferDetailData.quantity,
        transfer_date: transferDetailData.transfer_date,
        notes: transferDetailData.notes || null,
      },
      reference,
    });
    setTransferFormMode('edit');
    setTransferFormOpen(true);
    setTransferDetailData(null);
  }, [transferDetailData]);

  const handleEditTransfer = useCallback((row: TransferRow) => {
    setTransferFormData({
      request: {
        source_warehouse_id: row.source_warehouse_id,
        dest_warehouse_id: row.dest_warehouse_id,
        material_id: row.material_id,
        quantity: row.quantity,
        transfer_date: row.transfer_date,
        notes: row.notes || null,
      },
      reference: row.reference,
    });
    setTransferFormMode('edit');
    setTransferFormOpen(true);
  }, []);

  const exportRows = useMemo<TransferRow[]>(() => {
    const groups = new Map<string, { out?: StockMovement; in?: StockMovement }>();
    for (const m of movements) {
      if (!m.reference) continue;
      let g = groups.get(m.reference);
      if (!g) { g = {}; groups.set(m.reference, g); }
      const clean = m.movement_type.replace('MovementType::', '');
      if (clean === 'Out') g.out = m;
      else if (clean === 'In') g.in = m;
    }
    const result: TransferRow[] = [];
    for (const [ref, pair] of groups) {
      if (!pair.out || !pair.in) continue;
      result.push({
        reference: ref,
        material_id: pair.out.material_id,
        material_name: pair.out.material_name || pair.in.material_name || '',
        source_warehouse_id: pair.out.warehouse_id || '',
        source_warehouse_name: warehouses.find(w => w.id === pair.out!.warehouse_id)?.name || pair.out.warehouse_id || '',
        dest_warehouse_id: pair.in.warehouse_id || '',
        dest_warehouse_name: warehouses.find(w => w.id === pair.in!.warehouse_id)?.name || pair.in.warehouse_id || '',
        quantity: pair.out.quantity,
        notes: pair.out.reason || pair.in.reason || '',
        transfer_date: pair.out.movement_date,
      });
    }
    return result;
  }, [movements, warehouses]);

  const { exportData } = useExportSetup();

  const handleExport = useCallback(async () => {
    const columns: ExcelExportColumn[] = [
      { id: "material_name", label: t("labels.material", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as TransferRow).material_name ?? "") },
      { id: "source", label: t("transfers.fromWarehouse", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as TransferRow).source_warehouse_name ?? "") },
      { id: "dest", label: t("transfers.toWarehouse", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as TransferRow).dest_warehouse_name ?? "") },
      { id: "quantity", label: t("labels.quantity", { namespace: "common",  }), accessor: (row) => parseFloat((row as unknown as TransferRow).quantity || "0"), numeric: true, decimalPlaces: 2 },
      { id: "reference", label: t("labels.reference", { namespace: "common",  }), accessor: (row) => parseInt((row as unknown as TransferRow).reference ?? "0", 10) || 0 },
      { id: "notes", label: t("labels.note", { namespace: "inventory",  }), accessor: (row) => String((row as unknown as TransferRow).notes ?? "") },
      dateCol("date", t("labels.date", { namespace: "common",  }), (row) => (row as unknown as TransferRow).transfer_date),
    ];
    await executeExport(exportData, {
      sheetName: t("transfers.title", { namespace: "inventory",  }),
      filename: t("transfers.title", { namespace: "inventory",  }),
      data: exportRows as unknown as Record<string, unknown>[],
      columns,
      summary: { quantity: 'subtotal' },
      summaryLabel: t("labels.summary", { namespace: "inventory",  }),
      numeralSystem: getNumberingSystem(),
    });
  }, [exportRows, exportData, t]);

  return (
    <OperationalTableTemplate
      title={t("transfers.title", { namespace: "inventory",  })}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setTransferDetailData(null); setTransferFormMode('create'); setTransferFormData(null); setWarehouseTransferPreset(null); setTransferFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 font-bold">
            <Plus className="w-4 h-4 ml-2" />{t("transfers.add", { namespace: "inventory",  })}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> {t("labels.exportExcel", { namespace: "inventory",  })}
          </Button>
        </div>
      }
      tableContent={
        <TransferTable
          movements={movements}
          warehouses={warehouses}
          onView={handleViewTransfer}
          onEdit={handleEditTransfer}
          onDelete={handleDeleteTransfer}
        />
      }
      sidePanel={
        transferFormOpen ? (
          <TransferForm
            open={true}
            onClose={() => { setTransferFormOpen(false); setTransferFormData(null); setWarehouseTransferPreset(null); }}
            warehouses={warehouses}
            products={products}
            onSave={transferFormMode === 'create' ? handleCreateTransfer : handleUpdateTransfer}
            saving={savingTransfer}
            stockByWarehouse={stockByWarehouse}
            initialValues={transferFormData?.request || null}
            readOnly={transferFormMode === 'view'}
          />
        ) : transferDetailData ? (
          <TransferDetailPanel
            reference={transferDetailData.reference}
            materialName={transferDetailData.material_name}
            quantity={toLocalString(parseFloat(transferDetailData.quantity))}
            sourceWarehouseName={transferDetailData.source_warehouse_name}
            destWarehouseName={transferDetailData.dest_warehouse_name}
            transferDate={transferDetailData.transfer_date}
            notes={transferDetailData.notes}
            onClose={() => setTransferDetailData(null)}
            onEdit={handleEditFromDetail}
            onDelete={handleDeleteTransfer}
          />
        ) : null
      }
      isPanelOpen={transferFormOpen || !!transferDetailData}
    />
  );
}
