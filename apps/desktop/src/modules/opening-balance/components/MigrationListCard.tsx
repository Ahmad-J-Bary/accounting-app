import { Button } from "@shared/ui/button";
import { Lock, RefreshCw, XCircle, FileClock } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import { LoadingState } from "@widgets/table-shell/LoadingState";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { SectionCard } from "@shared/ui/section-card";
import { toLocalDateStr } from "@shared/lib/format";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";

export type MigrationActionHandler = (id: string) => void;

interface MigrationListCardProps {
  migrations: OpeningBalanceMigrationDto[];
  isLoading: boolean;
  cancellingId: string | null;
  transitioningTo: string | null;
  draft?: string | null;
  onResume?: () => void;
  onLock: MigrationActionHandler;
  onCancel: MigrationActionHandler;
  onReopen: MigrationActionHandler;
}

export function MigrationListCard({
  migrations,
  isLoading,
  cancellingId,
  transitioningTo,
  draft = null,
  onResume,
  onLock,
  onCancel,
  onReopen,
}: MigrationListCardProps) {
  const settled = migrations.filter((m) => m.status === "Posted" || m.status === "Locked" || m.status === "Cancelled");

  return (
    <SectionCard title="سجل ترحيلات الرصيد الافتتاحي" contentClassName="p-0">
      {draft && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dashed border-blue-200 bg-blue-50/50">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
              <FileClock className="w-4 h-4" /> توجد مسودة رصيد افتتاحي محفوظة
            </div>
            <div className="text-xs text-slate-500">أنت في منتصف إدخال الأرصدة — أكمل من حيث توقفت.</div>
          </div>
          {onResume && (
            <Button size="sm" onClick={onResume} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
              استكمال المتابعة
            </Button>
          )}
        </div>
      )}
      {isLoading && <LoadingState rows={3} />}
      {settled.length === 0 && !isLoading && (
        <EmptyState compact message="لا توجد ترحيلات منجزة بعد" suggestion="الترحيلات المرحّلة أو المقفلة أو الملغاة تظهر هنا" />
      )}
      <div className="divide-y divide-slate-100">
        {settled.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700">
                {toLocalDateStr(m.cutover_date)} — {m.lines.length} بنود
                <StatusBadge status={m.status} className="me-2" />
              </div>
              <div className="text-xs text-slate-400 truncate">
                {m.notes || "بدون ملاحظات"}
                {m.locked_at ? ` · مقفول ${toLocalDateStr(m.locked_at)}` : ""}
              </div>
            </div>

            {m.status === "Posted" && (
              <>
                <Button
                  size="sm"
                  disabled={transitioningTo === m.id}
                  onClick={() => onLock(m.id)}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-bold"
                >
                  <Lock className="w-3.5 h-3.5 ms-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "قفل"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancellingId === m.id}
                  onClick={() => onCancel(m.id)}
                  className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                >
                  <XCircle className="w-3.5 h-3.5 ms-1.5" /> {cancellingId === m.id ? "جارٍ..." : "إلغاء الترحيل"}
                </Button>
              </>
            )}

            {m.status === "Locked" && (
              <span className="text-2xs font-bold text-slate-400">مقفول نهائياً — لا يمكن التعديل</span>
            )}

            {m.status === "Cancelled" && (
              <Button
                size="sm"
                variant="outline"
                disabled={transitioningTo === m.id}
                onClick={() => onReopen(m.id)}
                className="border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                title="إعادة فتح الترحيل الملغى كمسودة"
              >
                <RefreshCw className="w-3.5 h-3.5 ms-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "إعادة فتح"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}