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

export default function Materials() {
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

  const availableColumns = [
    { id: "code", label: "الكود" },
    { id: "barcode", label: "الباركود" },
    { id: "name", label: "اسم المادة" },
    { id: "categories", label: "التصنيفات" },
    { id: "units", label: "الوحدة" },
    { id: "total_received", label: "الكمية الكلية" },
    { id: "total_sold", label: "الكمية المباعة" },
    { id: "total_available", label: "الكمية المتوفرة" },
    { id: "total_damaged", label: "التالف" },
    { id: "average_cost", label: "متوسط التكلفة (USD)" },
    { id: "average_cost_local", label: "متوسط التكلفة (Display)" },
    { id: "last_purchase_price", label: "آخر شراء (USD)" },
    { id: "last_sale_price", label: "آخر مبيع (USD)" },
  ];

  const defaultVisibleColumns = ["code", "barcode", "name", "categories", "units", "total_available", "average_cost", "average_cost_local"];
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
        headerWidgets={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                  <div className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</div>
                </div>
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                  <s.icon className="w-6 h-6" />
                </div>
              </div>
            ))}
          </div>
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
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel className="text-right">الأعمدة الظاهرة</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableColumns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={isVisible(col.id)}
                    onCheckedChange={() => toggleColumn(col.id)}
                    className="text-right flex-row-reverse gap-2"
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
