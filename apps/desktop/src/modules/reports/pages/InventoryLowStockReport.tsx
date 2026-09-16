import { useMemo } from "react";
import { RefreshCw, Loader2, PackageCheck, AlertTriangle } from "lucide-react";
import { Button } from "@shared/ui/button";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useMaterials } from "@shared/hooks/queries/useMaterialQueries";
import { useCategories } from "@shared/hooks/queries/useCategoryQueries";
import { ReportLoadingSkeleton } from "@widgets/reports";
import { formatNumber } from "@shared/lib/format";
import { useLocalization } from "@app/providers/LocalizationProvider";

/**
 * نواقص المخزون — the kind of "أصناف بحاجة للطلب" alert the Dashboard shows,
 * as a dedicated report table with shortage quantities, bar-code and category.
 */
export default function InventoryLowStockReport() {
  const { data: materials = [], isLoading, isRefetching, refetch } = useMaterials();
  const { data: categories = [] } = useCategories();
  const { t } = useLocalization();

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
          : t("inventoryLowStock.noCategory", { namespace: "reports",  }),
      }))
      .sort((a, b) => b.shortage - a.shortage);
  }, [materials, catNameById, t]);

  return (
    <OperationalTableTemplate
      title={t("inventoryLowStock.title", { namespace: "reports",  })}
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-black text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("inventoryLowStock.itemCount", { namespace: "reports", vars: { count: rows.length } })}
        </span>
      }
      toolbar={
        <div className="flex items-center gap-2">
          {isRefetching ? (
            <span className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs text-muted-foreground border border-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("inventoryLowStock.updating", { namespace: "reports",  })}
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg border-muted bg-white text-xs text-muted-foreground"
              onClick={() => void refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("inventoryLowStock.refresh", { namespace: "reports",  })}
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
                <tr className="text-muted-foreground font-black text-[10px] uppercase tracking-widest border-b border-muted">
                  <th className="text-end pb-4">{t("inventoryLowStock.colCode", { namespace: "reports",  })}</th>
                  <th className="text-end pb-4">{t("inventoryLowStock.colItem", { namespace: "reports",  })}</th>
                  <th className="text-end pb-4">{t("inventoryLowStock.colCategory", { namespace: "reports",  })}</th>
                  <th className="text-start pb-4">{t("inventoryLowStock.colBarcode", { namespace: "reports",  })}</th>
                  <th className="text-start pb-4">{t("inventoryLowStock.colQuantity", { namespace: "reports",  })}</th>
                  <th className="text-start pb-4">{t("inventoryLowStock.colMinimum", { namespace: "reports",  })}</th>
                  <th className="text-start pb-4">{t("inventoryLowStock.colShortage", { namespace: "reports",  })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground font-bold text-sm">
                      <PackageCheck className="mx-auto mb-2 h-8 w-8" />
                      {t("inventoryLowStock.empty", { namespace: "reports",  })}
                    </td>
                  </tr>
                )}
                {rows.map(({ material, available, minimum, shortage, category }) => (
                  <tr key={material.id} className="hover:bg-muted/50 transition-colors">
                    <td className="py-3 font-mono text-xs font-black text-primary" dir="ltr">
                      {material.code}
                    </td>
                    <td className="py-3 font-bold text-foreground">{material.name}</td>
                    <td className="py-3 text-sm text-muted-foreground">{category}</td>
                    <td className="py-3 text-start font-mono text-xs text-muted-foreground" dir="ltr">
                      {material.barcode || "—"}
                    </td>
                    <td className="py-3 text-start tabular-nums font-bold text-destructive">
                      {formatNumber(available)}
                    </td>
                    <td className="py-3 text-start tabular-nums text-muted-foreground">
                      {formatNumber(minimum)}
                    </td>
                    <td className="py-3 text-start">
                      <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-black tabular-nums text-destructive">
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