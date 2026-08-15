import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { SectionCard } from "@shared/ui/section-card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { fmtMoney } from "@shared/lib/format";
import { Calculator, Coins } from "lucide-react";
import type { OpeningBalanceMigrationDto, NetProfitAllocationDto } from "../../accounting/api/openingBalanceService";
import { MigrationPicker } from "./MigrationPicker";

interface ProfitAllocationCardProps {
  postedMigrations: OpeningBalanceMigrationDto[];
  allocMigrationId: string;
  onAllocMigrationIdChange: (v: string) => void;
  netProfit: string;
  onNetProfitChange: (v: string) => void;
  allocating: boolean;
  computingProfit: boolean;
  allocResult: NetProfitAllocationDto | null;
  computedProfit: {
    net_profit: string;
    total_revenue: string;
    total_expenses: string;
    entry_count: number;
  } | null;
  onCompute: () => void;
  onAllocate: () => void;
}

export function ProfitAllocationCard({
  postedMigrations,
  allocMigrationId,
  onAllocMigrationIdChange,
  netProfit,
  onNetProfitChange,
  allocating,
  computingProfit,
  allocResult,
  computedProfit,
  onCompute,
  onAllocate,
}: ProfitAllocationCardProps) {
  return (
    <SectionCard
      title="توزيع صافي الربح على الشركاء"
      icon={<Coins className="w-4 h-4 text-blue-600" />}
      description="أدخل صافي الربح (نتيجة قائمة الدخل) حتى تاريخ القطع لتوزيعه على حسابات رأس مال الشركاء (51X)، أو احسبه تلقائياً من القيود المرحلة."
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
        <MigrationPicker id="alloc-migration" label="الترحيل المرحّل" candidates={postedMigrations} value={allocMigrationId} onChange={onAllocMigrationIdChange} />
        <div className="space-y-1.5">
          <FieldLabel htmlFor="alloc-net-profit">صافي الربح</FieldLabel>
          <Input id="alloc-net-profit" value={netProfit} onChange={(e) => onNetProfitChange(e.target.value)} placeholder="0.00" type="number" className="h-9 text-right tabular-nums" />
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onCompute} disabled={computingProfit} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold" title="احتساب صافي الربح من قيود اليومية المرحلة للسنة حتى تاريخ القطع">
            <Calculator className="w-4 h-4" />
            {computingProfit ? "جارٍ الاحتساب..." : "احسب من اليومية"}
          </Button>
          <Button size="sm" onClick={onAllocate} disabled={allocating} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            {allocating ? "جارٍ التوزيع..." : "توزيع"}
          </Button>
        </div>
      </div>

      {computedProfit && (
        <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-slate-500 font-semibold">إجمالي الإيرادات</div>
            <div className="font-bold tabular-nums">{fmtMoney(computedProfit.total_revenue)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500 font-semibold">إجمالي المصاريف</div>
            <div className="font-bold tabular-nums">{fmtMoney(computedProfit.total_expenses)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-slate-500 font-semibold">صافي الأرباح (قيد: {computedProfit.entry_count})</div>
            <div className="font-bold tabular-nums text-green-700">{fmtMoney(computedProfit.net_profit)}</div>
          </div>
        </div>
      )}

      {allocResult && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-green-700">
            رقم القيد: {allocResult.entry_number} — الموزع:
            {fmtMoney(allocResult.allocated_total)} من {fmtMoney(allocResult.net_profit)}
          </div>
          {allocResult.shares.length === 0 && (
            <p className="text-xs text-slate-500">لا توجد حصص (صافي الربح صفر).</p>
          )}
          <div className="divide-y divide-green-100">
            {allocResult.shares.map((s) => (
              <div key={s.partner_id} className="flex items-center justify-between py-1 text-xs text-slate-700">
                <span className="font-semibold">{s.partner_name}</span>
                <span className="text-slate-400">رأس المال {fmtMoney(s.capital)} · نسبة {fmtMoney(s.ratio_percent)}%</span>
                <span className="font-bold tabular-nums">{fmtMoney(s.share)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}