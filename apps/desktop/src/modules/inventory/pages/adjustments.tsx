import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Scale, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatCurrency, formatDate } from '@shared/lib/format';
import { adjustmentService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable } from '@shared/hooks';
import { AdjustmentForm } from '@modules/inventory/components/AdjustmentForm';

export default function Adjustments() {
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
    } catch (e: any) {
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
    } catch (e: any) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<StockAdjustment>[]>(() => [
    { 
      header: "المنتج / الصنف", 
      accessor: (a: StockAdjustment) => a.product_name ?? a.product_id, 
      className: "font-black text-slate-900" 
    },
    { 
      header: "التاريخ", 
      accessor: (a: StockAdjustment) => formatDate(a.adjustment_date),
      className: "tabular-nums text-slate-500 font-medium"
    },
    { 
      header: "كمية النظام", 
      accessor: (a: StockAdjustment) => parseFloat(a.system_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums text-slate-600" 
    },
    { 
      header: "الكمية الفعلية", 
      accessor: (a: StockAdjustment) => parseFloat(a.actual_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-800" 
    },
    { 
      header: "الفارق", 
      accessor: (a: StockAdjustment) => {
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
      align: "left"
    },
    { 
      header: "السبب", 
      accessor: (a: StockAdjustment) => a.reason ?? "—", 
      className: "text-slate-500 text-xs font-medium italic" 
    }
  ], []);

  const isLoading = adjLoading || refreshing || loadingProducts;

  const stats = useMemo(() => [
    { label: "إجمالي التسويات", value: adjustments.length, icon: Scale, color: "text-slate-900" },
    { label: "فائض مخزون", value: surplusCount, icon: ArrowUpCircle, color: "text-emerald-600" },
    { label: "عجز مخزون", value: shortageCount, icon: ArrowDownCircle, color: "text-rose-600" },
  ], [adjustments, surplusCount, shortageCount]);

  return (
    <OperationalTableTemplate
      title="تسويات الجرد"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />تسوية جديدة
          </Button>
        </div>
      }
      headerWidgets={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <div className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</div>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50", s.color)}>
                <s.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>
      }
      filterBar={
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="بحث بالمنتج أو السبب..."
              className="pr-10 h-11 border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      }
      tableContent={
        <DataTable
          data={adjustments}
          columns={columns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد تسويات مسجّلة"}
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
