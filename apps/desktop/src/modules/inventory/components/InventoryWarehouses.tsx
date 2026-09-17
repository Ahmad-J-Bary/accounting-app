import { useCallback, useMemo } from "react";
import { Warehouse, Plus, Pencil, Trash2, MapPin, Package, Hash } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { Skeleton } from "@shared/ui/skeleton";
import type { WarehouseDto, MaterialDto } from "@erp/shared-types";
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { toast } from "sonner";
import { toLocalString } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveWarehouseDisplayName } from "@shared/lib/system-labels";

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
  const { t } = useLocalization();
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(t("warehouses.deleteConfirm", { namespace: "inventory", vars: { name },  }))) return;
    try {
      await warehouseService.delete(id);
      toast.success(t("warehouses.deletedToast", { namespace: "inventory", vars: { name },  }));
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
          items.push({ name: mat?.name || mid, qty, qtyText: toLocalString(qty) });
        }
      }
      if (items.length > 0) map.set(w.id, items);
    }
    return map;
  }, [search, products, stockByWarehouse, warehouses]);

  const displayName = useCallback(
    (warehouse: WarehouseDto) => resolveWarehouseDisplayName(warehouse, t),
    [t],
  );

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
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))
        ) : (
          Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="bg-card p-6 rounded-3xl border border-border shadow-sm">
              <Skeleton className="w-14 h-14 rounded-2xl mb-6" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-4 w-2/3 mb-4" />
              <div className="flex gap-2 pt-3 border-t border-border">
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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Warehouse className="w-16 h-16 mb-4 opacity-30" />
        <p className="font-bold text-muted-foreground">{t("warehouses.empty", { namespace: "inventory",  })}</p>
        <p className="text-sm text-muted-foreground">{t("warehouses.emptyHint", { namespace: "inventory",  })}</p>
        <Button size="sm" variant="outline" onClick={onAdd} className="mt-4 border-dashed border-border">
          <Plus className="w-4 h-4 ml-2 shrink-0" />{t("warehouses.addFirst", { namespace: "inventory",  })}
        </Button>
      </div>
    );
  }

  // ── Render helpers ──

  const renderActions = (w: WarehouseDto) => (
    <div className="flex gap-2 pt-4 border-t border-border">
      <Button variant="outline" size="sm" className="flex-1 border-border bg-card text-foreground hover:bg-accent" onClick={() => onEdit(w)}>
        <Pencil className="w-3.5 h-3.5 ml-1.5 shrink-0" />{t("labels.edit", { namespace: "inventory",  })}
      </Button>
      {onViewMaterials && (
        <Button variant="outline" size="sm" className="flex-1 border-border bg-card text-foreground hover:bg-accent" onClick={() => onViewMaterials(w)}>
          <Package className="w-3.5 h-3.5 ml-1.5 shrink-0" />{t("warehouses.materials", { namespace: "inventory",  })}
        </Button>
      )}
      <Button variant="outline" size="sm" className={cn("flex-1", w.is_default ? "text-muted-foreground border-border cursor-not-allowed" : "text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30")} onClick={() => handleDelete(w.id, displayName(w))} disabled={w.is_default} title={w.is_default ? t('warehouses.deleteMainDisabled', { namespace: 'inventory',  }) : ''}>
        <Trash2 className="w-3.5 h-3.5 ml-1.5 shrink-0" />{t("labels.delete", { namespace: "inventory",  })}
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
          <span className="text-[10px] text-muted-foreground font-medium px-1 leading-6">+{items.length - 3}</span>
        )}
      </div>
    );
  };

  // ── Rows layout ──
  if (displayStyle === 'rows') {
    return (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/80">
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-black text-muted-foreground border-b border-border">{t("labels.name", { namespace: "inventory",  })}</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-black text-muted-foreground border-b border-border">{t("labels.address", { namespace: "inventory",  })}</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-black text-muted-foreground border-b border-border">{t("labels.status", { namespace: "inventory",  })}</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-black text-muted-foreground border-b border-border">{t("labels.actions", { namespace: "inventory",  })}</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="hover:bg-accent/50 transition-colors border-b border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", w.is_default ? "bg-success" : "bg-primary/10")}>
                      <Warehouse className={cn("w-4 h-4", w.is_default ? "text-success" : "text-primary")} />
                    </div>
                    <div>
                      <span className="font-bold text-foreground text-sm">{displayName(w)}</span>
                      {w.is_default && <span className="ms-2 text-[9px] font-black text-success bg-success/10 px-1.5 py-0.5 rounded">{t("labels.main", { namespace: "inventory",  })}</span>}
                    </div>
                  </div>
                  {renderMatchedItems(w)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{w.address || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold", w.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {w.is_active ? t('labels.active', { namespace: 'inventory',  }) : t('labels.inactive', { namespace: 'inventory',  })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-center">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => onEdit(w)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {onViewMaterials && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-success hover:bg-success/10" onClick={() => onViewMaterials(w)}>
                        <Package className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className={cn("h-8 px-2", w.is_default ? "text-muted-foreground cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} onClick={() => handleDelete(w.id, displayName(w))} disabled={w.is_default}>
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
          <div key={w.id} className="group bg-card p-4 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", w.is_default ? "bg-success" : "bg-primary/10")}>
                  <Warehouse className={cn("w-5 h-5", w.is_default ? "text-success" : "text-primary")} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{displayName(w)}</span>
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", w.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {w.is_active ? t('labels.active', { namespace: 'inventory',  }) : t('labels.inactive', { namespace: 'inventory',  })}
                    </span>
                    {w.is_default && <span className="text-[9px] font-black text-success bg-success/10 px-1.5 py-0.5 rounded">{t("labels.main", { namespace: "inventory",  })}</span>}
                  </div>
                  {w.address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{w.address}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => onEdit(w)}>
                  <Pencil className="w-3.5 h-3.5 ml-1" />{t("labels.edit", { namespace: "inventory",  })}
                </Button>
                {onViewMaterials && (
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-success hover:bg-success/10" onClick={() => onViewMaterials(w)}>
                    <Package className="w-3.5 h-3.5 ml-1" />{t("warehouses.materials", { namespace: "inventory",  })}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className={cn("h-8", w.is_default ? "text-muted-foreground cursor-not-allowed" : "text-destructive hover:bg-destructive/10")} onClick={() => handleDelete(w.id, displayName(w))} disabled={w.is_default}>
                  <Trash2 className="w-3.5 h-3.5 ml-1" />{t("labels.delete", { namespace: "inventory",  })}
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
            "group relative bg-card border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300",
            isSmall ? "p-5 rounded-2xl" : isLarge ? "p-10 rounded-3xl" : "p-8 rounded-3xl"
          )}
        >
          {/* Header */}
          <div className={cn("flex items-start justify-between", isSmall ? "mb-4" : isLarge ? "mb-10" : "mb-8")}>
            <div className={cn(
              "rounded-2xl flex items-center justify-center shadow-inner shrink-0",
              isSmall ? "w-12 h-12" : isLarge ? "w-20 h-20" : "w-16 h-16",
              w.is_default ? "bg-success" : "bg-primary"
            )}>
              <Warehouse className={cn("text-white", isSmall ? "w-6 h-6" : isLarge ? "w-10 h-10" : "w-8 h-8")} />
            </div>
            <span className={cn(
              "rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0",
              isSmall ? "px-2 py-0.5" : isLarge ? "px-4 py-1.5" : "px-3 py-1",
              w.is_active ? "bg-success/10 text-success border-success/10" : "bg-destructive/10 text-destructive border-destructive/10"
            )}>
              {w.is_active ? t('labels.active', { namespace: 'inventory',  }) : t('labels.inactive', { namespace: 'inventory',  })}
            </span>
          </div>

          {/* Name */}
          <h3 className={cn(
            "font-black text-foreground",
            isSmall ? "text-base mb-1" : isLarge ? "text-2xl mb-3" : "text-xl mb-2"
          )}>{displayName(w)}</h3>

          {/* Address */}
          {w.address && (
            <div className={cn("flex items-center gap-1.5", isSmall ? "text-xs mb-3" : isLarge ? "text-base mb-5" : "text-sm mb-4", "text-muted-foreground")}>
              <MapPin className={cn("text-muted-foreground shrink-0", isSmall ? "w-3 h-3" : isLarge ? "w-4 h-4" : "w-3.5 h-3.5")} />
              <span>{w.address}</span>
            </div>
          )}

          {/* Default badge */}
          {w.is_default && (
            <div className={cn(
              "inline-flex items-center rounded-lg text-[10px] font-black bg-success/10 text-success border border-success/10",
              isSmall ? "px-2 py-0.5 mb-3" : isLarge ? "px-3 py-1.5 mb-5" : "px-2.5 py-1 mb-4"
            )}>
              {t("labels.main", { namespace: "inventory",  })}
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
