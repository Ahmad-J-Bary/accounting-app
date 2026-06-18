import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { ReturnsList } from "../components/ReturnsList";
import { ReturnsEditor } from "../components/ReturnsEditor";
import { useReturnLifecycle } from "../hooks/useReturnLifecycle";
import { returnService } from "@modules/invoicing/api/returnService";
import { toast } from "sonner";
import type { SalesReturnDto, PurchaseReturnDto } from "@erp/shared-types";

export default function PurchaseReturns() {
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
    returnType: "PurchaseReturn",
    partyType: "supplier",
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

  if (view === "editor") {
    return (
      <ReturnsEditor
        returnType="PurchaseReturn"
        partyType="supplier"
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
      partyIdFilter={supplierIdFilter}
      onSearchChange={setSearch}
      onRefresh={() => loadData(false)}
      onCreate={() => {
        const uniqueId = `/purchase-returns/new-${Date.now()}`;
        openTab({ id: uniqueId, title: "مرتجع مشتريات جديد", path: uniqueId, closable: true });
      }}
      onEdit={(ret) => {
        openTab({ id: `/purchase-returns/${ret.id}`, title: `تعديل ${ret.return_number}`, path: `/purchase-returns/${ret.id}`, closable: true });
      }}
      onView={(ret) => {
        openTab({ id: `/purchase-returns/${ret.id}-view`, title: `عرض ${ret.return_number}`, path: `/purchase-returns/${ret.id}?mode=view`, closable: true });
      }}
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
