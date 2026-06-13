import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";

export default function SalesReturns() {
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
    returnType: "SalesReturn",
    partyType: "customer",
    priceField: "last_sale_price"
  });

  const searchParams = new URLSearchParams(location.search);
  const customerIdFilter = searchParams.get("customerId") || undefined;

  const handleDelete = useCallback(async (id: string) => {
    try {
      await returnService.deleteSalesReturn(id);
      toast.success("تم حذف المرتجع بنجاح");
      loadData(false);
    } catch (e) {
      toast.error("فشل الحذف: " + e);
    }
  }, [loadData]);

  if (isCreating) {
    return (
      <ReturnsEditor
        returnType="SalesReturn"
        partyType="customer"
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
      partyIdFilter={customerIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => setIsCreating(true)}
      onEdit={() => {}}
      onView={() => {}}
      onDelete={handleDelete}
      formatMonetaryAmount={formatMonetaryAmount}
      partyType="customer"
      title="مرتجعات المبيعات"
      createLabel="مرتجع جديد"
      searchPlaceholder="بحث برقم المرتجع أو الزبون..."
      emptyMessage="لا توجد مرتجعات مبيعات مسجلة"
      statsLabel="إجمالي المرتجعات"
      statsColor="text-blue-600"
      preferenceKey="sales-returns"
    />
  );
}
