import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, Scale, ArrowUpCircle, ArrowDownCircle, Settings2 } from "lucide-react";
import { formatDate } from '@shared/lib/format';
import { adjustmentService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { StockAdjustment, CreateStockAdjustmentRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@shared/ui/dropdown-menu";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable, useColumnPreferences } from '@shared/hooks';
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
    } catch (e: unknown) {
      toast.error("فشل تحميل المنتجات");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const availableColumns = useMemo(() => [
    { id: "product_name", label: "المنتج" },
    { id: "adjustment_date", label: "التاريخ" },
    { id: "system_quantity", label: "كمية النظام" },
    { id: "actual_quantity", label: "الكمية الفعلية" },
    { id: "difference", label: "الفارق" },
    { id: "reason", label: "السبب" },
  ], []);

  const { visibleColumns, toggleColumn, isVisible } = useColumnPreferences("stock_adjustments", ["product_name", "adjustment_date", "difference", "reason"]);

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

  const columns = useMemo<Column<StockAdjustment>[]>(() => [
    { 
      id: "product_name",
      header: "المنتج / الصنف", 
      accessor: (a: StockAdjustment) => a.product_name ?? a.product_id, 
      className: "font-black text-slate-900" 
    },
    { 
      id: "adjustment_date",
      header: "التاريخ", 
      accessor: (a: StockAdjustment) => formatDate(a.adjustment_date),
      className: "tabular-nums text-slate-500 font-medium"
    },
    { 
      id: "system_quantity",
      header: "كمية النظام", 
      accessor: (a: StockAdjustment) => parseFloat(a.system_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums text-slate-600" 
    },
    { 
      id: "actual_quantity",
      header: "الكمية الفعلية", 
      accessor: (a: StockAdjustment) => parseFloat(a.actual_quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums font-bold text-slate-800" 
    },
    { 
      id: "difference",
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
      id: "reason",
      header: "السبب", 
      accessor: (a: StockAdjustment) => a.reason ?? "—", 
      className: "text-slate-500 text-xs font-medium italic" 
    }
  ], []);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      if (!col.id) return true;
      return visibleColumns.includes(col.id);
    });
  }, [columns, visibleColumns]);

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
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white border-slate-200">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" />تسوية جديدة
          </Button>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-11 w-11 bg-white border-slate-200">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] max-h-[450px] overflow-y-auto shadow-xl">
              <DropdownMenuLabel className="text-right text-xs font-black uppercase text-slate-400 tracking-widest">تخصيص الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableColumns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={isVisible(col.id)}
                  onCheckedChange={() => toggleColumn(col.id)}
                  className="text-right flex-row-reverse gap-2 text-xs font-bold py-2"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-6 mr-auto pl-2">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</span>
                <div className="flex items-center gap-2">
                   <s.icon className={cn("w-4 h-4", s.color)} />
                   <span className={cn("text-lg font-black tabular-nums", s.color)}>{s.value}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      }
      tableContent={
        <DataTable
          data={adjustments}
          columns={filteredColumns}
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
