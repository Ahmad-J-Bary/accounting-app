import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, AlertTriangle, Banknote, PackageOpen } from "lucide-react";
import { damagedService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useDataTable } from '@shared/hooks';
import { DamagedTable } from '@modules/inventory/components/DamagedTable';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';
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
    fetchData: () => damagedService.listDamagedItems(),
    searchFields: ["material_name", "material_id", "reason"],
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
    } catch {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleCreate = async (payload: CreateDamagedItemRequest) => {
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
  };

  const isLoading = itemsLoading || refreshing || loadingProducts;

  const totalCost = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.cost_impact || "0"), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.quantity || "0"), 0), [items]);

  const stats = useMemo(() => [
    { label: "إجمالي السجلات", value: items.length, icon: AlertTriangle, color: "text-amber-500" },
    { label: "إجمالي الكميات", value: totalQty.toFixed(2), icon: PackageOpen, color: "text-amber-600" },
    { label: "خسائر التكلفة", value: formatMonetaryAmount(totalCost, "base"), icon: Banknote, color: "text-rose-600" },
  ], [items.length, totalQty, totalCost, formatMonetaryAmount]);

  return (
    <OperationalTableTemplate
      title="إدارة المواد التالفة"
      stats={stats}
      toolbar={
        <Button size="sm" onClick={() => setShowDialog(true)} className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 font-bold">
          <Plus className="w-4 h-4 ml-2" /> تسجيل تالف
        </Button>
      }
      tableContent={
        <DamagedTable
          items={items}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
        />
      }
      sidePanel={
        showDialog ? (
          <DamagedForm
            onClose={() => setShowDialog(false)}
            products={products}
            onSave={handleCreate}
            saving={saving}
          />
        ) : null
      }
      isPanelOpen={showDialog}
    />
  );
}