import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, Package } from "lucide-react";
import { Button } from "@shared/ui/button";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useReportBaseData } from "@modules/reports/hooks/useReportBaseData";
import { useMaterialExpenseLedgers } from "@shared/hooks/useMaterialExpenseLedgers";
import {
  computeInventoryProjection,
  inventoryAdjustmentNets,
} from "@modules/reports/lib/inventory";
import { ReportLoadingSkeleton } from "@widgets/reports";
import { formatNumber } from "@shared/lib/format";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { StockMovementDetailDto } from "@erp/shared-types";

/**
 * جرد وقيمة المخزون — per-material valuation from the SAME shared projection
 * the Dashboard "المخزون" tile and the Income Statement "بضاعة آخر المدة"
 * consume (`reports/lib/inventory`). Every material is valued from its own
 * stock-movement ledger (opening + period in/out, exclusive of Adjustment /
 * Damaged rows) and the total is the per-material sum plus the GL settlement
 * nets (331 − 45), so this report can never disagree with the dashboard total.
 */
export default function InventoryValuationReport() {
  const { data: baseData, isLoading, refetch } = useReportBaseData();
  const { loadMaterialExpenseLedgers } = useMaterialExpenseLedgers();
  const { formatAmount, baseCurrency } = useCurrencyContext();

  const [ledgers, setLedgers] = useState<Map<string, StockMovementDetailDto[]>>(new Map());
  const [loadingLedgers, setLoadingLedgers] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    setLoadingLedgers(true);
    loadMaterialExpenseLedgers(baseData.materials).then((map) => {
      if (active) setLedgers(map);
    }).catch(() => {
      /* per-material feed is optional detail; the table still renders qty/cost */
    }).finally(() => {
      if (active) setLoadingLedgers(false);
    });
    return () => {
      active = false;
    };
  }, [baseData, isLoading, loadMaterialExpenseLedgers]);

  const rows = useMemo(() => {
    const now = Date.now();
    const adjustments = inventoryAdjustmentNets(baseData.entries);
    const items = baseData.materials
      .map((m) => {
        const movements = ledgers.get(m.id) ?? [];
        const { closingInventory } = computeInventoryProjection(movements, {
          fromTs: 0,
          toTs: now,
        });
        return { material: m, value: closingInventory };
      })
      .sort((a, b) => b.value - a.value);
    const subtotal = items.reduce((sum, r) => sum + r.value, 0);
    return {
      items,
      subtotal,
      total: subtotal + adjustments.gains - adjustments.losses,
      netAdjustments: adjustments.gains - adjustments.losses,
    };
  }, [baseData.entries, baseData.materials, ledgers]);

  const busy = isLoading || loadingLedgers;

  return (
    <OperationalTableTemplate
      title="جرد وقيمة المخزون"
      toolbar={
        <div className="flex items-center gap-2">
          {busy ? (
            <span className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs text-slate-500 border border-slate-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              جارٍ التحديث…
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white text-xs text-slate-600"
              onClick={() => void refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث
            </Button>
          )}
          <span className="text-xs text-slate-400">
            التقييم لحظة العرض (حتى الآن) — القيمة النهائية بعد تسويات 331/45
          </span>
        </div>
      }
      tableContent={
        busy ? (
          <ReportLoadingSkeleton />
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                  <th className="text-end pb-4">الكود</th>
                  <th className="text-end pb-4">الصنف</th>
                  <th className="text-start pb-4">الكمية المتاحة</th>
                  <th className="text-start pb-4">متوسط التكلفة المحلية</th>
                  <th className="text-start pb-4">القيمة التقديرية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-300 font-bold text-sm">
                      <Package className="mx-auto mb-2 h-8 w-8" />
                      لا توجد أصناف مسجلة بعد
                    </td>
                  </tr>
                )}
                {rows.items.map(({ material, value }) => (
                  <tr key={material.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-mono text-xs font-black text-blue-600" dir="ltr">
                      {material.code}
                    </td>
                    <td className="py-3 font-bold text-slate-700">{material.name}</td>
                    <td className="py-3 text-start tabular-nums font-bold text-slate-700">
                      {formatNumber(toQty(material.total_available))}
                    </td>
                    <td className="py-3 text-start tabular-nums text-slate-500">
                      {material.average_cost_base
                        ? formatAmount(toQty(material.average_cost_base), {
                            currencyCode: baseCurrency?.code,
                          })
                        : "—"}
                    </td>
                    <td className="py-3 text-start tabular-nums font-black text-slate-900">
                      {formatAmount(value, { currencyCode: baseCurrency?.code })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={2} className="py-4 font-black text-slate-700">
                    الإجمالي قبل التسويات
                  </td>
                  <td className="py-4" />
                  <td className="py-4" />
                  <td className="py-4 text-start tabular-nums font-black text-slate-900">
                    {formatAmount(rows.subtotal, { currencyCode: baseCurrency?.code })}
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td colSpan={2} className="py-4 font-bold text-slate-500">
                    تسويات قيد جرد المخزون (331 − 45)
                  </td>
                  <td className="py-4" />
                  <td className="py-4" />
                  <td className="py-4 text-start tabular-nums font-bold text-emerald-700">
                    {formatAmount(rows.netAdjustments, { currencyCode: baseCurrency?.code })}
                  </td>
                </tr>
                <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                  <td colSpan={2} className="py-4 text-base font-black text-slate-800">
                    إجمالي قيمة المخزون
                  </td>
                  <td className="py-4" />
                  <td className="py-4" />
                  <td className="py-4 text-start text-base tabular-nums font-black text-blue-700">
                    {formatAmount(rows.total, { currencyCode: baseCurrency?.code })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    />
  );
}

function toQty(value?: string | null): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}