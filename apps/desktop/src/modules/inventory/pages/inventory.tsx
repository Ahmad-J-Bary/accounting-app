import { useState, useMemo, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { useTabs } from "@app/providers/TabContext";
import { inventoryService, transferService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockMovement, WarehouseDto, MaterialDto, CreateTransferRequest, DamagedItem, StockAdjustment } from '@erp/shared-types';
import type { TransferRow } from '@modules/inventory/components/TransferTable';
import { TransferDetailPanel } from '@modules/inventory/components/TransferDetailPanel';
import { DamagedDetailPanel } from '@modules/inventory/components/DamagedDetailPanel';
import { AdjustmentDetailPanel } from '@modules/inventory/components/AdjustmentDetailPanel';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { InventoryMovementsTable } from '@modules/inventory/components/InventoryMovementsTable';
import { InventoryWarehouses } from '@modules/inventory/components/InventoryWarehouses';
import { WarehouseSelector } from '@modules/inventory/components/WarehouseSelector';
import { MovementTypeFilter } from '@modules/inventory/components/MovementTypeFilter';
import { WarehouseForm } from '@modules/inventory/components/WarehouseForm';
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { TransferTable } from '@modules/inventory/components/TransferTable';
import { WarehouseMaterialList } from '@modules/inventory/components/WarehouseMaterialList';
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';
import { MOVEMENT_TYPE_KEYS, getTransferRefs, getMovementType } from '@modules/inventory/constants/movementTypes';
import { History, Warehouse, RefreshCw, ArrowLeftRight, Plus } from "lucide-react";

export default function Inventory() {
  const { openTab } = useTabs();
  const [activeTab, setActiveTab] = useState('movements');

  const { data: movements = [], isLoading: movementsLoading, refetch: refreshMovements, isRefetching: movementsRefetching } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryService.listStockMovements(),
  });

  const {
    data: warehouses = [],
    isLoading: warehousesLoading,
    refetch: refreshWarehouses,
    isRefetching: warehousesRefetching,
  } = useQuery<WarehouseDto[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.listWarehouses(),
  });

  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...MOVEMENT_TYPE_KEYS]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [warehouseEditItem, setWarehouseEditItem] = useState<WarehouseDto | null>(null);
  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferFormMode, setTransferFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [transferFormData, setTransferFormData] = useState<{ request: CreateTransferRequest; reference: string } | null>(null);
  const [warehouseMaterialView, setWarehouseMaterialView] = useState<WarehouseDto | null>(null);
  const [warehouseTransferPreset, setWarehouseTransferPreset] = useState<{ materialId: string; sourceWarehouseId: string } | null>(null);

  interface TransferDetailData {
    reference: string;
    materialName: string;
    quantity: string;
    sourceWarehouseName: string;
    destWarehouseName: string;
    transferDate: string;
    notes?: string | null;
  }

  const [transferDetailData, setTransferDetailData] = useState<TransferDetailData | null>(null);
  const [damagedDetailItem, setDamagedDetailItem] = useState<DamagedItem | null>(null);
  const [adjustmentDetailItem, setAdjustmentDetailItem] = useState<StockAdjustment | null>(null);

  const { data: products = [] } = useQuery<MaterialDto[]>({
    queryKey: ['materials'],
    queryFn: () => materialService.listMaterials(),
  });

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      if (warehouses.length === 1) {
        setSelectedWarehouseId(warehouses[0].id);
      } else {
        setSelectedWarehouseId('all');
      }
    }
  }, [warehouses, selectedWarehouseId]);

  const INVOICE_ROUTES: Record<string, string> = useMemo(() => ({
    Sale: '/sales-invoices',
    Purchase: '/purchase-invoices',
    OpeningBalance: '/opening-balance',
    SalesReturn: '/sales-returns',
    PurchaseReturn: '/purchase-returns',
  }), []);

  const isSingleWarehouse = warehouses.length === 1;

  const filteredByWarehouse = useMemo(() => {
    if (!selectedWarehouseId || selectedWarehouseId === 'all') return movements;
    return movements.filter(m => m.warehouse_id === selectedWarehouseId);
  }, [movements, selectedWarehouseId]);

  const transferRefs = useMemo(() => getTransferRefs(movements), [movements]);

  const getTransferDetailData = useCallback((m: StockMovement): TransferDetailData | null => {
    if (!m.reference || !transferRefs.has(m.reference)) return null;
    const pairs = movements.filter(p => p.reference === m.reference);
    const outMovement = pairs.find(p => p.movement_type.replace('MovementType::', '') === 'Out');
    const inMovement = pairs.find(p => p.movement_type.replace('MovementType::', '') === 'In');
    if (!outMovement || !inMovement) return null;
    const srcWh = warehouses.find(w => w.id === outMovement.warehouse_id);
    const dstWh = warehouses.find(w => w.id === inMovement.warehouse_id);
    return {
      reference: m.reference,
      materialName: m.material_name || m.material_id || '—',
      quantity: parseFloat(m.quantity).toLocaleString(),
      sourceWarehouseName: srcWh?.name || outMovement.warehouse_id || '—',
      destWarehouseName: dstWh?.name || inMovement.warehouse_id || '—',
      transferDate: m.movement_date,
      notes: m.reason,
    };
  }, [movements, warehouses, transferRefs]);

  const toDamagedItem = useCallback((m: StockMovement): DamagedItem => ({
    id: m.id,
    material_id: m.material_id,
    material_name: m.material_name,
    quantity: m.quantity,
    reason: m.reason || '',
    damage_date: m.movement_date,
    cost_impact: (() => {
      const base = m.total_cost_base ? parseFloat(m.total_cost_base) : 0;
      const orig = m.total_cost ? parseFloat(m.total_cost) : 0;
      const unit = m.unit_cost_base ? parseFloat(m.unit_cost_base) : 0;
      const qty = parseFloat(m.quantity || '0');
      if (base > 0) return m.total_cost_base!;
      if (orig > 0) return m.total_cost!;
      if (unit > 0 && qty > 0) return String(unit * qty);
      return '0';
    })(),
    notes: undefined,
    reference: m.reference,
    created_at: m.created_at,
  }), []);

  const toStockAdjustment = useCallback((m: StockMovement): StockAdjustment => ({
    id: m.id,
    material_id: m.material_id,
    material_name: m.material_name,
    system_quantity: '0',
    actual_quantity: '0',
    difference: m.signed_quantity || m.quantity,
    reason: m.reason,
    unit_cost: m.unit_cost || '0',
    unit_cost_base: m.unit_cost_base || '0',
    total_cost: m.total_cost || '0',
    total_cost_base: m.total_cost_base || '0',
    notes: m.reason,
    reference: m.reference,
    adjustment_date: m.movement_date,
    created_at: m.created_at,
  }), []);

  const handleDamagedEdit = useCallback((_item: DamagedItem) => {
    toast.info('تعديل التالف متاح من صفحة المواد التالفة');
  }, []);

  const handleDamagedDelete = useCallback((_id: string) => {
    toast.info('حذف التالف متاح من صفحة المواد التالفة');
  }, []);

  const handleAdjustmentEdit = useCallback((_item: StockAdjustment) => {
    toast.info('تعديل التسوية متاح من صفحة تسوية الجرد');
  }, []);

  const handleAdjustmentDelete = useCallback((_id: string) => {
    toast.info('حذف التسوية متاح من صفحة تسوية الجرد');
  }, []);

  const handleCloseDamagedDetail = useCallback(() => {
    setDamagedDetailItem(null);
    setSelectedMovementId(null);
  }, []);

  const handleCloseAdjustmentDetail = useCallback(() => {
    setAdjustmentDetailItem(null);
    setSelectedMovementId(null);
  }, []);

  const filteredByType = useMemo(() => {
    if (selectedTypes.length === 0) return filteredByWarehouse;
    return filteredByWarehouse.filter(m => {
      const clean = m.movement_type.replace('MovementType::', '');
      const isTransfer = m.reference ? transferRefs.has(m.reference) : false;
      if (clean === 'In' && isTransfer) {
        return selectedTypes.includes('In') || selectedTypes.includes('TransferTo');
      }
      if (clean === 'Out' && isTransfer) {
        return selectedTypes.includes('Out') || selectedTypes.includes('TransferFrom');
      }
      return selectedTypes.includes(clean);
    });
  }, [filteredByWarehouse, selectedTypes, transferRefs]);

  const filteredMovements = useMemo(() => {
    if (!search.trim()) return filteredByType;
    const q = search.toLowerCase();
    return filteredByType.filter(m =>
      (m.material_name?.toLowerCase().includes(q)) ||
      (m.reference?.toLowerCase().includes(q))
    );
  }, [filteredByType, search]);

  const movementsLoading_ = movementsLoading || movementsRefetching;

  const stats = useMemo(() => [
    { label: "إجمالي الحركات", value: movements.length, icon: History, color: "text-blue-600" },
    { label: "المستودعات النشطة", value: warehouses.filter(w => w.is_active).length, icon: Warehouse, color: "text-slate-900" },
  ], [movements, warehouses]);

  const stockByWarehouse = useMemo(() => buildStockByWarehouse(movements), [movements]);

  const handleRowClick = useCallback((m: StockMovement) => {
    const isSameRow = m.id === selectedMovementId;

    if (isSameRow) {
      setSelectedMovementId(null);
      setTransferDetailData(null);
      setDamagedDetailItem(null);
      setAdjustmentDetailItem(null);
      return;
    }

    setSelectedMovementId(m.id);
    setTransferDetailData(null);
    setDamagedDetailItem(null);
    setAdjustmentDetailItem(null);

    const clean = m.movement_type.replace('MovementType::', '');
    const isTransfer = (clean === 'In' || clean === 'Out') && m.reference ? transferRefs.has(m.reference) : false;

    if (isTransfer) {
      const data = getTransferDetailData(m);
      if (data) {
        setTransferDetailData(data);
        return;
      }
    }

    if (clean === 'Damaged') {
      setDamagedDetailItem(toDamagedItem(m));
      return;
    }

    if (clean === 'Adjustment') {
      setAdjustmentDetailItem(toStockAdjustment(m));
      return;
    }
  }, [selectedMovementId, transferRefs, getTransferDetailData, toDamagedItem, toStockAdjustment]);

  const handleRowDoubleClick = useCallback((m: StockMovement) => {
    const clean = m.movement_type.replace('MovementType::', '');
    const route = INVOICE_ROUTES[clean];
    if (route && m.source_document_id) {
      openTab({
        id: `${route}/${m.source_document_id}-inv-view`,
        title: `عرض ${m.reference || clean}`,
        path: `${route}/${m.source_document_id}?mode=view`,
        closable: true,
      });
    } else if (route) {
      openTab({
        id: `${route}-inv-view`,
        title: `عرض ${clean}`,
        path: `${route}?mode=view`,
        closable: true,
      });
    }
  }, [openTab, INVOICE_ROUTES]);

  const refreshAll = useCallback(() => {
    refreshMovements();
    refreshWarehouses();
  }, [refreshMovements, refreshWarehouses]);

  const handleCloseForm = () => { setWarehouseFormOpen(false); setWarehouseEditItem(null); };

  const handleFormSaved = () => { refreshAll(); };

  const handleCreateTransfer = useCallback(async (req: CreateTransferRequest) => {
    setSavingTransfer(true);
    try {
      await transferService.createTransfer(req);
      toast.success('تم إنشاء التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferFormData(null);
      setWarehouseTransferPreset(null);
      refreshAll();
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [refreshAll]);

  const handleUpdateTransfer = useCallback(async (req: CreateTransferRequest) => {
    if (!transferFormData) return;
    setSavingTransfer(true);
    try {
      await transferService.updateTransfer({ ...req, reference: transferFormData.reference });
      toast.success('تم تحديث التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferFormData(null);
      refreshAll();
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [refreshAll, transferFormData]);

  const handleDeleteTransfer = useCallback(async (reference: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التحويل؟')) return;
    try {
      await transferService.deleteTransfer(reference);
      toast.success('تم حذف التحويل بنجاح');
      setTransferDetailData(null);
      setSelectedMovementId(null);
      refreshAll();
    } catch (e) {
      toast.error(e as string);
    }
  }, [refreshAll]);

  const handleEditTransferFromDetail = useCallback((reference: string) => {
    const pairs = movements.filter(p => p.reference === reference);
    const outMovement = pairs.find(p => p.movement_type.replace('MovementType::', '') === 'Out');
    const inMovement = pairs.find(p => p.movement_type.replace('MovementType::', '') === 'In');
    if (!outMovement || !inMovement) return;

    setTransferFormData({
      request: {
        source_warehouse_id: outMovement.warehouse_id || '',
        dest_warehouse_id: inMovement.warehouse_id || '',
        material_id: outMovement.material_id,
        quantity: outMovement.quantity,
        transfer_date: outMovement.movement_date,
        notes: outMovement.reason || null,
      },
      reference,
    });
    setTransferFormMode('edit');
    setTransferFormOpen(true);
    setTransferDetailData(null);
    setSelectedMovementId(null);
  }, [movements]);

  const handleCloseTransferDetail = useCallback(() => {
    setTransferDetailData(null);
    setSelectedMovementId(null);
  }, []);

  const handleViewTransfer = useCallback((row: TransferRow) => {
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
    setTransferFormMode('view');
    setTransferFormOpen(true);
  }, []);

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
      title="إدارة المخزون"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          {activeTab === 'transfers' && (
            <Button size="sm" onClick={() => { setTransferDetailData(null); setWarehouseFormOpen(false); setTransferFormMode('create'); setTransferFormData(null); setTransferFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 font-bold">
              <ArrowLeftRight className="w-4 h-4 ml-2 shrink-0" />إضافة تحويل
            </Button>
          )}
          {activeTab === 'warehouses' && (
            <Button size="sm" onClick={() => { setTransferDetailData(null); setTransferFormOpen(false); setWarehouseEditItem(null); setWarehouseFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
              <Plus className="w-4 h-4 ml-2 shrink-0" />مستودع جديد
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={refreshAll} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 ml-2 shrink-0" />تحديث
          </Button>
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          {activeTab === 'movements' && (
            <>
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-slate-400 shrink-0" />
                <WarehouseSelector
                  warehouses={warehouses}
                  value={selectedWarehouseId || 'all'}
                  onValueChange={(v) => setSelectedWarehouseId(v === 'all' ? null : v)}
                  includeAll={!isSingleWarehouse}
                  placeholder={isSingleWarehouse ? (warehouses[0]?.name || 'مستودع الشركة') : 'جميع المستودعات'}
                />
              </div>
              <MovementTypeFilter value={selectedTypes} onChange={setSelectedTypes} />
            </>
          )}
          {activeTab === 'warehouses' && (
            <span className="text-xs text-slate-400 font-medium">إدارة وعرض المستودعات المتاحة</span>
          )}
        </div>
      }
      tableContent={
        <Tabs dir="rtl" value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
          <div className="flex items-center px-6 py-2 border-b shrink-0">
            <TabsList className="bg-slate-100 p-0.5 rounded-lg">
              <TabsTrigger value="movements" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-bold">
                <History className="w-3.5 h-3.5 ml-1.5 shrink-0" />سجل الحركات
              </TabsTrigger>
              <TabsTrigger value="transfers" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-bold">
                <ArrowLeftRight className="w-3.5 h-3.5 ml-1.5 shrink-0" />التحويلات
              </TabsTrigger>
              <TabsTrigger value="warehouses" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-bold">
                <Warehouse className="w-3.5 h-3.5 ml-1.5 shrink-0" />المستودعات
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="movements" className="flex-1 m-0 p-0 overflow-hidden">
            <InventoryMovementsTable
              movements={filteredMovements}
              loading={movementsLoading_}
              warehouses={warehouses}
              search={search}
              onSearchChange={setSearch}
              selectedId={selectedMovementId}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              transferRefs={transferRefs}
            />
          </TabsContent>

          <TabsContent value="transfers" className="flex-1 m-0 p-0 overflow-hidden">
            <TransferTable
              movements={movements}
              warehouses={warehouses}
              onView={handleViewTransfer}
              onEdit={handleEditTransfer}
              onDelete={handleDeleteTransfer}
            />
          </TabsContent>

          <TabsContent value="warehouses" className="flex-1 m-0 p-6 overflow-auto">
            <InventoryWarehouses
              warehouses={warehouses}
              loading={warehousesLoading || warehousesRefetching}
              onRefresh={refreshAll}
              onAdd={() => { setTransferFormOpen(false); setWarehouseEditItem(null); setWarehouseFormOpen(true); }}
              onEdit={(w) => { setTransferFormOpen(false); setWarehouseEditItem(w); setWarehouseFormOpen(true); }}
              onViewMaterials={(w) => { setTransferFormOpen(false); setWarehouseFormOpen(false); setWarehouseMaterialView(w); }}
            />
          </TabsContent>
        </Tabs>
      }
      sidePanel={
        warehouseFormOpen ? (
          <WarehouseForm
            open={warehouseFormOpen}
            onClose={handleCloseForm}
            onSaved={handleFormSaved}
            editItem={warehouseEditItem}
          />
        ) : (transferFormOpen || warehouseTransferPreset) ? (
          <TransferForm
            open={true}
            onClose={() => { setTransferFormOpen(false); setTransferFormData(null); setWarehouseTransferPreset(null); }}
            warehouses={warehouses}
            products={products}
            onSave={transferFormMode === 'create' ? handleCreateTransfer : handleUpdateTransfer}
            saving={savingTransfer}
            stockByWarehouse={stockByWarehouse}
            initialMaterialId={warehouseTransferPreset?.materialId}
            initialSourceWarehouseId={warehouseTransferPreset?.sourceWarehouseId}
            lockMaterial={!!warehouseTransferPreset}
            initialValues={transferFormData?.request || null}
            readOnly={transferFormMode === 'view'}
          />
        ) : transferDetailData ? (
          <TransferDetailPanel
            reference={transferDetailData.reference}
            materialName={transferDetailData.materialName}
            quantity={transferDetailData.quantity}
            sourceWarehouseName={transferDetailData.sourceWarehouseName}
            destWarehouseName={transferDetailData.destWarehouseName}
            transferDate={transferDetailData.transferDate}
            notes={transferDetailData.notes}
            onClose={handleCloseTransferDetail}
            onEdit={handleEditTransferFromDetail}
            onDelete={handleDeleteTransfer}
          />
        ) : damagedDetailItem ? (
          <DamagedDetailPanel
            item={damagedDetailItem}
            materials={products}
            onClose={handleCloseDamagedDetail}
            onEdit={handleDamagedEdit}
            onDelete={handleDamagedDelete}
          />
        ) : adjustmentDetailItem ? (
          <AdjustmentDetailPanel
            item={adjustmentDetailItem}
            materials={products}
            onClose={handleCloseAdjustmentDetail}
            onEdit={handleAdjustmentEdit}
            onDelete={handleAdjustmentDelete}
          />
        ) : warehouseMaterialView ? (
          <WarehouseMaterialList
            open={!!warehouseMaterialView}
            onClose={() => setWarehouseMaterialView(null)}
            warehouse={warehouseMaterialView}
            warehouses={warehouses}
            products={products}
            stockByWarehouse={stockByWarehouse}
            onOpenTransfer={(materialId, sourceWarehouseId) => {
              setWarehouseTransferPreset({ materialId, sourceWarehouseId });
            }}
          />
        ) : null
      }
      isPanelOpen={warehouseFormOpen || transferFormOpen || !!warehouseTransferPreset || !!transferDetailData || !!damagedDetailItem || !!adjustmentDetailItem || !!warehouseMaterialView}
    />
  );
}
