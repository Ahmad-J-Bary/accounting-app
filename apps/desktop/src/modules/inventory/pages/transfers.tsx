import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { transferService } from '@modules/inventory/api/transferService';
import { stockMovementService } from '@modules/inventory/api/stockMovementService';
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
import { saveExcelFile, type ExcelExportColumn, type ExcelExportOptions } from "@shared/lib/excel";
import { formatDateTime } from "@shared/lib/format";

export default function Transfers() {
  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements'],
    queryFn: () => stockMovementService.list(),
  });

  const { data: warehouses = [] } = useQuery<WarehouseDto[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.list(),
  });

  const { data: products = [] } = useQuery<MaterialDto[]>({
    queryKey: ['materials'],
    queryFn: () => materialService.list(),
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
      await transferService.create(req);
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
      await transferService.update({ ...req, reference: transferFormData.reference });
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
      await transferService.delete(reference);
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

  const handleExport = useCallback(async () => {
    if (exportRows.length === 0) {
      toast.error("لا توجد بيانات لتصديرها");
      return;
    }
    const columns: ExcelExportColumn[] = [
      { id: "material_name", label: "المادة", accessor: (row) => String((row as unknown as TransferRow).material_name ?? "") },
      { id: "source", label: "من مستودع", accessor: (row) => String((row as unknown as TransferRow).source_warehouse_name ?? "") },
      { id: "dest", label: "إلى مستودع", accessor: (row) => String((row as unknown as TransferRow).dest_warehouse_name ?? "") },
      { id: "quantity", label: "الكمية", accessor: (row) => parseFloat((row as unknown as TransferRow).quantity || "0") },
      { id: "reference", label: "المرجع", accessor: (row) => String((row as unknown as TransferRow).reference ?? "") },
      { id: "notes", label: "ملاحظة", accessor: (row) => String((row as unknown as TransferRow).notes ?? "") },
      { id: "date", label: "التاريخ", accessor: (row) => formatDateTime((row as unknown as TransferRow).transfer_date) },
    ];
    const opts: ExcelExportOptions = { sheetName: "التحويلات", autoFilter: true };
    const ok = await saveExcelFile(exportRows as unknown as Record<string, unknown>[], columns, "التحويلات", opts);
    if (ok) toast.success("تم حفظ ملف Excel بنجاح");
  }, [exportRows]);

  return (
    <OperationalTableTemplate
      title="التحويلات"
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setTransferDetailData(null); setTransferFormMode('create'); setTransferFormData(null); setWarehouseTransferPreset(null); setTransferFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 font-bold">
            <Plus className="w-4 h-4 ml-2" />إضافة تحويل
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
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
