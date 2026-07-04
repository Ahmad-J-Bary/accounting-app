import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { cn } from '@shared/lib/utils';
import { formatCurrency, formatDate } from '@shared/lib/format';
import { toast } from 'sonner';
import { Package, TrendingUp, RefreshCw, Pencil, Trash2, Barcode, Hash, ArrowDown, ArrowUp, Layers, ArrowRightLeft, Warehouse as WarehouseIcon } from "lucide-react";
import type { MaterialDto, StockMovementDetailDto, InventoryLotDto } from "@erp/shared-types";
import { materialService } from '@modules/inventory/api/materialService';
import { lotService } from '@modules/inventory/api/lotService';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
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
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="p-2 text-slate-600">{lot.purchase_date?.slice(0, 10) || "—"}</td>
      <td className="p-2 text-center tabular-nums">{parseFloat(lot.quantity_original).toLocaleString()}</td>
      <td className={cn("p-2 text-center tabular-nums font-bold",
        parseFloat(lot.quantity_remaining) > 0 ? "text-emerald-600" : "text-red-400"
      )}>{parseFloat(lot.quantity_remaining).toLocaleString()}</td>
      <td className="p-2 text-left tabular-nums font-bold text-amber-600" title="تكلفة الوحدة (قبل التكاليف الإضافية)">
        {formatCurrency(parseFloat(lot.raw_unit_cost_base || lot.unit_cost_base), baseSym || undefined)}
      </td>
      <td className="p-2 text-left tabular-nums font-bold text-slate-600" title="تكلفة الوحدة (بعد التكاليف الإضافية)">
        {formatCurrency(parseFloat(lot.unit_cost_base), baseSym || undefined)}
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-300 rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
          saving && "opacity-50"
        )} value={retail} onChange={e => setRetail(e.target.value)} onBlur={handleBlur} type="number" min="0" step="any" />
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-300 rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
          saving && "opacity-50"
        )} value={semi} onChange={e => setSemi(e.target.value)} onBlur={handleBlur} type="number" min="0" step="any" />
      </td>
      <td className="p-1 text-center">
        <input className={cn("w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-300 rounded px-1 py-0.5 text-center text-[10px] tabular-nums font-bold outline-none transition-colors",
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
  loadingDetails?: boolean;
  onOpenTransfer?: (opts: { sourceWarehouseId?: string }) => void;
  initialTab?: string;
}

export function MaterialDetailPanel({
  material,
  onClose,
  onEdit,
  onDelete,
  loadingDetails = false,
  onOpenTransfer,
  initialTab = "units",
}: MaterialDetailPanelProps) {
  const { baseCurrency, currencies } = useCurrencyContext();
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
      toast.success(`تم تغيير طريقة التكلفة إلى ${newMethod === "FIFO" ? "FIFO" : "المتوسط"}`);
    } catch (e) {
      toast.error("فشل تغيير طريقة التكلفة: " + e);
    }
  }, [material, costingMethod]);

  const displayMovements = useMemo(() => {
    const groups = new Map<string, StockMovementDetailDto>();
    movements.forEach(m => {
      const qty = parseFloat(m.quantity).toFixed(2);
      const cost = parseFloat(m.unit_cost).toFixed(2);
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
            label: "تعديل",
            icon: <Pencil className="w-4 h-4" />,
            variant: "warning" as const,
            onClick: () => onEdit(material),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "حذف",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => {
              if (confirm(`هل أنت متأكد من حذف "${material.name}"؟`)) {
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
              <div className={statLabel}>الكمية المتوفرة</div>
              <div className={statValue + " text-emerald-600"}>
                {parseFloat(material.total_available).toLocaleString()}
              </div>
            </div>
            <div className={statCard}>
              <div className={statLabel}>متوسط التكلفة</div>
              <div className={statValue + " text-blue-600"}>
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
                  label: "الكود",
                  value: (
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      {material.code}
                    </span>
                  ),
                },
                ...(material.name_en
                  ? [{ label: "الاسم (إنجليزي)" as const, value: material.name_en }]
                  : []),
                {
                  label: "الباركود العام",
                  value: (
                    <span className="flex items-center gap-1">
                      <Barcode className="w-3 h-3 text-slate-400" />
                      {material.barcode || "—"}
                    </span>
                  ),
                },
                {
                  label: "طريقة التكلفة",
                  value: (
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80",
                        costingMethod === "FIFO"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )} onClick={toggleCostingMethod}>
                        {costingMethod === "FIFO" ? "FIFO" : "متوسط"}
                      </span>
                      <span className="text-[9px] text-slate-400">(اضغط للتغيير)</span>
                    </div>
                  ),
                },
                {
                  label: "حد الطلب",
                  value: material.minimum_stock || "0",
                },
                {
                  label: "وحدة الشراء الافتراضية",
                  value: defaultPurchaseUnit?.name || "—",
                },
                {
                  label: "وحدة البيع الافتراضية",
                  value: defaultSaleUnit?.name || "—",
                },
              ]}
            />
            {material.notes && (
              <div className="mt-4 pt-3 border-t border-slate-50">
                <SidebarDetailField label="ملاحظات" value={material.notes} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue={initialTab}>
            <TabsList className="grid w-full h-10 p-1 bg-slate-100/80 rounded-lg grid-cols-5">
              <TabsTrigger
                value="units"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <Package className="w-3.5 h-3.5" /> الوحدات
              </TabsTrigger>
              <TabsTrigger
                value="prices"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <TrendingUp className="w-3.5 h-3.5" /> قائمة الأسعار
              </TabsTrigger>
              <TabsTrigger
                value="movement"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <RefreshCw className="w-3.5 h-3.5" /> حركة المادة
              </TabsTrigger>
              <TabsTrigger
                value="warehouses"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <WarehouseIcon className="w-3.5 h-3.5" /> المستودعات
              </TabsTrigger>
              <TabsTrigger
                value="lots"
                className="flex items-center gap-2 text-xs rounded-md"
              >
                <Layers className="w-3.5 h-3.5" /> الدفعات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="units" className="mt-4 focus-visible:outline-none">
              <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 font-bold text-slate-500">الوحدة</th>
                      <th className="p-3 font-bold text-slate-500 text-center">
                        التعادل
                      </th>
                      <th className="p-3 font-bold text-slate-500">الباركود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {material.units?.map((u, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-3 font-bold text-slate-700">
                          {u.name}{" "}
                          {u.is_base && (
                            <span className="text-[9px] text-blue-500 bg-blue-50 px-1 rounded mr-1">
                              أساسية
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center tabular-nums">
                          {u.conversion_factor}
                        </td>
                        <td className="p-3 text-slate-500 font-mono">
                          {u.barcode || "—"}
                        </td>
                      </tr>
                    ))}
                    {(!material.units || material.units.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-6 text-center text-slate-400"
                        >
                          لا توجد وحدات
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
                    className="border rounded-xl overflow-hidden shadow-sm bg-white"
                  >
                    <div className="bg-slate-50 px-4 py-2 border-b font-bold text-xs text-slate-700 flex justify-between">
                      <span>أسعار مبيع: {unit.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal italic">
                        تعادل: {unit.conversion_factor} من الوحدة الأساسية
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-slate-100">
                      {[
                        { id: "retail", label: "مفرق" },
                        { id: "semi_wholesale", label: "نصف جملة" },
                        { id: "wholesale", label: "جملة" },
                      ].map((tier) => {
                        const price = material.sale_prices.find(
                          (p) =>
                            p.unit_id === unit.id && p.tier === tier.id
                        );
                        return (
                          <div
                            key={tier.id}
                            className="bg-white p-3 flex justify-between items-center"
                          >
                            <span className="text-[11px] font-bold text-slate-500">
                              {tier.label}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] font-bold text-emerald-600">
                                {foreignSym}
                                {price?.price || "0"}
                              </span>
                              <span className="text-[10px] text-blue-600">
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
                    جاري التحميل...
                  </div>
                ) : displayMovements.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">لا توجد حركات</span>
                  </div>
                ) : (
                  displayMovements.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 border border-slate-100 rounded-lg bg-white text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          {m.is_inflow ? (
                            <ArrowDown className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ArrowUp className="w-3 h-3 text-red-600" />
                          )}
                          {m.movement_type_label || (m.is_inflow ? 'وارد' : 'منصرف')}
                        </span>
                        <Badge variant="outline" className="text-[9px]">
                          {formatDate(m.movement_date)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>
                          الكمية: <span className="font-bold text-slate-700">{parseFloat(m.quantity).toLocaleString()}</span>
                        </span>
                        <span>
                          {formatCurrency(parseFloat(m.is_inflow ? m.unit_cost : m.total_cost), baseSym || undefined)}
                        </span>
                      </div>
                      {m.notes && (
                        <div className="text-slate-400 text-[9px] line-clamp-1">{m.notes}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="warehouses" className="mt-4 focus-visible:outline-none">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {movementsLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">جاري التحميل...</div>
                ) : warehouseStock.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                    <WarehouseIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">لا توجد كميات في المستودعات</span>
                  </div>
                ) : (
                  warehouseStock.map((ws) => (
                    <div key={ws.warehouseId} className="border border-slate-100 rounded-lg bg-white text-xs">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <WarehouseIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-700">{ws.warehouseName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("font-bold tabular-nums", ws.quantity > 0 ? "text-emerald-600" : "text-red-600")}>
                            {ws.quantity.toLocaleString()}
                          </span>
                          {onOpenTransfer && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] border-slate-200"
                              onClick={() => onOpenTransfer({ sourceWarehouseId: ws.warehouseId })}>
                              <ArrowRightLeft className="w-3 h-3 ml-1" /> تحويل
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
                    جاري التحميل...
                  </div>
                ) : lots.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <span className="text-xs">لا توجد دفعات</span>
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-[11px] text-right">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="p-2 font-bold text-slate-500">تاريخ الشراء</th>
                          <th className="p-2 font-bold text-slate-500 text-center">الأصلية</th>
                          <th className="p-2 font-bold text-slate-500 text-center">المتبقي</th>
                          <th className="p-2 font-bold text-slate-500 text-left">تكلفة الشراء</th>
                          <th className="p-2 font-bold text-slate-500 text-left">صافي التكلفة</th>
                          <th className="p-2 font-bold text-slate-500 text-center">مفرق</th>
                          <th className="p-2 font-bold text-slate-500 text-center">نصف جملة</th>
                          <th className="p-2 font-bold text-slate-500 text-center">جملة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {lots.map((lot) => (
                          <LotRow key={lot.id} lot={lot} baseSym={baseSym || ""} onUpdate={async (lotId, retail, semi, wholesale) => {
                            try {
                              await lotService.updateLotSalePrices(lotId, retail, semi, wholesale);
                              setLots(prev => prev.map(l => l.id === lotId ? { ...l, retail_price_base: retail, semi_wholesale_price_base: semi, wholesale_price_base: wholesale } : l));
                            } catch (e) {
                              toast.error("فشل تحديث سعر البيع: " + e);
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