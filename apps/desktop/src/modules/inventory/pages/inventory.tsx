import { useState, useMemo, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { inventoryService, transferService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockMovement, WarehouseDto, MaterialDto, CreateTransferRequest } from '@erp/shared-types';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { InventoryMovementsTable } from '@modules/inventory/components/InventoryMovementsTable';
import { InventoryWarehouses } from '@modules/inventory/components/InventoryWarehouses';
import { WarehouseSelector } from '@modules/inventory/components/WarehouseSelector';
import { MovementTypeFilter } from '@modules/inventory/components/MovementTypeFilter';
import { WarehouseForm } from '@modules/inventory/components/WarehouseForm';
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { TransferTable } from '@modules/inventory/components/TransferTable';
import { MOVEMENT_TYPE_KEYS, getTransferRefs } from '@modules/inventory/constants/movementTypes';
import { History, Warehouse, RefreshCw, ArrowLeftRight, Plus } from "lucide-react";

export default function Inventory() {
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

  const isSingleWarehouse = warehouses.length === 1;

  const filteredByWarehouse = useMemo(() => {
    if (!selectedWarehouseId || selectedWarehouseId === 'all') return movements;
    return movements.filter(m => m.warehouse_id === selectedWarehouseId);
  }, [movements, selectedWarehouseId]);

  const transferRefs = useMemo(() => getTransferRefs(movements), [movements]);

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
      refreshAll();
    } catch (e) {
      toast.error(e as string);
    } finally {
      setSavingTransfer(false);
    }
  }, [refreshAll]);

  return (
    <OperationalTableTemplate
      title="إدارة المخزون"
      stats={stats}
      toolbar={
        <div className="flex items-center gap-2">
          {activeTab === 'transfers' && (
            <Button size="sm" onClick={() => { setWarehouseFormOpen(false); setTransferFormOpen(true); }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-100 font-bold">
              <ArrowLeftRight className="w-4 h-4 ml-2 shrink-0" />إضافة تحويل
            </Button>
          )}
          {activeTab === 'warehouses' && (
            <Button size="sm" onClick={() => { setTransferFormOpen(false); setWarehouseEditItem(null); setWarehouseFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
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
              onRowClick={(m) => setSelectedMovementId(m.id === selectedMovementId ? null : m.id)}
              transferRefs={transferRefs}
            />
          </TabsContent>

          <TabsContent value="transfers" className="flex-1 m-0 p-0 overflow-hidden">
            <TransferTable movements={movements} warehouses={warehouses} />
          </TabsContent>

          <TabsContent value="warehouses" className="flex-1 m-0 p-6 overflow-auto">
            <InventoryWarehouses
              warehouses={warehouses}
              loading={warehousesLoading || warehousesRefetching}
              onRefresh={refreshAll}
              onAdd={() => { setTransferFormOpen(false); setWarehouseEditItem(null); setWarehouseFormOpen(true); }}
              onEdit={(w) => { setTransferFormOpen(false); setWarehouseEditItem(w); setWarehouseFormOpen(true); }}
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
        ) : transferFormOpen ? (
          <TransferForm
            open={transferFormOpen}
            onClose={() => setTransferFormOpen(false)}
            warehouses={warehouses}
            products={products}
            onSave={handleCreateTransfer}
            saving={savingTransfer}
          />
        ) : null
      }
      isPanelOpen={warehouseFormOpen || transferFormOpen}
    />
  );
}
