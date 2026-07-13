import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, LayoutGrid } from "lucide-react";
import { inventoryService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { materialService } from '@modules/inventory/api/materialService';
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { StockMovement, WarehouseDto, MaterialDto } from '@erp/shared-types';
import { InventoryWarehouses, type DisplayStyle } from '@modules/inventory/components/InventoryWarehouses';
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
    queryFn: () => warehouseService.list(),
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

  const [search, setSearch] = useState('');
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('cards-medium');

  const filteredWarehouses = useMemo(() => {
    if (!search.trim()) return warehouses;
    const q = search.toLowerCase();

    const byName = warehouses.filter(w => w.name.toLowerCase().includes(q));

    const matchingMaterialIds = products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q)) ||
        (p.barcode?.toLowerCase().includes(q))
      )
      .map(p => p.id);

    const byMaterial = warehouses.filter(w =>
      matchingMaterialIds.some(mid => {
        const whMap = stockByWarehouse.get(mid);
        return (whMap?.get(w.id) || 0) > 0;
      })
    );

    return [...new Map([...byName, ...byMaterial].map(w => [w.id, w])).values()];
  }, [warehouses, search, products, stockByWarehouse]);

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
        <div className="flex flex-col h-full">
          <div className="flex items-start gap-3 px-6 pt-4 pb-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="بحث باسم المستودع أو المادة أو الكود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 h-9 bg-white border-slate-200"
              />
              {search && (
                <div className="text-[11px] text-slate-400 mt-1.5 px-1">
                  {filteredWarehouses.length} من أصل {warehouses.length} مستودع
                </div>
              )}
            </div>
            <div className="shrink-0" style={{ minWidth: '150px' }}>
              <Select value={displayStyle} onValueChange={(v) => setDisplayStyle(v as DisplayStyle)}>
                <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                  <LayoutGrid className="w-3.5 h-3.5 ml-2 text-slate-400" />
                  <SelectValue placeholder="عرض..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cards-small" className="text-xs">بطاقات صغيرة</SelectItem>
                  <SelectItem value="cards-medium" className="text-xs">بطاقات متوسطة</SelectItem>
                  <SelectItem value="cards-large" className="text-xs">بطاقات كبيرة</SelectItem>
                  <SelectItem value="list" className="text-xs">قائمة</SelectItem>
                  <SelectItem value="rows" className="text-xs">أسطر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-6 pb-6">
            <InventoryWarehouses
              warehouses={filteredWarehouses}
              loading={warehousesLoading_}
              onRefresh={refreshWarehouses}
              onAdd={() => { setWarehouseEditItem(null); setWarehouseFormOpen(true); }}
              onEdit={(w) => { setWarehouseEditItem(w); setWarehouseFormOpen(true); }}
              onViewMaterials={(w) => setWarehouseMaterialView(w)}
              displayStyle={displayStyle}
              search={search}
              products={products}
              stockByWarehouse={stockByWarehouse}
            />
          </div>
        </div>
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
