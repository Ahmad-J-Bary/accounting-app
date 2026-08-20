import { useMemo } from "react";
import { RefreshCw, Loader2, PackageCheck, AlertTriangle } from "lucide-react";
import { Button } from "@shared/ui/button";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useMaterials } from "@shared/hooks/queries/useMaterialQueries";
import { useCategories } from "@shared/hooks/queries/useCategoryQueries";
import { ReportLoadingSkeleton } from "@widgets/reports";
import { formatNumber } from "@shared/lib/format";

/**
 * نواقص المخزون — the kind of "أصناف بحاجة للطلب" alert the Dashboard shows,
 * as a dedicated report table with shortage quantities, bar-code and category.
 */
export default function InventoryLowStockReport() {
  const { data: materials = [], isLoading, isRefetching, refetch } = useMaterials();
  const { data: categories = [] } = useCategories();

  const catNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const rows = useMemo(() => {
    return materials
      .filter((m) => toQty(m.total_available) < toQty(m.minimum_stock))
      .map((m) => ({
        material: m,
        available: toQty(m.total_available),
        minimum: toQty(m.minimum_stock),
        shortage: toQty(m.minimum_stock) - toQty(m.total_available),
        category: m.category_ids?.[0]
          ? catNameById.get(m.category_ids[0]) ?? "—"
          : "بدون تصنيف",
      }))
      .sort((a, b) => b.shortage - a.shortage);
  }, [materials, catNameById]);

  return (
    <OperationalTableTemplate
      title="نواقص المخزون"
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-black text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {rows.length} صنف
        </span>
      }
      toolbar={
        <div className="flex items-center gap-2">
          {isRefetching ? (
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
        </div>
      }
      tableContent={
        isLoading ? (
          <ReportLoadingSkeleton />
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 font-black text-[10px] uppercase tracking-widest border-b border-slate-100">
                  <th className="text-right pb-4">الكود</th>
                  <th className="text-right pb-4">الصنف</th>
                  <th className="text-right pb-4">الفئة</th>
                  <th className="text-left pb-4">الباركود</th>
                  <th className="text-left pb-4">الكمية المتاحة</th>
                  <th className="text-left pb-4">الحد الأدنى</th>
                  <th className="text-left pb-4">النقص</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-300 font-bold text-sm">
                      <PackageCheck className="mx-auto mb-2 h-8 w-8" />
                      جميع الأصناف ضمن الحد الآمن
                    </td>
                  </tr>
                )}
                {rows.map(({ material, available, minimum, shortage, category }) => (
                  <tr key={material.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-mono text-xs font-black text-blue-600" dir="ltr">
                      {material.code}
                    </td>
                    <td className="py-3 font-bold text-slate-700">{material.name}</td>
                    <td className="py-3 text-sm text-slate-500">{category}</td>
                    <td className="py-3 text-left font-mono text-xs text-slate-400" dir="ltr">
                      {material.barcode || "—"}
                    </td>
                    <td className="py-3 text-left tabular-nums font-bold text-rose-600">
                      {formatNumber(available)}
                    </td>
                    <td className="py-3 text-left tabular-nums text-slate-500">
                      {formatNumber(minimum)}
                    </td>
                    <td className="py-3 text-left">
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-black tabular-nums text-rose-600">
                        {formatNumber(shortage)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
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