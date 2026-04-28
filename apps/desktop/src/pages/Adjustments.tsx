import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { adjustmentService } from "@/services/inventoryService";
import { materialService } from "@/services/materialService";
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { AdjustmentForm } from "@/components/erp/inventory/AdjustmentForm";

export default function Adjustments() {
  const {
    filtered: adjustments,
    loading: adjLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<StockAdjustment>({
    fetchData: () => adjustmentService.listStockAdjustments(),
    searchFields: ["product_name", "product_id", "reason"],
    errorLabel: "فشل تحميل تسويات الجرد",
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
    } catch (e) {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const surplusCount = useMemo(() => adjustments.filter(a => parseFloat(a.difference) > 0).length, [adjustments]);
  const shortageCount = useMemo(() => adjustments.filter(a => parseFloat(a.difference) < 0).length, [adjustments]);

  const handleCreate = async (payload: CreateStockAdjustmentRequest) => {
    setSaving(true);
    try {
      await adjustmentService.createStockAdjustment(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل تسوية الجرد بنجاح");
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<StockAdjustment>[]>(() => [
    { header: "المنتج", accessor: (a) => a.product_name ?? a.product_id, className: "font-medium" },
    { header: "التاريخ", accessor: (a) => formatDate(a.adjustment_date) },
    { 
      header: "كمية النظام", 
      accessor: (a) => parseFloat(a.system_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums" 
    },
    { 
      header: "الكمية الفعلية", 
      accessor: (a) => parseFloat(a.actual_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums" 
    },
    { 
      header: "الفارق", 
      accessor: (a) => {
        const diff = parseFloat(a.difference);
        return (
          <span className={`font-bold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
          </span>
        );
      },
      align: "left",
      className: "tabular-nums"
    },
    { 
      header: "السبب", 
      accessor: (a) => a.reason ?? "—", 
      className: "text-muted-foreground text-xs" 
    }
  ], []);

  const isLoading = adjLoading || loadingProducts;

  return (
    <>
      <PageHeader
        title="تسويات الجرد"
        subtitle="مطابقة المخزون الفعلي مع سجلات النظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التسويات" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />تسوية جديدة
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي التسويات</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{adjustments.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">فائض مخزون</div>
          <div className="text-2xl font-bold text-green-600 tabular-nums mt-1">{surplusCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">عجز مخزون</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{shortageCount}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالمنتج أو السبب..." className="pr-10"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <DataTable
          data={adjustments}
          columns={columns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
        />
      </Card>

      <AdjustmentForm
        open={showDialog}
        onOpenChange={setShowDialog}
        products={products}
        onSave={handleCreate}
        saving={saving}
      />
    </>
  );
}