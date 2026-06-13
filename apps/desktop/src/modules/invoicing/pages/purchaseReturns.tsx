import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";

export default function PurchaseReturns() {
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);

  const {
    returns,
    parties,
    materials,
    loading,
    refreshing,
    search,
    setSearch,
    loadData,
    formatMonetaryAmount,
  } = useReturnLifecycle({
    returnType: "PurchaseReturn",
    partyType: "supplier",
    priceField: "last_purchase_price"
  });

  const searchParams = new URLSearchParams(location.search);
  const supplierIdFilter = searchParams.get("supplierId") || undefined;

  const handleDelete = useCallback(async (id: string) => {
    try {
      await returnService.deletePurchaseReturn(id);
      toast.success("تم حذف المرتجع بنجاح");
      loadData(false);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [loadData]);

  if (isCreating) {
    return (
      <ReturnsEditor
        returnType="PurchaseReturn"
        partyType="supplier"
        parties={parties}
        materials={materials}
        onSaved={() => { setIsCreating(false); loadData(false); }}
        onClose={() => setIsCreating(false)}
      />
    );
  }

  return (
    <ReturnsList
      returns={returns}
      loading={loading || refreshing}
      search={search}
      partyIdFilter={supplierIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => setIsCreating(true)}
      onEdit={() => {}}
      onView={() => {}}
      onDelete={handleDelete}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="supplier"
      title="مرتجعات المشتريات"
      createLabel="مرتجع جديد"
      searchPlaceholder="بحث برقم المرتجع أو المورد..."
      emptyMessage="لا توجد مرتجعات مشتريات مسجلة"
      statsLabel="إجمالي المرتجعات"
      statsColor="text-amber-600"
      preferenceKey="purchase-returns"
    />
  );
}
