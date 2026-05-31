import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, RefreshCw, Package, Layers, Barcode, ShoppingCart, TrendingUp, AlertTriangle } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import { categoryService } from '@modules/inventory/api/categoryService';
import { damagedService } from '@modules/inventory/api/inventoryService';
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, CreateDamagedItemRequest } from "@erp/shared-types";
import { cn } from '@shared/lib/utils';
import { toast } from 'sonner';

// Refactored Components & Hooks
import { useEntityList } from '@shared/hooks/useEntityList';
import { MaterialForm } from '@modules/inventory/components/MaterialForm';
import { MaterialTable } from '@modules/inventory/components/MaterialTable';
import { MaterialUnitsManager } from '@modules/inventory/components/MaterialUnitsManager';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { MaterialDetailPanel } from '@modules/inventory/components/MaterialDetailPanel';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";

export default function Materials() {
  const { currencies, baseCurrency } = useCurrencyContext();
  const { openTab } = useTabs();
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

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [managingUnitsMaterial, setManagingUnitsMaterial] = useState<MaterialDto | null>(null);
  const [showUnitsPanel, setShowUnitsPanel] = useState(false);
  const [showDamagedPanel, setShowDamagedPanel] = useState(false);
  const [savingDamaged, setSavingDamaged] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.listCategories();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  const handleCreateDamaged = useCallback(async (payload: CreateDamagedItemRequest) => {
    setSavingDamaged(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDamagedPanel(false);
      refresh();
      toast.success(`تم تسجيل التالف للمادة بنجاح`);
    } catch (e: unknown) {
      toast.error("فشل تسجيل التالف: " + e);
    } finally {
      setSavingDamaged(false);
    }
  }, [refresh]);

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
        stats={stats}
        toolbar={
          <>
            <Button size="sm" onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 ml-2" /> مادة جديدة
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => selectedMaterial && openTab({
                id: `purchases-${selectedId}`,
                title: `مشتريات: ${selectedMaterial.name}`,
                path: `/inventory/purchases/${selectedId}`,
                closable: true,
              })}
            >
              <ShoppingCart className="w-4 h-4 ml-2 text-emerald-600" />
              مشتريات المادة
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => selectedMaterial && openTab({
                id: `sales-${selectedId}`,
                title: `مبيعات: ${selectedMaterial.name}`,
                path: `/inventory/sales/${selectedId}`,
                closable: true,
              })}
            >
              <TrendingUp className="w-4 h-4 ml-2 text-blue-600" />
              مبيعات المادة
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!selectedId}
              onClick={() => {
                setManagingUnitsMaterial(selectedMaterial);
                setShowUnitsPanel(true);
              }}
            >
              <Layers className="w-4 h-4 ml-2 text-purple-600" />
              الوحدات
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
              disabled={!selectedId}
              onClick={() => {
                setShowDamagedPanel(true);
                setIsFormOpen(false);
                setManagingUnitsMaterial(null);
              }}
            >
              <AlertTriangle className="w-4 h-4 ml-2 text-rose-600" />
              تسجيل تالف
            </Button>
          </>
        }

        tableContent={
          <MaterialTable 
            materials={materials}
            categories={categories}
            loading={isLoading}
            search={search}
            onSearchChange={setSearch}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            onManageUnits={(m) => {
              setManagingUnitsMaterial(m);
              setShowUnitsPanel(true);
            }}
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
          ) : managingUnitsMaterial ? (
            <MaterialUnitsManager 
              material={managingUnitsMaterial}
              onClose={() => setManagingUnitsMaterial(null)}
              onUnitsUpdated={refresh}
            />
          ) : showDamagedPanel ? (
            <DamagedForm
              onClose={() => setShowDamagedPanel(false)}
              products={materials}
              onSave={handleCreateDamaged}
              saving={savingDamaged}
              initialMaterialId={selectedId ?? undefined}
            />
          ) : (
            <MaterialDetailPanel 
              material={selectedMaterial}
              onClose={() => setSelectedId(null)}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
          )
        }
        isPanelOpen={isFormOpen || !!selectedId || !!managingUnitsMaterial || showDamagedPanel}
      />
    </>
  );
}
