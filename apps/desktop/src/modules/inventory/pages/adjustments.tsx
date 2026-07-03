import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Settings2, Trash2 } from "lucide-react";
import { adjustmentService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { AdjustmentsTable } from '@modules/inventory/components/AdjustmentsTable';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';
import { AdjustmentDetailPanel } from '@modules/inventory/components/AdjustmentDetailPanel';

export default function AdjustmentsPage() {
  const {
    data,
    filtered: adjustments,
    loading: adjLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockAdjustment>({
    fetchData: () => adjustmentService.listStockAdjustments(),
    searchFields: ["material_name", "material_id", "notes", "reason", "reference"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockAdjustment | null>(null);
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

  const handleCreate = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    setSaving(true);
    try {
      await adjustmentService.createStockAdjustment(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل تسوية الجرد بنجاح");
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const handleUpdate = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updateReq: UpdateStockAdjustmentRequest = {
        id: selectedItem.id,
        material_id: payload.material_id,
        actual_quantity: payload.actual_quantity,
        unit_cost: payload.unit_cost,
        reason: payload.reason,
        notes: payload.notes,
        adjustment_date: payload.adjustment_date,
      };
      await adjustmentService.updateStockAdjustment(updateReq);
      setShowDialog(false);
      setSelectedItem(null);
      refresh(true);
      toast.success("تم تعديل التسوية بنجاح");
    } catch (e: unknown) {
      toast.error("فشل التعديل: " + e);
    } finally {
      setSaving(false);
    }
  }, [selectedItem, refresh]);

  const handleSave = useCallback(async (payload: CreateStockAdjustmentRequest) => {
    if (selectedItem) {
      await handleUpdate(payload);
    } else {
      await handleCreate(payload);
    }
  }, [selectedItem, handleCreate, handleUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف سجل التسوية هذا؟ سيتم حذف حركة المخزون المرتبطة به.")) return;
    try {
      await adjustmentService.deleteStockAdjustment(id);
      toast.success("تم الحذف بنجاح");
      setSelectedItem(null);
      setShowDialog(false);
      refresh(true);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [refresh]);

  const handleView = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const handleEditClick = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(true);
  }, []);

  const handleNewClick = useCallback(() => {
    setSelectedItem(null);
    setShowDialog(true);
  }, []);

  const handleRowClick = useCallback((item: StockAdjustment) => {
    setSelectedItem(item);
    setShowDialog(false);
  }, []);

  const isLoading = adjLoading || refreshing || loadingProducts;

  const handleCloseForm = useCallback(() => {
    setShowDialog(false);
    if (!selectedItem) setSelectedItem(null);
  }, [selectedItem]);

  return (
    <OperationalTableTemplate
      title="تسويات الجرد"
      toolbar={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleNewClick} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
            <Plus className="w-4 h-4 ml-2" /> تسوية جديدة
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleView(selectedItem)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Eye className="w-4 h-4 ml-2 text-blue-500" /> عرض
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleEditClick(selectedItem)}
            className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Settings2 className="w-4 h-4 ml-2 text-amber-500" /> تعديل
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedItem}
            onClick={() => selectedItem && handleDelete(selectedItem.id)}
            className="h-9 border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 font-bold transition-all">
            <Trash2 className="w-4 h-4 ml-2 text-rose-500" /> حذف
          </Button>
        </div>
      }
      tableContent={
        <AdjustmentsTable
          data={adjustments}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          selectedId={selectedItem?.id}
          onView={handleView}
          onEdit={handleEditClick}
          onDelete={handleDelete}
          onRowClick={handleRowClick}
        />
      }
      sidePanel={
        selectedItem && !showDialog ? (
          <AdjustmentDetailPanel
            item={selectedItem}
            materials={products}
            onClose={() => setSelectedItem(null)}
            onEdit={handleEditClick}
            onDelete={handleDelete}
          />
        ) : showDialog ? (
          <AdjustmentForm
            onClose={handleCloseForm}
            products={products}
            onSave={handleSave}
            saving={saving}
            initialValues={selectedItem}
          />
        ) : null
      }
      isPanelOpen={!!selectedItem || showDialog}
    />
  );
}
