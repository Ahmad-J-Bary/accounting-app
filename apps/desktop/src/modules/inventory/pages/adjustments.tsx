import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Scale, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { adjustmentService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

import { useDataTable } from '@shared/hooks';
import { AdjustmentsTable } from '@modules/inventory/components/AdjustmentsTable';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';

export default function AdjustmentsPage() {
  const {
    filtered: adjustments,
    loading: adjLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockAdjustment>({
    fetchData: () => adjustmentService.listStockAdjustments(),
    searchFields: ["product_name", "product_id", "reason"],
  });

  const [products, setProducts] = useState<MaterialDto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const pData = await materialService.listMaterials();
      setProducts(pData);
    } catch (e: unknown) {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const surplusCount = useMemo(() => adjustments.filter((a: StockAdjustment) => parseFloat(a.difference) > 0).length, [adjustments]);
  const shortageCount = useMemo(() => adjustments.filter((a: StockAdjustment) => parseFloat(a.difference) < 0).length, [adjustments]);

  const handleCreate = async (payload: CreateStockAdjustmentRequest) => {
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
  };

  const isLoading = adjLoading || refreshing || loadingProducts;

  const stats = useMemo(() => [
    { label: "إجمالي التسويات", value: adjustments.length, icon: Scale, color: "text-slate-900" },
    { label: "فائض مخزون", value: surplusCount, icon: ArrowUpCircle, color: "text-emerald-600" },
    { label: "عجز مخزون", value: shortageCount, icon: ArrowDownCircle, color: "text-rose-600" },
  ], [adjustments.length, surplusCount, shortageCount]);

  return (
    <OperationalTableTemplate
      title="تسويات الجرد"
      stats={stats}
      toolbar={
        <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> تسوية جديدة
        </Button>
      }
      tableContent={
        <AdjustmentsTable
          data={adjustments}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
        />
      }
    >
      <AdjustmentForm
        open={showDialog}
        onOpenChange={setShowDialog}
        products={products}
        onSave={handleCreate}
        saving={saving}
      />
    </OperationalTableTemplate>
  );
}
