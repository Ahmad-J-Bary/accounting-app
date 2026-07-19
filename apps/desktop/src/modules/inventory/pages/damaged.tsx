import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@shared/ui/button";
import { Plus, Download } from "lucide-react";
import { damagedService } from '@modules/inventory/api/damagedService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, UpdateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable } from '@shared/hooks';
import { DamagedTable } from '@modules/inventory/components/DamagedTable';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
import { DamagedDetailPanel } from '@modules/inventory/components/DamagedDetailPanel';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useExcelExport } from "@shared/hooks";
import { currencyAmountCols } from "@shared/lib/excel/column-helpers";
import type { ExcelExportColumn } from "@shared/lib/excel";
    import { formatDateTime, formatNumber, toLocalString, getNumberingSystem } from "@shared/lib/format";

export default function DamagedPage() {
  const queryClient = useQueryClient();

  const {
    filtered: items,
    loading: itemsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    queryKey: ["damaged-items"],
    fetchData: () => damagedService.list(),
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
      const pData = await materialService.list();
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
      await damagedService.create(payload);
      setShowDialog(false);
      refresh(true);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success("تم تسجيل التالف بنجاح");
    } catch (e: unknown) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  }, [refresh, queryClient]);

  const handleUpdate = useCallback(async (payload: CreateDamagedItemRequest) => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const updateReq: UpdateDamagedItemRequest = {
        id: selectedItem.id,
        ...payload,
      };
      await damagedService.update(updateReq);
      setShowDialog(false);
      setSelectedItem(null);
      refresh(true);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast.success("تم التعديل بنجاح");
    } catch (e: unknown) {
      toast.error("فشل التعديل: " + e);
    } finally {
      setSaving(false);
    }
  }, [selectedItem, refresh, queryClient]);

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
      await damagedService.delete(id);
      toast.success("تم الحذف بنجاح");
      setSelectedItem(null);
      setShowDialog(false);
      refresh(true);
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [refresh, queryClient]);

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

  const { currencies, formatAmount } = useCurrencyContext();
  const { exportData } = useExcelExport();

  const handleExport = useCallback(async () => {
    const currCols = currencyAmountCols("cost", "الخسارة", (row) => parseFloat((row as unknown as DamagedItem).cost_impact || "0"), currencies, formatAmount);
    const columns: ExcelExportColumn[] = [
{ id: "id", label: "الرقم", accessor: (row) => {
        const i = row as unknown as DamagedItem;
        if (i.reference) return parseInt(i.reference, 10) || 0;
        const idx = items.findIndex(x => x.id === i.id);
        return idx >= 0 ? idx + 1 : 1;
      } },
      { id: "material_name", label: "المادة", accessor: (row) => String((row as unknown as DamagedItem).material_name ?? "") },
      { id: "quantity", label: "الكمية", accessor: (row) => Math.round(parseFloat((row as unknown as DamagedItem).quantity || "0")), numeric: true },
      ...currCols,
      { id: "reason", label: "السبب", accessor: (row) => String((row as unknown as DamagedItem).reason ?? "") },
      { id: "damage_date", label: "التاريخ", accessor: (row) => formatDateTime((row as unknown as DamagedItem).damage_date) },
    ];
    await exportData(items as unknown as Record<string, unknown>[], columns, "إدارة المواد التالفة", { sheetName: "إدارة المواد التالفة", autoFilter: true, numeralSystem: getNumberingSystem() });
  }, [items, currencies, formatAmount, exportData]);

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleNewClick}
            className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 font-bold"
          >
            <Plus className="w-4 h-4 ml-2" /> تسجيل تالف
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-200 hover:bg-slate-50 font-bold">
            <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
          </Button>
        </div>
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