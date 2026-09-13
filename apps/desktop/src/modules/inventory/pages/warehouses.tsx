import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, LayoutGrid, Download } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import type { StockMovement, WarehouseDto, MaterialDto } from '@erp/shared-types';
import { InventoryWarehouses, type DisplayStyle } from '@modules/inventory/components/InventoryWarehouses';
import { WarehouseForm } from '@modules/inventory/components/WarehouseForm';
import { WarehouseMaterialList } from '@modules/inventory/components/WarehouseMaterialList';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';
import { useStockMovements, useMaterials } from "@shared/hooks/queries/useMaterialQueries";
import { useWarehouses } from "@shared/hooks/queries/useWarehouseQueries";
import { useExportSetup } from "@shared/hooks";
import { executeExport } from "@shared/lib/excel";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function Warehouses() {
  const { t } = useLocalization();
  const {
    data: warehouses = [],
    isLoading: warehousesLoading,
    refetch: refreshWarehouses,
    isRefetching: warehousesRefetching,
  } = useWarehouses();

  const { data: products = [] } = useMaterials();

  const { data: movements = [] } = useStockMovements();

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

  const { exportData } = useExportSetup();

  const handleExport = useCallback(async () => {
    const columns: ExcelExportColumn[] = [
      { id: "name", label: t("labels.name", { namespace: "common", fallback: "الاسم" }), accessor: (row) => String((row as unknown as WarehouseDto).name ?? "") },
      { id: "address", label: t("labels.address", { namespace: "inventory", fallback: "العنوان" }), accessor: (row) => String((row as unknown as WarehouseDto).address ?? "—") },
      { id: "is_active", label: t("labels.status", { namespace: "common", fallback: "الحالة" }), accessor: (row) => (row as unknown as WarehouseDto).is_active ? t("labels.active", { namespace: "inventory", fallback: "نشط" }) : t("labels.inactive", { namespace: "inventory", fallback: "غير نشط" }) },
      { id: "is_default", label: t("labels.default", { namespace: "inventory", fallback: "افتراضي" }), accessor: (row) => (row as unknown as WarehouseDto).is_default ? t("actions.yes", { namespace: "common", fallback: "نعم" }) : t("actions.no", { namespace: "common", fallback: "لا" }) },
    ];
    await executeExport(exportData, {
      sheetName: t("warehouses.title", { namespace: "inventory", fallback: "المستودعات" }),
      filename: t("warehouses.title", { namespace: "inventory", fallback: "المستودعات" }),
      data: filteredWarehouses as unknown as Record<string, unknown>[],
      columns,
    });
  }, [filteredWarehouses, exportData, t]);

  return (
    <OperationalTableTemplate
      title={t("warehouses.title", { namespace: "inventory", fallback: "المستودعات" })}
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { setWarehouseEditItem(null); setWarehouseFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 font-bold">
            <Plus className="w-4 h-4 ml-2" />{t("warehouses.new", { namespace: "inventory", fallback: "مستودع جديد" })}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> {t("labels.exportExcel", { namespace: "inventory", fallback: "تصدير إكسل" })}
          </Button>
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full">
          <div className="flex items-start gap-3 px-6 pt-4 pb-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("warehouses.searchPlaceholder", { namespace: "inventory", fallback: "بحث باسم المستودع أو المادة أو الكود..." })}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 h-9 bg-white border-slate-200"
              />
              {search && (
                <div className="text-[11px] text-slate-400 mt-1.5 px-1">
                  {t("warehouses.countOf", { namespace: "inventory", vars: { count: filteredWarehouses.length, total: warehouses.length }, fallback: `${filteredWarehouses.length} من أصل ${warehouses.length} مستودع` })}
                </div>
              )}
            </div>
            <div className="shrink-0" style={{ minWidth: '150px' }}>
              <Select value={displayStyle} onValueChange={(v) => setDisplayStyle(v as DisplayStyle)}>
                <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                  <LayoutGrid className="w-3.5 h-3.5 ml-2 text-slate-400" />
                  <SelectValue placeholder={t("warehouses.viewPlaceholder", { namespace: "inventory", fallback: "عرض..." })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cards-small" className="text-xs">{t("warehouses.display.cardsSmall", { namespace: "inventory", fallback: "بطاقات صغيرة" })}</SelectItem>
                  <SelectItem value="cards-medium" className="text-xs">{t("warehouses.display.cardsMedium", { namespace: "inventory", fallback: "بطاقات متوسطة" })}</SelectItem>
                  <SelectItem value="cards-large" className="text-xs">{t("warehouses.display.cardsLarge", { namespace: "inventory", fallback: "بطاقات كبيرة" })}</SelectItem>
                  <SelectItem value="list" className="text-xs">{t("warehouses.display.list", { namespace: "inventory", fallback: "قائمة" })}</SelectItem>
                  <SelectItem value="rows" className="text-xs">{t("warehouses.display.rows", { namespace: "inventory", fallback: "أسطر" })}</SelectItem>
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
