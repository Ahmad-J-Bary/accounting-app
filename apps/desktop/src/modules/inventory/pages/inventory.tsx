import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@shared/ui/button";
import { inventoryService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import type { StockMovement, WarehouseDto } from '@erp/shared-types';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { InventoryMovementsTable } from '@modules/inventory/components/InventoryMovementsTable';
import { InventoryWarehouses } from '@modules/inventory/components/InventoryWarehouses';
import { WarehouseSelector } from '@modules/inventory/components/WarehouseSelector';
import { WarehouseForm } from '@modules/inventory/components/WarehouseForm';
import { History, Warehouse, RefreshCw } from "lucide-react";

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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [warehouseEditItem, setWarehouseEditItem] = useState<WarehouseDto | null>(null);

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

  const filteredMovements = useMemo(() => {
    if (!search.trim()) return filteredByWarehouse;
    const q = search.toLowerCase();
    return filteredByWarehouse.filter(m =>
      (m.material_name?.toLowerCase().includes(q)) ||
      (m.reference?.toLowerCase().includes(q))
    );
  }, [filteredByWarehouse, search]);

  const movementsLoading_ = movementsLoading || movementsRefetching;

  const stats = useMemo(() => [
    { label: "إجمالي الحركات", value: movements.length, icon: History, color: "text-blue-600" },
    { label: "المستودعات النشطة", value: warehouses.filter(w => w.is_active).length, icon: Warehouse, color: "text-slate-900" },
  ], [movements, warehouses]);

  const refreshAll = () => { refreshMovements(); refreshWarehouses(); };

  const handleCloseForm = () => { setWarehouseFormOpen(false); setWarehouseEditItem(null); };

  const handleFormSaved = () => { refreshAll(); };

  return (
    <OperationalTableTemplate
      title="إدارة المخزون"
      stats={stats}
      toolbar={
        <Button size="sm" variant="outline" onClick={refreshAll} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
          <RefreshCw className="w-4 h-4 ml-2 shrink-0" />تحديث
        </Button>
      }
      filterBar={
        <div className="flex items-center gap-4">
          {activeTab === 'movements' && (
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
          )}
          {activeTab === 'warehouses' && (
            <span className="text-xs text-slate-400 font-medium">إدارة وعرض المستودعات المتاحة</span>
          )}
        </div>
      }
      tableContent={
        <Tabs dir="rtl" value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
            <TabsList className="bg-slate-100 p-0.5 rounded-lg">
              <TabsTrigger value="movements" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-bold">
                <History className="w-3.5 h-3.5 ml-1.5 shrink-0" />سجل الحركات
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
            />
          </TabsContent>

          <TabsContent value="warehouses" className="flex-1 m-0 p-6 overflow-auto">
            <InventoryWarehouses
              warehouses={warehouses}
              loading={warehousesLoading || warehousesRefetching}
              onRefresh={refreshAll}
              onAdd={() => { setWarehouseEditItem(null); setWarehouseFormOpen(true); }}
              onEdit={(w) => { setWarehouseEditItem(w); setWarehouseFormOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      }
      sidePanel={<WarehouseForm open={warehouseFormOpen} onClose={handleCloseForm} onSaved={handleFormSaved} editItem={warehouseEditItem} />}
      isPanelOpen={warehouseFormOpen}
    />
  );
}
