import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Lock, RefreshCw, XCircle } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import { Skeleton } from "@shared/ui/skeleton";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";

export type MigrationActionHandler = (id: string) => void;

interface MigrationListCardProps {
  migrations: OpeningBalanceMigrationDto[];
  isLoading: boolean;
  cancellingId: string | null;
  transitioningTo: string | null;
  onLock: MigrationActionHandler;
  onCancel: MigrationActionHandler;
  onReopen: MigrationActionHandler;
}

export function MigrationListCard({
  migrations,
  isLoading,
  cancellingId,
  transitioningTo,
  onLock,
  onCancel,
  onReopen,
}: MigrationListCardProps) {
  const settled = migrations.filter((m) => m.status === "Posted" || m.status === "Locked" || m.status === "Cancelled");

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800">سجل ترحيلات الرصيد الافتتاحي</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
        {settled.length === 0 && !isLoading && (
          <EmptyState compact message="لا توجد ترحيلات منجزة بعد" suggestion="الترحيلات المرحّلة أو المقفلة أو الملغاة تظهر هنا" />
        )}
        <div className="divide-y divide-slate-100">
          {settled.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">
                  {m.cutover_date.split("T")[0]} — {m.lines.length} بنود
                  <StatusBadge status={m.status} className="mr-2" />
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {m.notes || "بدون ملاحظات"}
                  {m.locked_at ? ` · مقفول ${m.locked_at.split("T")[0]}` : ""}
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
                    <Lock className="w-3.5 h-3.5 ml-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "قفل"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancellingId === m.id}
                    onClick={() => onCancel(m.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5 ml-1.5" /> {cancellingId === m.id ? "جارٍ..." : "إلغاء الترحيل"}
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
                  <RefreshCw className="w-3.5 h-3.5 ml-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "إعادة فتح"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}