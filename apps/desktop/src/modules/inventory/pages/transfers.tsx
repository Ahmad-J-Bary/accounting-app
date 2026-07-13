import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { inventoryService, transferService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import { Button } from "@shared/ui/button";
import type { StockMovement, WarehouseDto, MaterialDto, CreateTransferRequest } from '@erp/shared-types';
import type { TransferRow } from '@modules/inventory/components/TransferTable';
import { TransferDetailPanel } from '@modules/inventory/components/TransferDetailPanel';
import { TransferTable } from '@modules/inventory/components/TransferTable';
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';

export default function Transfers() {
  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryService.listStockMovements(),
  });

  const { data: warehouses = [] } = useQuery<WarehouseDto[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.listWarehouses(),
  });

  const { data: products = [] } = useQuery<MaterialDto[]>({
    queryKey: ['materials'],
    queryFn: () => materialService.listMaterials(),
  });

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
      await transferService.createTransfer(req);
      toast.success('تم إنشاء التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferFormData(null);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [queryClient]);

  const handleUpdateTransfer = useCallback(async (req: CreateTransferRequest) => {
    if (!transferFormData) return;
    setSavingTransfer(true);
    try {
      await transferService.updateTransfer({ ...req, reference: transferFormData.reference });
      toast.success('تم تحديث التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferFormData(null);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [transferFormData, queryClient]);

  const handleDeleteTransfer = useCallback(async (reference: string) => {
    try {
      await transferService.deleteTransfer(reference);
      toast.success('تم حذف التحويل بنجاح');
      setTransferDetailData(null);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    } catch (e) {
      toast.error(e as string);
    }
  }, [queryClient]);

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

  return (
    <OperationalTableTemplate
      title="التحويلات"
      toolbar={
        <Button size="sm" onClick={() => { setTransferDetailData(null); setTransferFormMode('create'); setTransferFormData(null); setWarehouseTransferPreset(null); setTransferFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 font-bold">
          <Plus className="w-4 h-4 ml-2" />إضافة تحويل
        </Button>
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
            quantity={parseFloat(transferDetailData.quantity).toLocaleString()}
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
