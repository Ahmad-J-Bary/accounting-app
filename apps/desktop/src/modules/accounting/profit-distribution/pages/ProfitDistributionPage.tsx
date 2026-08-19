import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Coins } from "lucide-react";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { SectionCard } from "@shared/ui/section-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toLocalDateStr } from "@shared/lib/format";
import { STATUS_LABEL } from "@shared/ui/status";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { openingBalanceService } from "@modules/accounting/api/openingBalanceService";
import { ProfitDistributionWorkflow } from "../components/ProfitDistributionWorkflow";
import type { ProfitDistributionSource } from "@modules/accounting/api/openingBalanceService";

type SourceKind = "opening" | "closed";

/**
 * General-purpose profit-distribution page. The source selector picks WHERE the
 * distributable pool comes from — an opening migration's retained earnings
 * (supported now) or a closed fiscal period (reserved for a later phase). The
 * wizard's [توزيع الأرباح] lands here with `?source=opening&migration=<id>` so
 * the source is preselected and the workflow is pre-filled.
 */
export default function ProfitDistributionPage() {
  const [searchParams] = useSearchParams();
  const querySource = searchParams.get("source") as SourceKind | null;
  const queryMigration = searchParams.get("migration");

  const [kind, setKind] = useState<SourceKind>(querySource ?? "opening");
  const [migrationId, setMigrationId] = useState(queryMigration ?? "");

  const { data: migrations = [], isLoading: loadingMigrations } = useQuery({
    queryKey: QUERY_KEYS.openingBalanceMigrations,
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const candidates = useMemo(
    () => migrations.filter((m) => m.status === "Posted" || m.status === "Locked"),
    [migrations],
  );

  const source = useMemo((): ProfitDistributionSource | null => {
    if (kind === "opening") {
      return migrationId ? { OpeningMigration: { migration_id: migrationId } } : null;
    }
    return null;
  }, [kind, migrationId]);

  const migration = useMemo(
    () => candidates.find((m) => m.id === migrationId) ?? null,
    [candidates, migrationId],
  );

  const queriedMigration = useMemo(
    () => migrations.find((m) => m.id === migrationId) ?? null,
    [migrations, migrationId],
  );
  const notPostedYet = kind === "opening" && migrationId !== "" && queriedMigration !== null && queriedMigration.status !== "Posted" && queriedMigration.status !== "Locked";

  const window = useMemo(() => {
    if (kind === "opening" && migration) {
      const day = migration.cutover_date.slice(0, 10);
      return {
        start: "1970-01-01T00:00:00Z",
        end: day ? new Date(`${day}T23:59:59Z`).toISOString() : "",
      };
    }
    return null;
  }, [kind, migration]);

  const sourceLabel = kind === "opening"
    ? migration
      ? `الأرباح المبقاة الافتتاحية — ترحيل بتاريخ ${toLocalDateStr(migration.cutover_date)} (${STATUS_LABEL[migration.status]})`
      : "الأرباح المبقاة الافتتاحية"
    : "أرباح فترة مالية مغلقة";

  return (
    <OperationalTableTemplate
      title="توزيع الأرباح"
      toolbar={
        <p className="text-xs text-slate-500">
          آلية توزيع واحدة لكل المصادر: تُوزَّع الأرباح على حسابات الشركاء الجارية وفق نسب التقاسم المسجّلة،
          ويُقيَّد المبلغ على حساب الأرباح المبقاة (52) دون المساس برأس المال. تُقيَّد كل توزيعة بمفتاح
          تفرّد يمنع تكرار القيد عند إعادة الإرسال.
        </p>
      }
      tableContent={
        <div className="p-4 space-y-4">
          <SectionCard
            title="مصدر الأرباح"
            icon={<Coins className="w-4 h-4 text-blue-600" />}
            description="اختر سياق الأرباح القابلة للتوزيع — تُعرَض الأرصدة المحسوبة تلقائياً من الأستاذ."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <FieldLabel>نوع المصدر</FieldLabel>
                <Select value={kind} onValueChange={(v) => { setKind(v as SourceKind); setMigrationId(""); }}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opening" className="text-xs">الأرباح المبقاة الافتتاحية (شركة قائمة)</SelectItem>
                    <SelectItem value="closed" className="text-xs" disabled>
                      فترة مالية مغلقة (غير مدعوم بعد)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {kind === "opening" && (
                <div className="space-y-1.5">
                  <FieldLabel>الترحيل الافتتاحي</FieldLabel>
                  <Select value={migrationId} onValueChange={setMigrationId}>
                    <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
                      <SelectValue placeholder={loadingMigrations ? "جارٍ التحميل..." : candidates.length ? "اختر ترحيلاً..." : "لا توجد ترحيلات مرحّلة"} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {toLocalDateStr(m.cutover_date)} — {STATUS_LABEL[m.status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </SectionCard>

          {kind === "closed" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              توزيع أرباح الفترات المالية المغلقة غير مدعوم بعد — ستُتاح هذه المرحلة لاحقاً عبر نفس آلية
              التوزيع. اختر الأرباح المبقاة الافتتاحية في الوقت الحالي.
            </div>
          )}

          {notPostedYet && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 space-y-1.5">
              <p className="font-bold">
                التوزيع متاح بعد ترحيل الرصيد الافتتاحي وقفله
              </p>
              <p>
                الرصيد الافتتاحي المحدد ({queriedMigration ? STATUS_LABEL[queriedMigration.status] : "جاري الإعداد"}).
                يُرحَّل الرصيد في المرحلة «الترحيل» ثم يُقفل لاحقاً — عندها تظهر الأرباح المبقاة هنا كمصدر
                للتوزيع. أكمل مراحل المعالج أولاً ثم عد إلى هذه الصفحة.
              </p>
            </div>
          )}

          {source && window ? (
            <ProfitDistributionWorkflow
              source={source}
              windowStart={window.start}
              windowEnd={window.end}
              sourceLabel={sourceLabel}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              {kind === "opening" && migrationId
                ? "الترحيل المحدد غير ظاهر في قائمة الترحيلات المتاحة للتوزيع."
                : "اختر المصدر والترحيل لعرض الأرصدة المتاحة للتوزيع."}
            </div>
          )}
        </div>
      }
    />
  );
}