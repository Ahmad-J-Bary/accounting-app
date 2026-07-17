import { useState, useEffect, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Eye, Settings2, Trash2, Download } from "lucide-react";
import { adjustmentService } from '@modules/inventory/api/adjustmentService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { AdjustmentsTable } from '@modules/inventory/components/AdjustmentsTable';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';
import { AdjustmentDetailPanel } from '@modules/inventory/components/AdjustmentDetailPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExcelExport } from "@shared/hooks";
import { currencyAmountCols } from "@shared/lib/excel/column-helpers";
import type { ExcelExportColumn } from "@shared/lib/excel";
import { formatDateTime } from "@shared/lib/format";

export default function AdjustmentsPage() {
  const {
    filtered: adjustments,
    loading: adjLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockAdjustment>({
    queryKey: ["stock-adjustments"],
    fetchData: () => adjustmentService.list(),
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
      const pData = await materialService.list();
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
      await adjustmentService.create(payload);
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
      await adjustmentService.update(updateReq);
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
      await adjustmentService.delete(id);
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

  const { currencies, formatAmount } = useCurrencyContext();
  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("total_cost", "التكلفة", (row) => Math.abs(parseFloat((row as unknown as StockAdjustment).total_cost_base || "0")), currencies, formatAmount);
    const columns: ExcelExportColumn[] = [
      { id: "id", label: "الرقم", accessor: (row) => parseInt((row as unknown as StockAdjustment).reference ?? "0", 10) || 0 },
      { id: "material_name", label: "المادة", accessor: (row) => String((row as unknown as StockAdjustment).material_name ?? "") },
      { id: "system_quantity", label: "كمية النظام", accessor: (row) => parseFloat((row as unknown as StockAdjustment).system_quantity || "0") },
      { id: "actual_quantity", label: "الكمية المجرودة", accessor: (row) => parseFloat((row as unknown as StockAdjustment).actual_quantity || "0") },
      { id: "difference", label: "الفارق", accessor: (row) => parseFloat((row as unknown as StockAdjustment).difference || "0") },
      ...currCols,
      { id: "notes", label: "ملاحظة", accessor: (row) => String((row as unknown as StockAdjustment).notes ?? (row as unknown as StockAdjustment).reason ?? "") },
      { id: "adjustment_date", label: "التاريخ", accessor: (row) => formatDateTime((row as unknown as StockAdjustment).adjustment_date) },
    ];
    await exportData(adjustments as unknown as Record<string, unknown>[], columns, "تسويات الجرد", { sheetName: "تسويات الجرد", autoFilter: true });
  }, [adjustments, currencies, formatAmount, exportData]);

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
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
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
