import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Plus, RefreshCw, Package, Layers, Barcode, ShoppingCart, TrendingUp, AlertTriangle, Undo2, ArrowRightLeft } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import { categoryService } from '@modules/inventory/api/categoryService';
import { damagedService, transferService, inventoryService } from '@modules/inventory/api/inventoryService';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import type { MaterialDto, CategoryDto, CreateMaterialRequest, UpdateMaterialRequest, CreateDamagedItemRequest, WarehouseDto, CreateTransferRequest, StockMovement } from "@erp/shared-types";
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
import { TransferForm } from '@modules/inventory/components/TransferForm';
import { ReturnFromMaterialPanel } from '@modules/inventory/components/ReturnFromMaterialPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';

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
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [transferFormOpen, setTransferFormOpen] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferPreset, setTransferPreset] = useState<{ sourceWarehouseId?: string } | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const stockByWarehouse = useMemo(() => buildStockByWarehouse(movements), [movements]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await categoryService.listCategories();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  const loadInventoryData = useCallback(async () => {
    try {
      const [whs, mvs] = await Promise.all([
        warehouseService.listWarehouses(),
        inventoryService.listStockMovements(),
      ]);
      setWarehouses(whs);
      setMovements(mvs);
    } catch (e) { console.error(e); }
  }, []);

  const handleCreateTransfer = useCallback(async (req: CreateTransferRequest) => {
    setSavingTransfer(true);
    try {
      await transferService.createTransfer(req);
      toast.success('تم إنشاء التحويل بنجاح');
      setTransferFormOpen(false);
      setTransferPreset(null);
      loadInventoryData();
      refresh();
    } catch (e) {
      toast.error('فشل التحويل: ' + e);
    } finally {
      setSavingTransfer(false);
    }
  }, [loadInventoryData, refresh]);

  const handleOpenTransfer = useCallback((opts: { sourceWarehouseId?: string }) => {
    setTransferPreset(opts);
    setTransferFormOpen(true);
    setIsFormOpen(false);
    setShowDamagedPanel(false);
    setManagingUnitsMaterial(null);
    setIsReturnOpen(false);
  }, [setIsFormOpen]);

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
  useEffect(() => { loadInventoryData(); }, [loadInventoryData]);

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

  const handleOpenReturn = () => {
    if (!selectedMaterial) return;
    setIsReturnOpen(true);
    setIsFormOpen(false);
    setShowDamagedPanel(false);
    setManagingUnitsMaterial(null);
    setTransferFormOpen(false);
    setShowUnitsPanel(false);
  };

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

            <Button
              size="sm"
              variant="outline"
              className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50"
              disabled={!selectedId}
              onClick={() => handleOpenTransfer({})}
            >
              <ArrowRightLeft className="w-4 h-4 ml-2 text-amber-600" />
              تحويل مخزني
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
              onClick={handleOpenReturn}
            >
              <Undo2 className="w-4 h-4 ml-2 text-amber-500" />
              مرتجع
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
              warehouses={warehouses}
              onSave={handleSave}
              saving={saving}
              onCategoryCreated={(cat) => setCategories((prev) => prev.some((c) => c.id === cat.id) ? prev : [...prev, cat])}
            />
          ) : transferFormOpen ? (
            <TransferForm
              open={transferFormOpen}
              onClose={() => { setTransferFormOpen(false); setTransferPreset(null); }}
              warehouses={warehouses}
              products={materials}
              onSave={handleCreateTransfer}
              saving={savingTransfer}
              stockByWarehouse={stockByWarehouse}
              initialMaterialId={selectedId ?? undefined}
              initialSourceWarehouseId={transferPreset?.sourceWarehouseId}
              lockMaterial={true}
            />
          ) : managingUnitsMaterial ? (
            <MaterialUnitsManager 
              material={managingUnitsMaterial}
              onClose={() => setManagingUnitsMaterial(null)}
              onUnitsUpdated={refresh}
            />
          ) : isReturnOpen && selectedMaterial ? (
            <ReturnFromMaterialPanel
              onClose={() => setIsReturnOpen(false)}
              onSaved={refresh}
              materials={materials}
              initialMaterialId={selectedMaterial.id}
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
              onOpenTransfer={handleOpenTransfer}
            />
          )
        }
        isPanelOpen={isFormOpen || transferFormOpen || isReturnOpen || !!selectedId || !!managingUnitsMaterial || showDamagedPanel}
      />
    </>
  );
}
