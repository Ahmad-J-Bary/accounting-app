import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { ArrowLeft } from "lucide-react";
import { toFixed } from "@shared/lib/format";
import type { InventoryEntry } from "@modules/opening-balance/lib/derive-rows";

interface InventorySectionProps {
  rows: InventoryEntry[];
  onRowChange: (materialId: string, { qty, cost }: { qty?: string; cost?: string }) => void;
  total: number;
  onNavigateToInvoice: () => void;
}

/**
 * Wizard inventory step: enter qty + unit cost per material.
 * The inventory account is fixed to "بضاعة أول المدة" (auto-resolved).
 * Posting is done through the opening invoice page.
 */
export function InventorySection({ rows, onRowChange, total, onNavigateToInvoice }: InventorySectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        سجّل كميات وتكاليف بضاعة أول المدة لكل مادة. الحساب محصور تلقائياً على «بضاعة أول المدة».
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">لا توجد مواد بعد — أضف المواد من صفحة «الأصناف» أولاً.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 bg-slate-100/70 px-3 py-1.5 text-2xs font-bold text-slate-500">
            <span className="col-span-5">المادة</span>
            <span className="col-span-2 text-center">الكمية</span>
            <span className="col-span-2 text-center">التكلفة</span>
            <span className="col-span-3 text-end">القيمة</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-auto">
            {rows.map((r) => (
              <div key={r.material_id} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-xs">
                <div className="col-span-5 min-w-0">
                  <span className="text-2xs font-bold text-slate-400 tabular-nums ms-1">{r.code || "—"}</span>
                  <span className="truncate text-slate-700">{r.name}</span>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={r.qty}
                    onChange={(e) => onRowChange(r.material_id, { qty: e.target.value })}
                    aria-label={"الكمية: " + r.name}
                    className="h-8 border-slate-200 text-end tabular-nums text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.cost}
                    onChange={(e) => onRowChange(r.material_id, { cost: e.target.value })}
                    aria-label={"التكلفة: " + r.name}
                    className="h-8 border-slate-200 text-end tabular-nums text-xs"
                  />
                </div>
                <div className="col-span-3 text-end tabular-nums font-semibold text-slate-700">
                  {toFixed(r.value, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">إجمالي المخزون</span>
        <span className="tabular-nums text-sm font-black text-indigo-700">{toFixed(total, 2)}</span>
      </div>

      <div className="flex justify-start pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onNavigateToInvoice}
          className="h-8 shrink-0 rounded-full border-blue-300 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all"
        >
          صفحة فاتورة أول المدة
          <ArrowLeft className="w-3.5 h-3.5 me-1" />
        </Button>
      </div>
    </div>
  );
}
