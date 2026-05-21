import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Plus, Scale, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatDateTime } from '@shared/lib/format';
import { adjustmentService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { UnifiedTable, type UnifiedColumn } from '@widgets/table-shell/UnifiedTable';
import { TableShell } from '@widgets/table-shell/TableShell';
import { useDataTable, useUnifiedColumns } from '@shared/hooks';
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

  const allColumns = useMemo<UnifiedColumn<StockAdjustment>[]>(() => [
    { 
      id: "product_name",
      header: "المنتج / الصنف", 
      label: "اسم المنتج", 
      accessor: (a) => a.product_name ?? a.product_id, 
      className: "font-black text-slate-900 min-w-[180px]" 
    },
    { 
      id: "adjustment_date",
      header: "التاريخ", 
      label: "تاريخ التسوية", 
      accessor: (a) => formatDateTime(a.adjustment_date),
      className: "tabular-nums text-slate-500 font-medium w-32"
    },
    { 
      id: "system_quantity",
      header: "كمية النظام", 
      label: "كمية النظام (قبل التسوية)", 
      accessor: (a) => parseFloat(a.system_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums text-slate-600 w-24" 
    },
    { 
      id: "actual_quantity",
      header: "الكمية الفعلية", 
      label: "الكمية الفعلية (الموجودة)", 
      accessor: (a) => parseFloat(a.actual_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-800 w-24" 
    },
    { 
      id: "difference",
      header: "الفارق", 
      label: "فارق الكمية (عجز/زيادة)", 
      accessor: (a) => {
        const diff = parseFloat(a.difference);
        return (
          <span className={cn(
            "inline-flex items-center gap-1.5 font-black tabular-nums text-base",
            diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400"
          )}>
            {diff > 0 ? <ArrowUpCircle className="w-4 h-4" /> : diff < 0 ? <ArrowDownCircle className="w-4 h-4" /> : null}
            {diff > 0 ? "+" : ""}{diff.toFixed(2)}
          </span>
        );
      },
      align: "left",
      className: "w-32"
    },
    { 
      id: "reason",
      header: "السبب", 
      label: "سبب التسوية", 
      accessor: (a) => a.reason ?? "—", 
      className: "text-slate-500 text-xs font-medium italic min-w-[150px]" 
    }
  ], []);

  const { enrichedColumns, toolbarColumns, toggleColumn } = useUnifiedColumns({
    tableId: "adjustments-unified",
    columns: allColumns,
    defaultVisible: ["product_name", "adjustment_date", "difference", "reason"],
  });

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
        <TableShell
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث بالمنتج أو السبب..."
          columns={toolbarColumns}
          onColumnToggle={toggleColumn}
        >
          <UnifiedTable
            data={adjustments}
            columns={enrichedColumns}
            loading={isLoading}
            emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
          />
        </TableShell>
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
