import { Loader2, PackageCheck } from "lucide-react";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { toFixed } from "@shared/lib/format";
import { toNum } from "@modules/opening-balance/lib/wizard-types";
import type { AccountDto } from "@erp/shared-types";
import type { InventoryEntry } from "@modules/opening-balance/lib/derive-rows";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";

interface InventorySectionProps {
  rows: InventoryEntry[];
  onRowChange: (materialId: string, patch: { qty?: string; cost?: string }) => void;
  total: number;
  accountId: string;
  defaultAccount: string;
  onAccountChange: (id: string) => void;
  posted: boolean;
  posting: boolean;
  onPost: () => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}

/**
 * Wizard inventory step: enter qty + unit cost per material. The wizard then
 * creates + posts the OpeningBalance invoice (real lots) and carries the stock
 * into the migration as a single debit line + per-material items so the
 * Inventory sub-ledger reconciles with the GL.
 */
export function InventorySection({
  rows,
  onRowChange,
  total,
  accountId,
  defaultAccount,
  onAccountChange,
  posted,
  posting,
  onPost,
  accounts,
  detailAccounts,
}: InventorySectionProps) {
  const actionable = rows.filter((r) => toNum(r.qty) > 0 && toNum(r.cost) > 0);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        سجّل كميات وتكاليف بضاعة أول المدة لكل مادة. بعد «ترحيل رصيد البضاعة» تُنشأ حركات وأرصدة المخزون الفعلية
        وتدخل القيمة في بيان الرصيد الافتتاحي كبند واحد.
      </p>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">لا توجد مواد بعد — أضف المواد من صفحة «الأصناف» أولاً.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 bg-slate-100/70 px-3 py-1.5 text-2xs font-bold text-slate-500">
            <span className="col-span-5">المادة</span>
            <span className="col-span-2 text-center">الكمية</span>
            <span className="col-span-2 text-center">التكلفة</span>
            <span className="col-span-3 text-right">القيمة</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-auto">
            {rows.map((r) => (
              <div key={r.material_id} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-xs">
                <div className="col-span-5 min-w-0">
                  <span className="text-2xs font-bold text-slate-400 tabular-nums ml-1">{r.code || "—"}</span>
                  <span className="truncate text-slate-700">{r.name}</span>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={r.qty}
                    disabled={posted}
                    onChange={(e) => onRowChange(r.material_id, { qty: e.target.value })}
                    aria-label={"الكمية: " + r.name}
                    className="h-8 border-slate-200 text-right tabular-nums text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.cost}
                    disabled={posted}
                    onChange={(e) => onRowChange(r.material_id, { cost: e.target.value })}
                    aria-label={"التكلفة: " + r.name}
                    className="h-8 border-slate-200 text-right tabular-nums text-xs"
                  />
                </div>
                <div className="col-span-3 text-right tabular-nums font-semibold text-slate-700">
                  {toFixed(r.value, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-600">حساب المخزون (يُقيَّد عليه البند)</p>
          <AccountCombobox
            accounts={accounts}
            options={detailAccounts}
            value={accountId}
            onValueChange={onAccountChange}
            placeholder="تم اختيار حساب المخزون الافتراضي"
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">إجمالي المخزون</span>
          <span className="tabular-nums text-sm font-black text-indigo-700">{toFixed(total, 2)}</span>
        </div>
      </div>

      {posted ? (
        <div className="rounded-lg p-3 text-xs font-bold bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
          <PackageCheck className="w-4 h-4" />
          تم ترحيل رصيد البضاعة إلى المخزون — الكميات والتكاليف مثبّتة الآن.
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={onPost}
          disabled={posting || actionable.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
        >
          {posting ? <Loader2 className="w-4 h-4 animate-spin ml-1.5" /> : null}
          ترحيل رصيد البضاعة (فتح المخزون)
        </Button>
      )}
    </div>
  );
}