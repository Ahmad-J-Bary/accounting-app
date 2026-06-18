import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";

export default function SalesReturns() {
  const location = useLocation();

  const {
    view,
    isReadOnly,
    returns,
    parties,
    materials,
    warehouses,
    loading,
    refreshing,
    search,
    setSearch,
    loadData,
    formatMonetaryAmount,
    openTab,
    closeTab,
    activeTabId,
    editingReturn,
  } = useReturnLifecycle({
    returnType: "SalesReturn",
    partyType: "customer",
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

  if (view === "editor") {
    return (
      <ReturnsEditor
        returnType="SalesReturn"
        partyType="customer"
        parties={parties}
        materials={materials}
        warehouses={warehouses}
        onSaved={() => { loadData(false); closeTab(activeTabId); }}
        onClose={() => closeTab(activeTabId)}
        returnId={editingReturn?.id}
        readOnly={isReadOnly}
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
      onCreate={() => {
        const uniqueId = `/sales-returns/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "مرتجع مبيعات جديد", path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}`, title: `تعديل ${ret.return_number}`, path: `/sales-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/sales-returns/${ret.id}-view`, title: `عرض ${ret.return_number}`, path: `/sales-returns/${ret.id}?mode=view`, closable: true });
      }}
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
