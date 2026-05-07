import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Settings2, Package, Layers, Barcode } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";
import { materialService } from '@modules/inventory/api/materialService';
import { categoryService } from '@modules/inventory/api/categoryService';
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';

// Refactored Components & Hooks
import { useColumnPreferences } from '@shared/hooks';
import { useEntityList } from '@shared/hooks/useEntityList';
import { MaterialForm } from '@modules/inventory/components/MaterialForm';
import { MaterialTable } from '@modules/inventory/components/MaterialTable';
import { MaterialUnitsManager } from '@modules/inventory/components/MaterialUnitsManager';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { MaterialDetailPanel } from '@modules/inventory/components/MaterialDetailPanel';
import { useCurrencyContext } from "@app/providers/CurrencyProvider";

export default function Materials() {
  const { currencies, baseCurrency } = useCurrencyContext();
  const {
    filtered: materials,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem: selectedMaterial,
    editItem: editMaterial,
    isFormOpen,
    setIsFormOpen,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<MaterialDto, CreateMaterialRequest | UpdateMaterialRequest>({
    fetchData: () => materialService.listMaterials(),
    saveData: async (payload) => {
      if ((payload as UpdateMaterialRequest).id) return materialService.updateMaterial(payload as UpdateMaterialRequest);
      return materialService.createMaterial(payload as CreateMaterialRequest);
    },
    deleteData: (id) => materialService.deleteMaterial(id),
    searchFields: ["name", "code", "barcode"],
  });

  const isLoading = loading || refreshing;

  const availableColumns = useMemo(() => {
    const cols = [
      { id: "code", label: "الكود" },
      { id: "barcode", label: "الباركود" },
      { id: "name", label: "اسم المادة" },
      { id: "categories", label: "التصنيفات" },
      { id: "units", label: "الوحدات" },
      { id: "total_available", label: "المتوفر" },
    ];

    // Multi-currency price columns grouped by type
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `average_cost_${curr.code}`, label: `التكلفة (${s})` });
    });
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `last_purchase_${curr.code}`, label: `آخر شراء (${s})` });
    });
    currencies.forEach(curr => {
      const s = curr.symbol || curr.code;
      cols.push({ id: `last_sale_${curr.code}`, label: `آخر مبيع (${s})` });
    });

    return cols;
  }, [currencies]);

  const defaultVisibleColumns = useMemo(() => {
    const base = ["code", "name", "units", "total_available"];
    if (baseCurrency) {
      base.push(`average_cost_${baseCurrency.code}`);
    }
    // Add other currency costs by default
    currencies.forEach(c => {
      if (baseCurrency && c.code === baseCurrency.code) return;
      base.push(`average_cost_${c.code}`);
    });
    return base;
  }, [currencies, baseCurrency]);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("materials", defaultVisibleColumns);

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [managingUnitsMaterial, setManagingUnitsMaterial] = useState<MaterialDto | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.listCategories();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  useEffect(() => {
    const handler = () => handleOpenAdd();
    window.addEventListener("erp:open-new-product", handler);
    return () => window.removeEventListener("erp:open-new-product", handler);
  }, [handleOpenAdd]);

  useEffect(() => {
    if (selectedId) {
      setIsFormOpen(false);
    }
  }, [selectedId, setIsFormOpen]);

  const stats = useMemo(() => [
    { label: "إجمالي المواد", value: materials.length, icon: Package, color: "text-slate-900" },
    { label: "التصنيفات", value: categories.length, icon: Layers, color: "text-blue-600" },
    { label: "مواد بباركود", value: materials.filter(m => m.barcode).length, icon: Barcode, color: "text-emerald-600" },
  ], [materials, categories]);

  return (
    <>
      <OperationalTableTemplate
        title="بطاقات المواد"
        toolbar={
          <>
            <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
              <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
            </Button>
            <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
            </Button>
          </>
        }

        filterBar={
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم أو الكود أو الباركود..."
                className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
                <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={isVisible(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                    className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-6 mr-auto pl-2">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                  <div className="flex items-center gap-2">
                     <s.icon className={cn("w-4 h-4", s.color)} />
                     <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        }
        tableContent={
          <MaterialTable 
            materials={materials}
            categories={categories}
            loading={loading}
            search={search}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onManageUnits={setManagingUnitsMaterial}
            visibleColumns={visibleColumns}
            selectedId={selectedId}
            onRowClick={(m) => setSelectedId(m.id)}
          />
        }
        sidePanel={
          isFormOpen ? (
            <MaterialForm 
              open={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              material={editMaterial}
              categories={categories}
              onSave={handleSave}
              saving={saving}
            />
          ) : (
            <MaterialDetailPanel 
              material={selectedMaterial}
              onClose={() => setSelectedId(null)}
            />
          )
        }
        isPanelOpen={isFormOpen || !!selectedId}
      />
      <MaterialUnitsManager 
        open={!!managingUnitsMaterial}
        onOpenChange={(open) => !open && setManagingUnitsMaterial(null)}
        material={managingUnitsMaterial}
        onUnitsUpdated={refresh}
      />
    </>
  );
}
