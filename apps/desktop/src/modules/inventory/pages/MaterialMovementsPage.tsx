import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { ArrowDown, ArrowUp, ShoppingCart, TrendingUp, Package, Hash } from "lucide-react";
import { materialService } from '@modules/inventory/api/materialService';
import type { MaterialDto, StockMovementDetailDto } from "@erp/shared-types";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { formatCurrency, formatDate } from '@shared/lib/format';
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { Badge } from "@shared/ui/badge";

export default function MaterialMovementsPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const location = useLocation();
  const isPurchase = location.pathname.includes("/purchases/");
  const { baseCurrency } = useCurrencyContext();
  const [material, setMaterial] = useState<MaterialDto | null>(null);
  const [movements, setMovements] = useState<StockMovementDetailDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!materialId) return;
    setLoading(true);
    Promise.all([
      materialService.getMaterial(materialId),
      materialService.listMovementsByMaterial(materialId),
    ])
      .then(([mat, movs]) => {
        setMaterial(mat);
        setMovements(movs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [materialId]);

  const displayMovements = useMemo(() => {
    const groups = new Map<string, StockMovementDetailDto>();
    movements.forEach(m => {
      if (isPurchase ? !m.is_inflow : m.is_inflow) return;
      if (!isPurchase && m.movement_type === "Damaged") return;
      const qty = parseFloat(m.quantity).toFixed(4);
      const cost = parseFloat(m.unit_cost).toFixed(4);
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
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());
  }, [movements, isPurchase]);

  const stats = useMemo(() => {
    const totalQty = displayMovements.reduce((s, m) => s + parseFloat(m.quantity), 0);
    const totalCost = displayMovements.reduce((s, m) => s + parseFloat(m.is_inflow ? m.unit_cost : m.total_cost), 0);
    return [
      { label: "عدد الحركات", value: displayMovements.length, icon: Package, color: "text-slate-900" },
      { label: "الكمية الإجمالية", value: totalQty.toLocaleString(), icon: Hash, color: "text-blue-600" },
      { label: "الإجمالي", value: formatCurrency(totalCost, baseCurrency?.symbol || ""), icon: isPurchase ? ShoppingCart : TrendingUp, color: "text-emerald-600" },
    ];
  }, [displayMovements, baseCurrency, isPurchase]);

  const title = material
    ? `${isPurchase ? "مشتريات" : "مبيعات"} المادة: ${material.name}`
    : "جاري التحميل...";

  return (
    <OperationalTableTemplate
      title={title}
      stats={stats}
      tableContent={
        loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            جاري التحميل...
          </div>
        ) : displayMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="w-12 h-12 mb-4 opacity-30" />
            <p>لا توجد {isPurchase ? "مشتريات" : "مبيعات"} لهذه المادة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayMovements.map((m, idx) => (
              <div
                key={idx}
                className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    {m.is_inflow ? (
                      <ArrowDown className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-red-600" />
                    )}
                    {m.movement_type_label || (m.is_inflow ? "مشتريات" : "مبيعات")}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {formatDate(m.movement_date)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">الكمية</span>
                    <p className="font-bold">{parseFloat(m.quantity).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">التكلفة</span>
                    <p className="font-bold">{formatCurrency(parseFloat(m.unit_cost), baseCurrency?.symbol || "")}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">الإجمالي</span>
                    <p className="font-bold">{formatCurrency(parseFloat(m.total_cost), baseCurrency?.symbol || "")}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">الطرف</span>
                    <p className="font-medium">{m.party_name || "—"}</p>
                  </div>
                </div>
                {m.notes && (
                  <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-2">
                    {m.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    />
  );
}
