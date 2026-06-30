import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from "lucide-react";
import { inventoryService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import { Button } from "@shared/ui/button";
import type { StockMovement, WarehouseDto, MaterialDto } from '@erp/shared-types';
import { InventoryWarehouses } from '@modules/inventory/components/InventoryWarehouses';
import { WarehouseForm } from '@modules/inventory/components/WarehouseForm';
import { WarehouseMaterialList } from '@modules/inventory/components/WarehouseMaterialList';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';

export default function Warehouses() {
  const {
    data: warehouses = [],
    isLoading: warehousesLoading,
    refetch: refreshWarehouses,
    isRefetching: warehousesRefetching,
  } = useQuery<WarehouseDto[]>({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.listWarehouses(),
  });

  const { data: products = [] } = useQuery<MaterialDto[]>({
    queryKey: ['materials'],
    queryFn: () => materialService.listMaterials(),
  });

  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements'],
    queryFn: () => inventoryService.listStockMovements(),
  });

  const stockByWarehouse = useMemo(() => buildStockByWarehouse(movements), [movements]);

  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [warehouseEditItem, setWarehouseEditItem] = useState<WarehouseDto | null>(null);
  const [warehouseMaterialView, setWarehouseMaterialView] = useState<WarehouseDto | null>(null);

  const handleCloseForm = () => {
    setWarehouseFormOpen(false);
    setWarehouseEditItem(null);
  };

  const warehousesLoading_ = warehousesLoading || warehousesRefetching;

  return (
    <OperationalTableTemplate
      title="المستودعات"
      toolbar={
        <Button size="sm" onClick={() => { setWarehouseEditItem(null); setWarehouseFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" />مستودع جديد
        </Button>
      }
      tableContent={
        <InventoryWarehouses
          warehouses={warehouses}
          loading={warehousesLoading_}
          onRefresh={refreshWarehouses}
          onAdd={() => { setWarehouseEditItem(null); setWarehouseFormOpen(true); }}
          onEdit={(w) => { setWarehouseEditItem(w); setWarehouseFormOpen(true); }}
          onViewMaterials={(w) => setWarehouseMaterialView(w)}
        />
      }
      sidePanel={
        warehouseFormOpen ? (
          <WarehouseForm
            open={warehouseFormOpen}
            onClose={handleCloseForm}
            onSaved={refreshWarehouses}
            editItem={warehouseEditItem}
          />
        ) : warehouseMaterialView ? (
          <WarehouseMaterialList
            open={!!warehouseMaterialView}
            onClose={() => setWarehouseMaterialView(null)}
            warehouse={warehouseMaterialView}
            warehouses={warehouses}
            products={products}
            stockByWarehouse={stockByWarehouse}
          />
        ) : null
      }
      isPanelOpen={warehouseFormOpen || !!warehouseMaterialView}
    />
  );
}
