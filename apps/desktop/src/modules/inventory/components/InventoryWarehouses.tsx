import { useMemo } from "react";
import { Warehouse, Plus, Pencil, Trash2, MapPin, Package, Hash } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Skeleton } from "@shared/ui/skeleton";
import type { WarehouseDto, MaterialDto } from "@erp/shared-types";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { toast } from "sonner";

export type DisplayStyle = 'cards-small' | 'cards-medium' | 'cards-large' | 'list' | 'rows';

interface InventoryWarehousesProps {
  warehouses: WarehouseDto[];
  loading: boolean;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (warehouse: WarehouseDto) => void;
  onViewMaterials?: (warehouse: WarehouseDto) => void;
  displayStyle?: DisplayStyle;
  search?: string;
  products?: MaterialDto[];
  stockByWarehouse?: Map<string, Map<string, number>>;
}

export function InventoryWarehouses({
  warehouses, loading, onRefresh, onAdd, onEdit, onViewMaterials,
  displayStyle = 'cards-medium',
  search, products, stockByWarehouse,
}: InventoryWarehousesProps) {
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستودع "${name}"؟`)) return;
    try {
      await warehouseService.delete(id);
      toast.success(`تم حذف المستودع "${name}"`);
      onRefresh();
    } catch (e) {
      toast.error(e as string);
    }
  };

  const matchedMaterialsByWarehouse = useMemo(() => {
    if (!search?.trim() || !products || !stockByWarehouse) return null;
    const q = search.toLowerCase();
    const matchingIds = products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q)) ||
        (p.barcode?.toLowerCase().includes(q))
      )
      .map(p => p.id);
    const map = new Map<string, { name: string; qty: number; qtyText: string }[]>();
    for (const w of warehouses) {
      const items: { name: string; qty: number; qtyText: string }[] = [];
      for (const mid of matchingIds) {
        const whMap = stockByWarehouse.get(mid);
        const qty = whMap?.get(w.id) || 0;
        if (qty > 0) {
          const mat = products.find(p => p.id === mid);
          items.push({ name: mat?.name || mid, qty, qtyText: qty.toLocaleString() });
        }
      }
      if (items.length > 0) map.set(w.id, items);
    }
    return map;
  }, [search, products, stockByWarehouse, warehouses]);

  if (loading) {
    const skeletonCount = displayStyle === 'rows' ? 5 : 3;
    return (
      <div className={cn({
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4": displayStyle === 'cards-small',
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6": displayStyle === 'cards-medium',
        "grid grid-cols-1 md:grid-cols-2 gap-8": displayStyle === 'cards-large',
        "flex flex-col gap-3": displayStyle === 'list',
        "flex flex-col gap-1": displayStyle === 'rows',
      })}>
        {displayStyle === 'rows' ? (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))
        ) : (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <Skeleton className="w-14 h-14 rounded-2xl mb-6" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <Skeleton className="h-9 flex-1 rounded-lg" />
                <Skeleton className="h-9 flex-1 rounded-lg" />
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Warehouse className="w-16 h-16 mb-4 opacity-30" />
        <p className="font-bold text-slate-600">لا توجد مستودعات</p>
        <p className="text-sm text-slate-400">قم بإضافة مستودع جديد للبدء</p>
        <Button size="sm" variant="outline" onClick={onAdd} className="mt-4 border-dashed border-slate-300">
          <Plus className="w-4 h-4 ml-2 shrink-0" />إضافة أول مستودع
        </Button>
      </div>
    );
  }

  // ── Render helpers ──

  const renderActions = (w: WarehouseDto) => (
    <div className="flex gap-2 pt-4 border-t border-slate-100">
      <Button variant="outline" size="sm" className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => onEdit(w)}>
        <Pencil className="w-3.5 h-3.5 ml-1.5 shrink-0" />تعديل
      </Button>
      {onViewMaterials && (
        <Button variant="outline" size="sm" className="flex-1 border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => onViewMaterials(w)}>
          <Package className="w-3.5 h-3.5 ml-1.5 shrink-0" />المواد
        </Button>
      )}
      <Button variant="outline" size="sm" className={cn("flex-1", w.is_default ? "text-slate-300 border-slate-200 cursor-not-allowed" : "text-rose-600 hover:bg-rose-50 border-rose-200 hover:border-rose-300")} onClick={() => handleDelete(w.id, w.name)} disabled={w.is_default} title={w.is_default ? 'لا يمكن حذف المستودع الرئيسي' : ''}>
        <Trash2 className="w-3.5 h-3.5 ml-1.5 shrink-0" />حذف
      </Button>
    </div>
  );

  const renderMatchedItems = (w: WarehouseDto) => {
    const items = matchedMaterialsByWarehouse?.get(w.id);
    if (!items?.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mb-3">
        {items.slice(0, 3).map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Hash className="w-2.5 h-2.5" />
            {item.name}
            <span className="text-amber-500 mx-0.5">·</span>
            {item.qtyText}
          </span>
        ))}
        {items.length > 3 && (
          <span className="text-[10px] text-slate-400 font-medium px-1 leading-6">+{items.length - 3}</span>
        )}
      </div>
    );
  };

  // ── Rows layout ──
  if (displayStyle === 'rows') {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-black text-slate-500 border-b border-slate-200">الاسم</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-black text-slate-500 border-b border-slate-200">العنوان</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-black text-slate-500 border-b border-slate-200">الحالة</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-black text-slate-500 border-b border-slate-200">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", w.is_default ? "bg-emerald-100" : "bg-blue-100")}>
                      <Warehouse className={cn("w-4 h-4", w.is_default ? "text-emerald-600" : "text-blue-600")} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm">{w.name}</span>
                      {w.is_default && <span className="mr-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">رئيسي</span>}
                    </div>
                  </div>
                  {renderMatchedItems(w)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{w.address || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold", w.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                    {w.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-center">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => onEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {onViewMaterials && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => onViewMaterials(w)}>
                        <Package className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className={cn("h-8 px-2", w.is_default ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:text-rose-600 hover:bg-rose-50")} onClick={() => handleDelete(w.id, w.name)} disabled={w.is_default}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── List layout ──
  if (displayStyle === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {warehouses.map((w) => (
          <div key={w.id} className="group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", w.is_default ? "bg-emerald-100" : "bg-blue-100")}>
                  <Warehouse className={cn("w-5 h-5", w.is_default ? "text-emerald-600" : "text-blue-600")} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{w.name}</span>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", w.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                      {w.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                    {w.is_default && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">رئيسي</span>}
                  </div>
                  {w.address && <p className="text-xs text-slate-500 mt-0.5 truncate">{w.address}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-slate-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => onEdit(w)}>
                  <Pencil className="w-3.5 h-3.5 ml-1" />تعديل
                </Button>
                {onViewMaterials && (
                  <Button variant="ghost" size="sm" className="h-8 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => onViewMaterials(w)}>
                    <Package className="w-3.5 h-3.5 ml-1" />المواد
                  </Button>
                )}
                <Button variant="ghost" size="sm" className={cn("h-8", w.is_default ? "text-slate-300 cursor-not-allowed" : "text-rose-600 hover:bg-rose-50")} onClick={() => handleDelete(w.id, w.name)} disabled={w.is_default}>
                  <Trash2 className="w-3.5 h-3.5 ml-1" />حذف
                </Button>
              </div>
            </div>
            {renderMatchedItems(w)}
          </div>
        ))}
      </div>
    );
  }

  // ── Cards layout (small / medium / large) ──
  const isSmall = displayStyle === 'cards-small';
  const isLarge = displayStyle === 'cards-large';

  return (
    <div className={cn({
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4": isSmall,
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6": displayStyle === 'cards-medium',
      "grid grid-cols-1 md:grid-cols-2 gap-8": isLarge,
    })}>
      {warehouses.map((w) => (
        <div
          key={w.id}
          className={cn(
            "group relative bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300",
            isSmall ? "p-5 rounded-2xl" : isLarge ? "p-10 rounded-3xl" : "p-8 rounded-3xl"
          )}
        >
          {/* Header */}
          <div className={cn("flex items-start justify-between", isSmall ? "mb-4" : isLarge ? "mb-10" : "mb-8")}>
            <div className={cn(
              "rounded-2xl flex items-center justify-center shadow-inner shrink-0",
              isSmall ? "w-12 h-12" : isLarge ? "w-20 h-20" : "w-16 h-16",
              w.is_default ? "bg-emerald-600" : "bg-blue-600"
            )}>
              <Warehouse className={cn("text-white", isSmall ? "w-6 h-6" : isLarge ? "w-10 h-10" : "w-8 h-8")} />
            </div>
            <span className={cn(
              "rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0",
              isSmall ? "px-2 py-0.5" : isLarge ? "px-4 py-1.5" : "px-3 py-1",
              w.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
            )}>
              {w.is_active ? "نشط" : "غير نشط"}
            </span>
          </div>

          {/* Name */}
          <h3 className={cn(
            "font-black text-slate-900",
            isSmall ? "text-base mb-1" : isLarge ? "text-2xl mb-3" : "text-xl mb-2"
          )}>{w.name}</h3>

          {/* Address */}
          {w.address && (
            <div className={cn("flex items-center gap-1.5", isSmall ? "text-xs mb-3" : isLarge ? "text-base mb-5" : "text-sm mb-4", "text-slate-500")}>
              <MapPin className={cn("text-slate-400 shrink-0", isSmall ? "w-3 h-3" : isLarge ? "w-4 h-4" : "w-3.5 h-3.5")} />
              <span>{w.address}</span>
            </div>
          )}

          {/* Default badge */}
          {w.is_default && (
            <div className={cn(
              "inline-flex items-center rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100",
              isSmall ? "px-2 py-0.5 mb-3" : isLarge ? "px-3 py-1.5 mb-5" : "px-2.5 py-1 mb-4"
            )}>
              رئيسي
            </div>
          )}

          {/* Matched material badges */}
          {renderMatchedItems(w)}

          {/* Actions */}
          {renderActions(w)}
        </div>
      ))}
    </div>
  );
}
