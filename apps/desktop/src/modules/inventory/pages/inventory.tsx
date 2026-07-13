import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from "sonner";
import { useTabs } from "@app/providers/TabContext";
import { inventoryService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockMovement, WarehouseDto, MaterialDto, DamagedItem, StockAdjustment } from '@erp/shared-types';
import { DamagedDetailPanel } from '@modules/inventory/components/DamagedDetailPanel';
import { AdjustmentDetailPanel } from '@modules/inventory/components/AdjustmentDetailPanel';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { InventoryMovementsTable } from '@modules/inventory/components/InventoryMovementsTable';
import { WarehouseSelector } from '@modules/inventory/components/WarehouseSelector';
import { MovementTypeFilter } from '@modules/inventory/components/MovementTypeFilter';
import { MOVEMENT_TYPE_KEYS, getTransferRefs } from '@modules/inventory/constants/movementTypes';

export default function Inventory() {
  const { openTab } = useTabs();

  const { data: movements = [], isLoading: movementsLoading, isRefetching: movementsRefetching } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryService.listStockMovements(),
  });

  const { data: warehouses = [] } = useQuery<WarehouseDto[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.list(),
  });

  const { data: materials = [] } = useQuery<MaterialDto[]>({
    queryKey: ['materials'],
    queryFn: () => materialService.listMaterials(),
  });

  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...MOVEMENT_TYPE_KEYS]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [damagedDetailItem, setDamagedDetailItem] = useState<DamagedItem | null>(null);
  const [adjustmentDetailItem, setAdjustmentDetailItem] = useState<StockAdjustment | null>(null);

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

  const toDamagedItem = useCallback((m: StockMovement): DamagedItem => ({
    id: m.id,
    material_id: m.material_id,
    material_name: m.material_name ?? undefined,
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
    material_name: m.material_name ?? undefined,
    system_quantity: '0',
    actual_quantity: '0',
    difference: m.signed_quantity || m.quantity,
    reason: m.reason ?? undefined,
    unit_cost: m.unit_cost || '0',
    unit_cost_base: m.unit_cost_base || '0',
    total_cost: m.total_cost || '0',
    total_cost_base: m.total_cost_base || '0',
    notes: m.reason ?? undefined,
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

  const handleRowClick = useCallback((m: StockMovement) => {
    const isSameRow = m.id === selectedMovementId;

    if (isSameRow) {
      setSelectedMovementId(null);
      setDamagedDetailItem(null);
      setAdjustmentDetailItem(null);
      return;
    }

    setSelectedMovementId(m.id);
    setDamagedDetailItem(null);
    setAdjustmentDetailItem(null);

    const clean = m.movement_type.replace('MovementType::', '');

    if (clean === 'Damaged') {
      setDamagedDetailItem(toDamagedItem(m));
      return;
    }

    if (clean === 'Adjustment') {
      setAdjustmentDetailItem(toStockAdjustment(m));
      return;
    }
  }, [selectedMovementId, toDamagedItem, toStockAdjustment]);

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

  return (
    <OperationalTableTemplate
      title="حركات المخزون"
      tableContent={
        <InventoryMovementsTable
          movements={filteredMovements}
          loading={movementsLoading_}
          warehouses={warehouses}
          search={search}
          onSearchChange={setSearch}
          filterBar={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <WarehouseSelector
                  warehouses={warehouses}
                  value={selectedWarehouseId || 'all'}
                  onValueChange={(v) => setSelectedWarehouseId(v === 'all' ? null : v)}
                  includeAll={!isSingleWarehouse}
                  placeholder={isSingleWarehouse ? (warehouses[0]?.name || 'مستودع الشركة') : 'جميع المستودعات'}
                />
              </div>
              <MovementTypeFilter value={selectedTypes} onChange={setSelectedTypes} />
            </div>
          }
          selectedId={selectedMovementId}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          transferRefs={transferRefs}
        />
      }
      sidePanel={
        damagedDetailItem ? (
          <DamagedDetailPanel
            item={damagedDetailItem}
            materials={materials}
            onClose={handleCloseDamagedDetail}
            onEdit={handleDamagedEdit}
            onDelete={handleDamagedDelete}
          />
        ) : adjustmentDetailItem ? (
          <AdjustmentDetailPanel
            item={adjustmentDetailItem}
            materials={materials}
            onClose={handleCloseAdjustmentDetail}
            onEdit={handleAdjustmentEdit}
            onDelete={handleAdjustmentDelete}
          />
        ) : null
      }
      isPanelOpen={!!damagedDetailItem || !!adjustmentDetailItem}
    />
  );
}
