import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toFixed } from "@shared/lib/format";
import { Calculator, Coins } from "lucide-react";
import type { OpeningBalanceMigrationDto, NetProfitAllocationDto } from "../../accounting/api/openingBalanceService";

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
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Coins className="w-4 h-4 text-blue-600" /> توزيع صافي الربح على الشركاء
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          أدخل صافي الربح (نتيجة قائمة الدخل) حتى تاريخ القطع لتوزيعه على حسابات رأس مال الشركاء (51X)،
          أو احسبه تلقائياً من القيود المرحلة.
        </p>
        <div className="grid grid-cols-[1fr_180px_auto] gap-3">
          <div className="space-y-1.5">
            <FieldLabel>الترحيل المرحّل</FieldLabel>
            <Select value={allocMigrationId} onValueChange={onAllocMigrationIdChange}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                <SelectValue placeholder={postedMigrations.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات مرحّلة"} />
              </SelectTrigger>
              <SelectContent>
                {postedMigrations.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.cutover_date.split("T")[0]} — {m.notes || "بدون ملاحظات"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>صافي الربح</FieldLabel>
            <Input value={netProfit} onChange={(e) => onNetProfitChange(e.target.value)} placeholder="0.00" type="number" className="h-9 text-left tabular-nums" />
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
              <div className="font-bold tabular-nums">{toFixed(parseFloat(computedProfit.total_revenue || "0"), 2)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-slate-500 font-semibold">إجمالي المصاريف</div>
              <div className="font-bold tabular-nums">{toFixed(parseFloat(computedProfit.total_expenses || "0"), 2)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-slate-500 font-semibold">صافي الأرباح (قيد: {computedProfit.entry_count})</div>
              <div className="font-bold tabular-nums text-green-700">{toFixed(parseFloat(computedProfit.net_profit || "0"), 2)}</div>
            </div>
          </div>
        )}

        {allocResult && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-green-700">
              رقم القيد: {allocResult.entry_number} — الموزع:
              {toFixed(parseFloat(allocResult.allocated_total || "0"), 2)} من {toFixed(parseFloat(allocResult.net_profit || "0"), 2)}
            </div>
            {allocResult.shares.length === 0 && (
              <p className="text-xs text-slate-500">لا توجد حصص (صافي الربح صفر).</p>
            )}
            <div className="divide-y divide-green-100">
              {allocResult.shares.map((s) => (
                <div key={s.partner_id} className="flex items-center justify-between py-1 text-xs text-slate-700">
                  <span className="font-semibold">{s.partner_name}</span>
                  <span className="text-slate-400">رأس المال {toFixed(parseFloat(s.capital || "0"), 2)} · نسبة {toFixed(parseFloat(s.ratio_percent || "0"), 2)}%</span>
                  <span className="font-bold tabular-nums">{toFixed(parseFloat(s.share || "0"), 2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}