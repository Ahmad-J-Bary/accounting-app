import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus } from "lucide-react";
import { damagedService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, UpdateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable } from '@shared/hooks';
import { DamagedTable } from '@modules/inventory/components/DamagedTable';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { DamagedDetailPanel } from '@modules/inventory/components/DamagedDetailPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export default function DamagedPage() {
  const { formatMonetaryAmount } = useCurrencyContext();
  const {
    filtered: items,
    loading: itemsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    queryKey: ["damaged-items"],
    fetchData: () => damagedService.listDamagedItems(),
    searchFields: ["material_name", "material_id", "reason"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DamagedItem | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const pData = await materialService.listMaterials();
      setProducts(pData);
    } catch {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleCreate = useCallback(async (payload: CreateDamagedItemRequest) => {
    setSaving(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل التالف بنجاح");
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const handleUpdate = useCallback(async (payload: CreateDamagedItemRequest) => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updateReq: UpdateDamagedItemRequest = {
        id: selectedItem.id,
        ...payload,
      };
      await damagedService.updateDamagedItem(updateReq);
      setShowDialog(false);
      setSelectedItem(null);
      refresh(true);
      toast.success("تم التعديل بنجاح");
    } catch (e: unknown) {
      toast.error("فشل التعديل: " + e);
    } finally {
      setSaving(false);
    }
  }, [selectedItem, refresh]);

  const handleSave = useCallback(async (payload: CreateDamagedItemRequest) => {
    if (selectedItem) {
      await handleUpdate(payload);
    } else {
      await handleCreate(payload);
    }
  }, [selectedItem, handleCreate, handleUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف سجل التالف هذا؟ سيتم حذف حركة المخزون المرتبطة به.")) return;
    try {
      await damagedService.deleteDamagedItem(id);
      toast.success("تم الحذف بنجاح");
      setSelectedItem(null);
      setShowDialog(false);
      refresh(true);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [refresh]);

  const handleView = useCallback((item: DamagedItem) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const handleEditClick = useCallback((item: DamagedItem) => {
    setSelectedItem(item);
    setShowDialog(true);
  }, []);

  const handleNewClick = useCallback(() => {
    setSelectedItem(null);
    setShowDialog(true);
  }, []);

  const isLoading = itemsLoading || refreshing || loadingProducts;

  // Build initial values for form when editing
  const formInitialValues = selectedItem
    ? {
        material_id: selectedItem.material_id,
        quantity: parseFloat(selectedItem.quantity),
        reason: selectedItem.reason,
        damage_date: selectedItem.damage_date,
        cost_impact: parseFloat(selectedItem.cost_impact),
        notes: selectedItem.notes,
      }
    : undefined;

  return (
    <OperationalTableTemplate
      title="إدارة المواد التالفة"
      toolbar={
        <Button
          size="sm"
          onClick={handleNewClick}
          className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 font-bold"
        >
          <Plus className="w-4 h-4 ml-2" /> تسجيل تالف
        </Button>
      }
      tableContent={
        <DamagedTable
          items={items}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          selectedId={selectedItem?.id}
          onView={handleView}
          onEdit={handleEditClick}
          onDelete={handleDelete}
        />
      }
      sidePanel={
        selectedItem && !showDialog ? (
          <DamagedDetailPanel
            item={selectedItem}
            materials={products}
            onClose={() => setSelectedItem(null)}
            onEdit={handleEditClick}
            onDelete={handleDelete}
          />
        ) : showDialog ? (
          <DamagedForm
            onClose={() => {
              setShowDialog(false);
              if (!selectedItem) setSelectedItem(null);
            }}
            products={products}
            onSave={handleSave}
            saving={saving}
            initialMaterialId={formInitialValues?.material_id}
            initialValues={formInitialValues}
          />
        ) : null
      }
      isPanelOpen={!!selectedItem || showDialog}
    />
  );
}