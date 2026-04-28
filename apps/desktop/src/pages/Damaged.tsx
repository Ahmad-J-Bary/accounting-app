import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { damagedService } from "@/services/inventoryService";
import { materialService } from "@/services/materialService";
import type { DamagedItem, CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";

// Refactored Components & Hooks
import { DataTable, Column } from "@/components/erp/shared/DataTable";
import { useDataTable } from "@/hooks/useDataTable";
import { DamagedForm } from "@/components/erp/inventory/DamagedForm";

export default function Damaged() {
  const {
    filtered: items,
    loading: itemsLoading,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    fetchData: () => damagedService.listDamagedItems(),
    searchFields: ["product_name", "product_id", "reason"],
    errorLabel: "فشل تحميل المواد التالفة",
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

  const totalCost = useMemo(() => items.reduce((s, i) => s + parseFloat(i.cost_impact || "0"), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s, i) => s + parseFloat(i.quantity || "0"), 0), [items]);

  const handleCreate = async (payload: CreateDamagedItemRequest) => {
    setSaving(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل التالف بنجاح");
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<DamagedItem>[]>(() => [
    { header: "المنتج", accessor: (i) => i.product_name ?? i.product_id, className: "font-medium" },
    { header: "السبب", accessor: "reason", className: "text-muted-foreground" },
    { header: "التاريخ", accessor: (i) => formatDate(i.damage_date) },
    { 
      header: "الكمية", 
      accessor: (i) => parseFloat(i.quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums text-amber-600" 
    },
    { 
      header: "التكلفة", 
      accessor: (i) => formatCurrency(parseFloat(i.cost_impact)), 
      align: "left", 
      className: "tabular-nums text-red-600" 
    }
  ], []);

  const isLoading = itemsLoading || loadingProducts;

  return (
    <>
      <PageHeader
        title="المواد التالفة"
        subtitle="تسجيل ومتابعة المواد والمنتجات التالفة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المخزون" }, { label: "التالف" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin" : ""}`} />تحديث
            </Button>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />تسجيل تالف
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> إجمالي السجلات
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{items.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي الكميات التالفة</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{totalQty.toFixed(2)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">إجمالي تأثير التكلفة</div>
          <div className="text-2xl font-bold text-red-600 tabular-nums mt-1">{formatCurrency(totalCost)}</div>
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
          data={items}
          columns={columns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
        />
      </Card>

      <DamagedForm
        open={showDialog}
        onOpenChange={setShowDialog}
        products={products}
        onSave={handleCreate}
        saving={saving}
      />
    </>
  );
}