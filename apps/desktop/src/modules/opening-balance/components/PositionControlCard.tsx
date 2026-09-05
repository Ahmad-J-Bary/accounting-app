import { Button } from "@shared/ui/button";
import { SectionCard } from "@shared/ui/section-card";
import { StatusBadge } from "@shared/ui/status-badge";
import { fmtMoney, toLocalDateStr } from "@shared/lib/format";
import { Eye } from "lucide-react";
import type { PositionAccountLine, OpeningPositionControlDto } from "@erp/shared-types";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";
import { MigrationPicker } from "./MigrationPicker";

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
    <SectionCard
      title="المركز الافتتاحي (قراءة فقط)"
      icon={<Eye className="w-4 h-4 text-blue-600" />}
      description="يعرض المركز المالي الافتتاحي المشتق من بنود الترحيل نفسها (A = L + E) دون إنشاء أي قيد اليومية، ويسلط الضوء على الفرق غير المصنف إن وُجد للرجوع إلى سير عمل تصنيف الرصيد المتبقي."
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <MigrationPicker id="pos-migration" label="الترحيل" candidates={candidates} value={positionId} onChange={onPositionIdChange} />
        <Button size="sm" onClick={onShow} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
          {loading ? "جارٍ العرض..." : "عرض المركز"}
        </Button>
      </div>

        {(() => {
          const selected = candidates.find((m) => m.id === positionId);
          if (!selected) return null;
          return (
            <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700">حالة الافتتاح:</span>
              <StatusBadge status={selected.status} />
              <span className="font-semibold text-slate-700">تاريخ القطع:</span>
              <span className="tabular-nums font-bold text-slate-700">{toLocalDateStr(selected.cutover_date)}</span>
              {selected.notes && <span className="text-slate-500 truncate">· {selected.notes}</span>}
            </div>
          );
        })()}

        {position && (
          <div className="border border-slate-200 rounded-lg space-y-3 p-3">
            <div className={"flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold " + (position.is_balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
              <span>{position.is_balanced ? "المركز متوازن ✓" : "يوجد فرق في المركز"}</span>
              <span className="tabular-nums">
                الفرق: {fmtMoney(position.equity_difference)}
              </span>
            </div>

            {!position.is_balanced && position.difference_message && (
              <div className="px-3 py-2 text-xs bg-amber-50 text-amber-800 rounded-lg">
                {position.difference_message}
              </div>
            )}

            {position.unreconciled_items.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-700">بنود غير مطابقة (السجل المساعد)</div>
                <div className="border border-amber-200 rounded-lg divide-y divide-amber-100">
                  {position.unreconciled_items.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <span className="font-semibold text-slate-700">{r.label}</span>
                      <span className="tabular-nums text-slate-600">
                        السجل المساعد: {fmtMoney(r.subledger)} ← الأستاذ: {fmtMoney(r.general_ledger)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {position.validation_errors.length > 0 && (
              <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs space-y-1">
                <div className="font-bold">أخطاء الجاهزية للترحيل</div>
                {position.validation_errors.map((e, i) => (
                  <div key={i} className="ps-1">• {e}</div>
                ))}
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
                  <div className={"font-bold tabular-nums " + row.color}>{fmtMoney(row.value)}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">رأس مال الشركاء</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.partner_capital)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">الحسابات الجارية</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.partner_current_accounts)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">الأرباح المبقاة</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.retained_earnings)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">تسوية رصيد الافتتاح (53)</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.opening_equity_adjustment)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">حقوق ملكية أخرى</div>
                <div className="font-bold tabular-nums">{fmtMoney(position.other_equity)}</div>
              </div>
              <div className="border border-slate-100 rounded-lg p-2 space-y-1">
                <div className="text-slate-500 font-semibold">مسحوبات (−)</div>
                <div className="font-bold tabular-nums text-red-600">{fmtMoney(position.drawings)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
              <span className="font-semibold text-slate-700">
                النتيجة التاريخية الافتتاحية (صافي الأصول − رأس المال − حقوق صريحة أخرى):
              </span>
              <span className="font-black tabular-nums text-indigo-700">
                {fmtMoney(position.opening_historical_result)}
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
                      <span className="tabular-nums text-slate-600">رأس المال: {fmtMoney(p.capital)}</span>
                      <span className="tabular-nums text-slate-600">النسبة: {fmtMoney(p.ownership_percent)}%</span>
                      <span className="tabular-nums text-slate-600">جاري: {fmtMoney(p.current)}</span>
                      <span className="tabular-nums text-slate-600">مسحوبات: {fmtMoney(p.drawings)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
    </SectionCard>
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
              <span className="text-2xs font-bold text-slate-400 tabular-nums">{l.code}</span>
              <span className="truncate text-slate-700">{l.name_ar}</span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{l.group_key}</span>
            </div>
            <span className="tabular-nums font-semibold text-slate-700">{fmtMoney(l.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}