import { Button } from "@shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Eye } from "lucide-react";
import type { PositionAccountLine, OpeningPositionControlDto } from "@erp/shared-types";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";
import { STATUS_LABEL } from "../lib/migration-labels";

interface PositionControlCardProps {
  candidates: OpeningBalanceMigrationDto[];
  positionId: string;
  onPositionIdChange: (v: string) => void;
  loading: boolean;
  position: OpeningPositionControlDto | null;
  onShow: () => void;
}

export function PositionControlCard({
  candidates,
  positionId,
  onPositionIdChange,
  loading,
  position,
  onShow,
}: PositionControlCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Eye className="w-4 h-4 text-blue-600" /> المركز الافتتاحي (قراءة فقط)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          يعرض المركز المالي الافتتاحي المشتق من بنود الترحيل نفسها (A = L + E) دون إنشاء أي قيد اليومية،
          ويسلط الضوء على الفرق غير المصنف إن وُجد للرجوع إلى سير عمل تصنيف الرصيد المتبقي.
        </p>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">الترحيل</label>
            <Select value={positionId} onValueChange={onPositionIdChange}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                <SelectValue placeholder={candidates.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات"} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.cutover_date.split("T")[0]} — {STATUS_LABEL[m.status]} — {m.lines.length} بنود
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={onShow} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            {loading ? "جارٍ العرض..." : "عرض المركز"}
          </Button>
        </div>

        {position && (
          <div className="border border-slate-200 rounded-lg space-y-3 p-3">
            <div className={"flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold " + (position.is_balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
              <span>{position.is_balanced ? "المركز متوازن ✓" : "يوجد فرق في المركز"}</span>
              <span className="tabular-nums">
                الفرق: {parseFloat(position.equity_difference || "0").toFixed(2)}
              </span>
            </div>

            {!position.is_balanced && position.difference_message && (
              <div className="px-3 py-2 text-xs bg-amber-50 text-amber-800 rounded-lg">
                {position.difference_message}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {[
                { label: "الأصول", value: position.total_assets, color: "text-blue-700" },
                { label: "الخصوم", value: position.total_liabilities, color: "text-emerald-700" },
                { label: "صافي الأصول", value: position.net_assets, color: "text-slate-800 font-black" },
                { label: "حقوق الملكية", value: position.total_equity, color: "text-indigo-700" },
              ].map((row) => (
                <div key={row.label} className="border border-slate-100 rounded-lg p-2 space-y-0.5 bg-white">
                  <div className="text-slate-500 font-semibold">{row.label}</div>
                  <div className={"font-bold tabular-nums " + row.color}>{parseFloat(row.value || "0").toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">رأس مال الشركاء</div>
                <div className="font-bold tabular-nums">{parseFloat(position.partner_capital || "0").toFixed(2)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">الحسابات الجارية</div>
                <div className="font-bold tabular-nums">{parseFloat(position.partner_current_accounts || "0").toFixed(2)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">الأرباح المبقاة</div>
                <div className="font-bold tabular-nums">{parseFloat(position.retained_earnings || "0").toFixed(2)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">تسوية رصيد الافتتاح (53)</div>
                <div className="font-bold tabular-nums">{parseFloat(position.opening_equity_adjustment || "0").toFixed(2)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">حقوق ملكية أخرى</div>
                <div className="font-bold tabular-nums">{parseFloat(position.other_equity || "0").toFixed(2)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">مسحوبات (−)</div>
                <div className="font-bold tabular-nums text-red-600">{parseFloat(position.drawings || "0").toFixed(2)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
              <span className="font-semibold text-slate-700">
                النتيجة التاريخية الافتتاحية (صافي الأصول − رأس المال − حقوق صريحة أخرى):
              </span>
              <span className="font-black tabular-nums text-indigo-700">
                {parseFloat(position.opening_historical_result || "0").toFixed(2)}
              </span>
            </div>

            {position.asset_detail.length > 0 && (
              <PositionDetailTable title="تفاصيل الأصول" lines={position.asset_detail} />
            )}
            {position.liability_detail.length > 0 && (
              <PositionDetailTable title="تفاصيل الخصوم" lines={position.liability_detail} />
            )}
            {position.equity_detail.length > 0 && (
              <PositionDetailTable title="تفاصيل حقوق الملكية" lines={position.equity_detail} />
            )}

            {position.partner_rows.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-700">تفصيل الشركاء</div>
                <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                  {position.partner_rows.map((p) => (
                    <div key={p.partner_id} className="grid grid-cols-2 md:grid-cols-5 gap-2 px-3 py-2 text-xs items-center">
                      <span className="font-semibold text-slate-700">{p.partner_name}</span>
                      <span className="tabular-nums text-slate-600">رأس المال: {parseFloat(p.capital || "0").toFixed(2)}</span>
                      <span className="tabular-nums text-slate-600">النسبة: {parseFloat(p.ownership_percent || "0").toFixed(2)}%</span>
                      <span className="tabular-nums text-slate-600">جاري: {parseFloat(p.current || "0").toFixed(2)}</span>
                      <span className="tabular-nums text-slate-600">مسحوبات: {parseFloat(p.drawings || "0").toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PositionDetailTable({ title, lines }: { title: string; lines: PositionAccountLine[] }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-bold text-slate-700">{title}</div>
      <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
        {lines.map((l) => (
          <div key={l.account_id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 tabular-nums">{l.code}</span>
              <span className="truncate text-slate-700">{l.name_ar}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{l.group_key}</span>
            </div>
            <span className="tabular-nums font-semibold text-slate-700">{parseFloat(l.amount || "0").toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}