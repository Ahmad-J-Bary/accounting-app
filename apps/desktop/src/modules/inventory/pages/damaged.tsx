import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Plus, Search, RefreshCw, AlertTriangle, Trash2, Banknote, PackageOpen } from "lucide-react";
import { formatCurrency, formatDate } from '@shared/lib/format';
import { damagedService } from '@modules/inventory/api/inventoryService';
import { materialService } from '@modules/inventory/api/materialService';
import type { DamagedItem, CreateDamagedItemRequest, MaterialDto } from "@erp/shared-types";
import { toast } from "sonner";
import { cn } from "@shared/lib/utils";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";

// Refactored Components & Hooks
import { DataTable, Column } from '@widgets/table-shell/DataTable';
import { useDataTable } from '@shared/hooks';
import { DamagedForm } from '@modules/inventory/components/DamagedForm';

export default function Damaged() {
  const {
    filtered: items,
    loading: itemsLoading,
    refreshing,
    search,
    setSearch,
    refresh,
  } = useDataTable<DamagedItem>({
    fetchData: () => damagedService.listDamagedItems(),
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

  const totalCost = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.cost_impact || "0"), 0), [items]);
  const totalQty = useMemo(() => items.reduce((s: number, i: DamagedItem) => s + parseFloat(i.quantity || "0"), 0), [items]);

  const handleCreate = async (payload: CreateDamagedItemRequest) => {
    setSaving(true);
    try {
      await damagedService.createDamagedItem(payload);
      setShowDialog(false);
      refresh(true);
      toast.success("تم تسجيل التالف بنجاح");
    } catch (e: any) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<Column<DamagedItem>[]>(() => [
    { 
      header: "المنتج / الصنف", 
      accessor: (i: DamagedItem) => i.product_name ?? i.product_id, 
      className: "font-black text-slate-900" 
    },
    { 
      header: "السبب", 
      accessor: "reason", 
      className: "text-slate-500 text-xs font-medium italic" 
    },
    { 
      header: "التاريخ", 
      accessor: (i: DamagedItem) => formatDate(i.damage_date),
      className: "tabular-nums text-slate-500 font-medium"
    },
    { 
      header: "الكمية", 
      accessor: (i: DamagedItem) => parseFloat(i.quantity).toFixed(2), 
      align: "left", 
      className: "tabular-nums font-bold text-amber-600" 
    },
    { 
      header: "التكلفة (USD)", 
      accessor: (i: DamagedItem) => formatCurrency(parseFloat(i.cost_impact)), 
      align: "left", 
      className: "tabular-nums font-black text-rose-600" 
    }
  ], []);

  const isLoading = itemsLoading || refreshing || loadingProducts;

  const stats = useMemo(() => [
    { label: "إجمالي السجلات", value: items.length, icon: AlertTriangle, color: "text-amber-500" },
    { label: "إجمالي الكميات", value: totalQty.toFixed(2), icon: PackageOpen, color: "text-amber-600" },
    { label: "خسائر التكلفة", value: formatCurrency(totalCost), icon: Banknote, color: "text-rose-600" },
  ], [items, totalQty, totalCost]);

  return (
    <OperationalTableTemplate
      title="إدارة المواد التالفة"
      toolbar={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={isLoading} className="bg-white">
            <RefreshCw className={cn("w-4 h-4 ml-2", isLoading && "animate-spin")} />تحديث
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)} className="bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100">
            <Plus className="w-4 h-4 ml-2" />تسجيل تالف
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
          data={items}
          columns={columns}
          loading={isLoading}
          emptyMessage={search ? "لا توجد نتائج للبحث" : "لا توجد سجلات تالف"}
        />
      }
    >
      <DamagedForm
        open={showDialog}
        onClose={() => setShowDialog(false)}
        products={products}
        onSave={handleCreate}
        saving={saving}
      />
    </OperationalTableTemplate>
  );
}