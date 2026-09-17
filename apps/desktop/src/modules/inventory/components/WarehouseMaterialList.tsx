import { useMemo, useState } from "react";
import { Warehouse as WarehouseIcon, Package, ArrowRightLeft, Search, Hash } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { formatNumber } from "@shared/lib/format";
import type { WarehouseDto, MaterialDto } from "@erp/shared-types";
import { SidebarShell, SidebarHeader, SidebarBody } from "@widgets/sidebar-shell";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { decomposeUnits, formatDecomposition } from "@modules/inventory/lib/stockUtils";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { resolveWarehouseDisplayName } from "@shared/lib/system-labels";

interface WarehouseMaterialListProps {
  open: boolean;
  onClose: () => void;
  warehouse: WarehouseDto;
  warehouses: WarehouseDto[];
  products: MaterialDto[];
  stockByWarehouse: Map<string, Map<string, number>>;
  onOpenTransfer?: (materialId: string, sourceWarehouseId: string) => void;
}

export function WarehouseMaterialList({
  open,
  onClose,
  warehouse,
  products,
  stockByWarehouse,
  onOpenTransfer,
}: WarehouseMaterialListProps) {
  const { t } = useLocalization();
  const [search, setSearch] = useState("");

  const materialsInWarehouse = useMemo(() => {
    const result: { material: MaterialDto; quantity: number; qtyText: string }[] = [];
    for (const material of products) {
      const whMap = stockByWarehouse.get(material.id);
      if (!whMap) continue;
      const qty = whMap.get(warehouse.id) || 0;
      if (qty > 0) {
        const units = material.units ?? [];
        let qtyText = formatNumber(qty);
        if (units.length > 1) {
          try {
            const parts = decomposeUnits(qty, units);
            const txt = formatDecomposition(parts);
            if (txt) qtyText = txt;
          } catch { /* ignore */ }
        }
        result.push({ material, quantity: qty, qtyText });
      }
    }
    return result.sort((a, b) => b.quantity - a.quantity);
  }, [products, stockByWarehouse, warehouse.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return materialsInWarehouse;
    const q = search.toLowerCase();
    return materialsInWarehouse.filter(({ material }) =>
      material.name.toLowerCase().includes(q) ||
      (material.code?.toLowerCase().includes(q)) ||
      (material.barcode?.toLowerCase().includes(q))
    );
  }, [materialsInWarehouse, search]);

  const totalQty = useMemo(
    () => materialsInWarehouse.reduce((sum, m) => sum + m.quantity, 0),
    [materialsInWarehouse]
  );

  return (
    <SidebarShell isOpen={open} onClose={onClose}>
      <SidebarHeader
        title={resolveWarehouseDisplayName(warehouse, t)}
        subtitle={t("warehouses.materialList.subtitle", { namespace: "inventory",  })}
        icon={<WarehouseIcon className="w-4 h-4 text-primary" />}
        onClose={onClose}
      />
      <SidebarBody>
        {/* Stats Strip */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-muted bg-muted p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{t("warehouses.materialList.itemCount", { namespace: "inventory",  })}</span>
            <span className="text-xl font-black text-primary tabular-nums">{formatNumber(materialsInWarehouse.length)}</span>
          </div>
          <div className="rounded-xl border border-muted bg-muted p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{t("warehouses.materialList.totalQty", { namespace: "inventory",  })}</span>
            <span className="text-xl font-black text-success tabular-nums">{formatNumber(totalQty)}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("warehouses.materialList.searchPlaceholder", { namespace: "inventory",  })}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 bg-white pe-9 text-xs border-muted"
          />
        </div>

        {/* Materials List */}
        {materialsInWarehouse.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-bold text-muted-foreground text-sm">{t("warehouses.materialList.emptyTitle", { namespace: "inventory",  })}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{t("warehouses.materialList.emptyHint", { namespace: "inventory",  })}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm text-muted-foreground">{t("labels.noResults", { namespace: "inventory",  })}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(({ material, quantity, qtyText }) => (
              <div
                key={material.id}
                className="group rounded-xl border border-muted bg-white hover:bg-primary/10 hover:border-primary/20 transition-all duration-150 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Package className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-xs leading-tight truncate">{material.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {material.code && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                            <Hash className="w-2.5 h-2.5" />{material.code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left">
                      <p className={cn(
                        "text-sm font-black tabular-nums leading-tight",
                        quantity > 0 ? "text-success" : "text-destructive"
                      )}>
                        {formatNumber(quantity)}
                      </p>
                      {qtyText !== formatNumber(quantity) && (
                        <p className="text-[9px] text-muted-foreground font-medium leading-tight">{qtyText}</p>
                      )}
                    </div>
                    {onOpenTransfer && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] border-amber-200 text-amber-700 hover:bg-amber-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onOpenTransfer(material.id, warehouse.id)}
                      >
                        <ArrowRightLeft className="w-3 h-3 ml-1" /> {t("warehouses.materialList.transfer", { namespace: "inventory",  })}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SidebarBody>
    </SidebarShell>
  );
}
