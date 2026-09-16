import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { cn } from '@shared/lib/utils';
import { formatCurrency, formatDate, toLocalString, toFixed } from '@shared/lib/format';
import { toast } from 'sonner';
import { Package, TrendingUp, RefreshCw, Pencil, Trash2, Barcode, Hash, ArrowDown, ArrowUp, Layers, ArrowRightLeft, Warehouse as WarehouseIcon } from "lucide-react";
import type { MaterialDto, StockMovementDetailDto, InventoryLotDto } from "@erp/shared-types";
import { materialService } from '@modules/inventory/api/materialService';
import { lotService } from '@modules/inventory/api/lotService';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { buildStockByWarehouse } from '@modules/inventory/lib/stockUtils';
import {
  SidebarShell,
  SidebarHeader,
  SidebarActionBar,
  SidebarBody,
  SidebarDetailField,
  SidebarDetailGrid,
  type SidebarAction,
} from "@widgets/sidebar-shell";
import { statCard, statLabel, statValue, sectionCard } from './inventoryStyles';

function LotRow({ lot, baseSym, onUpdate }: {
  lot: InventoryLotDto;
  baseSym: string;
  onUpdate: (id: string, retail?: string | null, semi?: string | null, wholesale?: string | null) => void;
}) {
  const { t } = useLocalization();
  const [retail, setRetail] = useState(lot.retail_price_base || "");
  const [semi, setSemi] = useState(lot.semi_wholesale_price_base || "");
  const [wholesale, setWholesale] = useState(lot.wholesale_price_base || "");
  const [saving, setSaving] = useState(false);

  const handleBlur = async () => {
    const r = retail || null;
    const s = semi || null;
    const w = wholesale || null;
    if (r === (lot.retail_price_base || null) && s === (lot.semi_wholesale_price_base || null) && w === (lot.wholesale_price_base || null)) return;
    setSaving(true);
    await onUpdate(lot.id, r, s, w);
    setSaving(false);
  };

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="p-2 text-muted-foreground">{lot.purchase_date?.slice(0, 10) || "—"}</td>
      <td className="p-2 text-center tabular-nums">{toLocalString(parseFloat(lot.quantity_original))}</td>
      <td className={cn("p-2 text-center tabular-nums font-bold",
        parseFloat(lot.quantity_remaining) > 0 ? "text-success" : "text-red-400"
      )}>{toLocalString(parseFloat(lot.quantity_remaining))}</td>
      <td className="p-2 text-left tabular-nums font-bold text-amber-600" title={t("materials.detail.rawCostTitle", { namespace: "inventory" })}>
        {formatCurrency(parseFloat(lot.raw_unit_cost_base || lot.unit_cost_base), baseSym || undefined)}
      </td>
      <td className="p-2 text-left tabular-nums font-bold text-muted-foreground" title={t("materials.detail.netCostTitle", { namespace: "inventory" })}>
        {formatCurrency(parseFloat(lot.unit_cost_base), baseSym || undefined)}
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
          saving && "opacity-50"
        )} value={retail} onChange={e => setRetail(e.target.value)} onBlur={handleBlur} type="number" min="0" step="any" />
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
          saving && "opacity-50"
        )} value={semi} onChange={e => setSemi(e.target.value)} onBlur={handleBlur} type="number" min="0" step="any" />
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
          saving && "opacity-50"
        )} value={wholesale} onChange={e => setWholesale(e.target.value)} onBlur={handleBlur} type="number" min="0" step="any" />
      </td>
    </tr>
  );
}

interface MaterialDetailPanelProps {
  material: MaterialDto | null;
  onClose: () => void;
  onEdit?: (m: MaterialDto) => void;
  onDelete?: (id: string, name: string) => void;
  onOpenTransfer?: (opts: { sourceWarehouseId?: string }) => void;
  initialTab?: string;
}

export function MaterialDetailPanel({
  material,
  onClose,
  onEdit,
  onDelete,
  onOpenTransfer,
  initialTab = "units",
}: MaterialDetailPanelProps) {
  const { baseCurrency, currencies } = useCurrencyContext();
  const { t } = useLocalization();
  const foreignCurrency = currencies.find(c => c.code !== baseCurrency?.code);
  const foreignSym = foreignCurrency?.symbol || foreignCurrency?.code || "";
  const baseSym = baseCurrency?.symbol || baseCurrency?.code || "";
  const [movements, setMovements] = useState<StockMovementDetailDto[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [lots, setLots] = useState<InventoryLotDto[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [costingMethod, setCostingMethod] = useState(material?.costing_method || "Average");

  useEffect(() => {
    setCostingMethod(material?.costing_method || "Average");
  }, [material]);

  useEffect(() => {
    if (!material) return;
    setMovementsLoading(true);
    materialService.listMovementsByMaterial(material.id)
      .then(setMovements)
      .catch(() => {})
      .finally(() => setMovementsLoading(false));
  }, [material]);

  useEffect(() => {
    if (!material) return;
    setLotsLoading(true);
    lotService.getMaterialLots(material.id)
      .then(setLots)
      .catch(() => {})
      .finally(() => setLotsLoading(false));
  }, [material, costingMethod]);

  const toggleCostingMethod = useCallback(async () => {
    if (!material) return;
    const newMethod = costingMethod === "Average" ? "FIFO" : "Average";
    try {
      await lotService.updateCostingMethod(material.id, newMethod);
      material.costing_method = newMethod;
      setCostingMethod(newMethod);
      toast.success(t("materials.detail.costingMethodChanged", { namespace: "inventory", vars: { method: newMethod === "FIFO" ? "FIFO" : t("materials.costingMethods.average", { namespace: "inventory" }) } }));
    } catch (e) {
      toast.error(t("materials.detail.costingMethodFailed", { namespace: "inventory" }) + e);
    }
  }, [material, costingMethod, t]);

  const displayMovements = useMemo(() => {
    const groups = new Map<string, StockMovementDetailDto>();
    movements.forEach(m => {
      const qty = toFixed(parseFloat(m.quantity), 2);
      const cost = toFixed(parseFloat(m.unit_cost), 2);
      const date = m.movement_date?.slice(0, 10) ?? "";
      const key = `${m.movement_type}|${qty}|${cost}|${date}`;
      if (groups.has(key)) {
        const g = groups.get(key)!;
        if (m.party_name && !g.party_name) g.party_name = m.party_name;
        if (m.notes && !g.notes) g.notes = m.notes;
      } else {
        groups.set(key, { ...m });
      }
    });
    return Array.from(groups.values());
  }, [movements]);

  const warehouseStock = useMemo(() => {
    const byWh = buildStockByWarehouse(movements).get(material?.id || "");
    if (!byWh) return [];
    const nameMap = new Map<string, string>();
    for (const m of movements) {
      if (m.warehouse_id && m.warehouse_name) {
        nameMap.set(m.warehouse_id, m.warehouse_name);
      }
    }
    return Array.from(byWh.entries())
      .map(([wid, qty]) => ({
        warehouseId: wid,
        warehouseName: nameMap.get(wid) || wid,
        quantity: qty,
      }))
      .filter(s => s.quantity !== 0)
      .sort((a, b) => b.quantity - a.quantity);
  }, [movements, material]);


  if (!material) return null;

  const actions: SidebarAction[] = [
    ...(onEdit
      ? [
          {
            label: t("labels.edit", { namespace: "inventory" }),
            icon: <Pencil className="w-4 h-4" />,
            variant: "warning" as const,
            onClick: () => onEdit(material),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: t("labels.delete", { namespace: "inventory" }),
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => {
              if (confirm(t("materials.detail.deleteConfirm", { namespace: "inventory", vars: { name: material.name } }))) {
                onDelete(material.id, material.name);
              }
            },
          },
        ]
      : []),
  ];

  const defaultPurchaseUnit = material.units?.find(
    (u) => u.id === material.default_purchase_unit_id
  );
  const defaultSaleUnit = material.units?.find(
    (u) => u.id === material.default_sale_unit_id
  );

  return (
    <SidebarShell isOpen={true} onClose={onClose}>
      <SidebarHeader title={material.name} onClose={onClose} />
      <SidebarActionBar actions={actions} />
      <SidebarBody>
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={statCard}>
              <div className={statLabel}>{t("materials.detail.availableQty", { namespace: "inventory" })}</div>
              <div className={statValue + " text-success"}>
                {toLocalString(parseFloat(material.total_available))}
              </div>
            </div>
            <div className={statCard}>
              <div className={statLabel}>{t("materials.detail.averageCost", { namespace: "inventory" })}</div>
              <div className={statValue + " text-primary"}>
                {formatCurrency(
                  parseFloat(material.average_cost),
                  baseSym || undefined
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className={sectionCard}>
            <SidebarDetailGrid
              fields={[
                {
                  label: t("labels.code", { namespace: "inventory" }),
                  value: (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-muted-foreground" />
                      {material.code}
                    </span>
                  ),
                },
                ...(material.name_en
                  ? [{ label: t("materials.detail.nameEn", { namespace: "inventory" }), value: material.name_en }]
                  : []),
                {
                  label: t("materials.form.generalBarcode", { namespace: "inventory" }),
                  value: (
                    <span className="flex items-center gap-1">
                      <Barcode className="w-3 h-3 text-muted-foreground" />
                      {material.barcode || "—"}
                    </span>
                  ),
                },
                {
                  label: t("materials.detail.costingMethod", { namespace: "inventory" }),
                  value: (
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80",
                        costingMethod === "FIFO"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-muted text-muted-foreground border-border"
                      )} onClick={toggleCostingMethod}>
                        {costingMethod === "FIFO" ? "FIFO" : t("materials.detail.average", { namespace: "inventory" })}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{t("materials.detail.clickToChange", { namespace: "inventory" })}</span>
                    </div>
                  ),
                },
                {
                  label: t("materials.columns.minimumStock", { namespace: "inventory" }),
                  value: material.minimum_stock || "0",
                },
                {
                  label: t("materials.form.defaultPurchaseUnit", { namespace: "inventory" }),
                  value: defaultPurchaseUnit?.name || "—",
                },
                {
                  label: t("materials.form.defaultSaleUnit", { namespace: "inventory" }),
                  value: defaultSaleUnit?.name || "—",
                },
              ]}
            />
            {material.notes && (
              <div className="mt-4 pt-3 border-t border-border">
                <SidebarDetailField label={t("labels.notes", { namespace: "inventory" })} value={material.notes} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue={initialTab}>
            <TabsList className="grid w-full h-10 p-1 bg-muted/80 rounded-lg grid-cols-5">
              <TabsTrigger
                value="units"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <Package className="w-3.5 h-3.5" /> {t("materials.detail.tabUnits", { namespace: "inventory" })}
              </TabsTrigger>
              <TabsTrigger
                value="prices"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <TrendingUp className="w-3.5 h-3.5" /> {t("materials.detail.tabPrices", { namespace: "inventory" })}
              </TabsTrigger>
              <TabsTrigger
                value="movement"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t("materials.detail.tabMovement", { namespace: "inventory" })}
              </TabsTrigger>
              <TabsTrigger
                value="warehouses"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <WarehouseIcon className="w-3.5 h-3.5" /> {t("materials.detail.tabWarehouses", { namespace: "inventory" })}
              </TabsTrigger>
              <TabsTrigger
                value="lots"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <Layers className="w-3.5 h-3.5" /> {t("materials.detail.tabLots", { namespace: "inventory" })}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="units" className="mt-4 focus-visible:outline-none">
              <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="p-3 font-bold text-muted-foreground">{t("labels.unit", { namespace: "inventory" })}</th>
                      <th className="p-3 font-bold text-muted-foreground text-center">
                        {t("materials.detail.conversion", { namespace: "inventory" })}
                      </th>
                      <th className="p-3 font-bold text-muted-foreground">{t("labels.barcode", { namespace: "inventory" })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {material.units?.map((u, i) => (
                      <tr
                        key={i}
                        className="hover:bg-accent/50 transition-colors"
                      >
                        <td className="p-3 font-bold text-foreground">
                          {u.name}{" "}
                          {u.is_base && (
                            <span className="text-[9px] text-primary bg-primary/10 px-1 rounded mr-1">
                              {t("materials.detail.base", { namespace: "inventory" })}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {u.conversion_factor}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {u.barcode || "—"}
                        </td>
                      </tr>
                    ))}
                    {(!material.units || material.units.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-6 text-center text-muted-foreground"
                        >
                          {t("materials.detail.noUnits", { namespace: "inventory" })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="prices" className="mt-4 focus-visible:outline-none">
              <div className="space-y-4">
                {material.units.map((unit, uIdx) => (
                  <div
                    key={uIdx}
                    className="border rounded-xl overflow-hidden shadow-sm bg-card"
                  >
                    <div className="bg-muted px-4 py-2 border-b font-bold text-xs text-foreground flex justify-between">
                      <span>أسعار مبيع: {unit.name}</span>
                      <span className="text-[10px] text-muted-foreground font-normal italic">
                        {t("grid.equivOfBase", { namespace: "inventory", vars: { count: unit.conversion_factor } })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-muted">
                      {[
                        { id: "retail", label: t("saleTiers.retail", { namespace: "inventory" }) },
                        { id: "semi_wholesale", label: t("saleTiers.semi_wholesale", { namespace: "inventory" }) },
                        { id: "wholesale", label: t("saleTiers.wholesale", { namespace: "inventory" }) },
                      ].map((tier) => {
                        const price = material.sale_prices.find(
                          (p) =>
                            p.unit_id === unit.id && p.tier === tier.id
                        );
                        return (
                          <div
                            key={tier.id}
                            className="bg-card p-3 flex justify-between items-center"
                          >
                            <span className="text-[11px] font-bold text-muted-foreground">
                              {tier.label}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] font-bold text-success">
                                {foreignSym}
                                {price?.price || "0"}
                              </span>
                              <span className="text-[10px] text-primary">
                                {formatCurrency(
                                  parseFloat(price?.price_base || "0"),
                                  baseSym || undefined
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent
              value="movement"
              className="mt-4 focus-visible:outline-none"
            >
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {movementsLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    {t("labels.loading", { namespace: "inventory" })}
                  </div>
                ) : displayMovements.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/50">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">{t("materials.detail.noMovements", { namespace: "inventory" })}</span>
                  </div>
                ) : (
                  displayMovements.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 border border-border rounded-lg bg-card text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          {m.is_inflow ? (
                            <ArrowDown className="w-3 h-3 text-success" />
                          ) : (
                            <ArrowUp className="w-3 h-3 text-destructive" />
                          )}
                          {m.movement_type_label || (m.is_inflow ? 'وارد' : 'منصرف')}
                        </span>
                        <Badge variant="outline" className="text-[9px]">
                          {formatDate(m.movement_date)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>
                          {t("labels.quantity", { namespace: "inventory" })}: <span className="font-bold text-foreground">{toLocalString(parseFloat(m.quantity))}</span>
                        </span>
                        <span>
                          {formatCurrency(parseFloat(m.is_inflow ? m.unit_cost : m.total_cost), baseSym || undefined)}
                        </span>
                      </div>
                      {m.notes && (
                        <div className="text-muted-foreground text-[9px] line-clamp-1">{m.notes}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="warehouses" className="mt-4 focus-visible:outline-none">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {movementsLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">{t("labels.loading", { namespace: "inventory" })}</div>
                ) : warehouseStock.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/50">
                    <WarehouseIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">{t("materials.detail.noWarehouseStock", { namespace: "inventory" })}</span>
                  </div>
                ) : (
                  warehouseStock.map((ws) => (
                    <div key={ws.warehouseId} className="border border-border rounded-lg bg-card text-xs">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <WarehouseIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-bold text-foreground">{ws.warehouseName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("font-bold tabular-nums", ws.quantity > 0 ? "text-success" : "text-destructive")}>
                            {toLocalString(ws.quantity)}
                          </span>
                          {onOpenTransfer && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] border-border"
                              onClick={() => onOpenTransfer({ sourceWarehouseId: ws.warehouseId })}>
                              <ArrowRightLeft className="w-3 h-3 ml-1" /> {t("materials.detail.transfer", { namespace: "inventory" })}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="lots" className="mt-4 focus-visible:outline-none">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {lotsLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    {t("labels.loading", { namespace: "inventory" })}
                  </div>
                ) : lots.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/50">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">{t("materials.detail.noLots", { namespace: "inventory" })}</span>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                    <table className="w-full text-[11px] text-right">
                      <thead className="bg-muted border-b">
                        <tr>
                          <th className="p-2 font-bold text-muted-foreground">{t("materials.detail.purchaseDate", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-center">{t("materials.detail.original", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-center">{t("materials.detail.remaining", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-left">{t("materials.detail.purchaseCost", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-left">{t("materials.detail.netCost", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-center">{t("saleTiers.retail", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-center">{t("saleTiers.semi_wholesale", { namespace: "inventory" })}</th>
                          <th className="p-2 font-bold text-muted-foreground text-center">{t("saleTiers.wholesale", { namespace: "inventory" })}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lots.map((lot) => (
                          <LotRow key={lot.id} lot={lot} baseSym={baseSym || ""} onUpdate={async (lotId, retail, semi, wholesale) => {
                            try {
                              await lotService.updateLotSalePrices(lotId, retail, semi, wholesale);
                              setLots(prev => prev.map(l => l.id === lotId ? { ...l, retail_price_base: retail, semi_wholesale_price_base: semi, wholesale_price_base: wholesale } : l));
                            } catch (e) {
                              toast.error(t("materials.detail.salePriceUpdateFailed", { namespace: "inventory" }) + e);
                            }
                          }} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarBody>
    </SidebarShell>
  );
}