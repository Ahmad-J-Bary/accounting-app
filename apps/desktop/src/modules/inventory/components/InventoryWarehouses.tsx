import { Warehouse, Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Skeleton } from "@shared/ui/skeleton";
import type { WarehouseDto } from "@erp/shared-types";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { toast } from "sonner";

interface InventoryWarehousesProps {
  warehouses: WarehouseDto[];
  loading: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (warehouse: WarehouseDto) => void;
}

export function InventoryWarehouses({ warehouses, loading, onRefresh, onAdd, onEdit }: InventoryWarehousesProps) {
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستودع "${name}"؟`)) return;
    try {
      await warehouseService.deleteWarehouse(id);
      toast.success(`تم حذف المستودع "${name}"`);
      onRefresh();
    } catch (e) {
      toast.error(e as string);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <Skeleton className="w-16 h-16 rounded-2xl mb-8" />
            <Skeleton className="h-7 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-6" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Warehouse className="w-5 h-5 text-slate-600 shrink-0" />
          <h3 className="font-bold text-slate-900">المستودعات ({warehouses.length})</h3>
        </div>
        <Button
          size="sm"
          onClick={onAdd}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
        >
          <Plus className="w-4 h-4 ml-2 shrink-0" />إضافة مستودع
        </Button>
      </div>

      {warehouses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Warehouse className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-bold text-slate-600">لا توجد مستودعات</p>
          <p className="text-sm text-slate-400">قم بإضافة مستودع جديد للبدء</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onAdd}
            className="mt-4 border-dashed border-slate-300"
          >
            <Plus className="w-4 h-4 ml-2 shrink-0" />إضافة أول مستودع
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((w) => (
            <div key={w.id} className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="flex items-start justify-between mb-8">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner shrink-0", w.is_default ? "bg-emerald-600" : "bg-blue-600")}>
                  <Warehouse className="w-8 h-8 text-white" />
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0",
                  w.is_active
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-rose-50 text-rose-600 border-rose-100"
                )}>
                  {w.is_active ? "نشط" : "غير نشط"}
                </div>
              </div>

              <h3 className="font-black text-slate-900 text-xl mb-2">{w.name}</h3>
              {w.code && <div className="text-sm font-medium text-slate-400 mb-2 font-mono">{w.code}</div>}

              {w.address && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{w.address}</span>
                </div>
              )}
              {!w.code && !w.address && <div className="mb-4" />}

              {w.is_default && (
                <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 mb-4">
                  رئيسي
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => onEdit(w)}>
                  <Pencil className="w-3.5 h-3.5 ml-1.5 shrink-0" />تعديل
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-rose-600 hover:bg-rose-50 border-rose-200 hover:border-rose-300" onClick={() => handleDelete(w.id, w.name)}>
                  <Trash2 className="w-3.5 h-3.5 ml-1.5 shrink-0" />حذف
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
