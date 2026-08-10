import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { CheckCircle2, Lock, RefreshCw, XCircle } from "lucide-react";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";
import { STATUS_LABEL } from "../lib/migration-labels";

export type MigrationActionHandler = (id: string) => void;

interface MigrationListCardProps {
  migrations: OpeningBalanceMigrationDto[];
  isLoading: boolean;
  postingId: string | null;
  cancellingId: string | null;
  transitioningTo: string | null;
  onValidate: MigrationActionHandler;
  onApprove: MigrationActionHandler;
  onPost: MigrationActionHandler;
  onLock: MigrationActionHandler;
  onCancel: MigrationActionHandler;
  onReopen: MigrationActionHandler;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Posted"
      ? "bg-green-100 text-green-700"
      : status === "Cancelled"
        ? "bg-red-100 text-red-600"
        : status === "Locked"
          ? "bg-slate-200 text-slate-700"
          : "bg-amber-100 text-amber-700";
  return <span className={`mr-2 text-xs px-2 py-0.5 rounded-full ${cls}`}>{STATUS_LABEL[status]}</span>;
}

export function MigrationListCard({
  migrations,
  isLoading,
  postingId,
  cancellingId,
  transitioningTo,
  onValidate,
  onApprove,
  onPost,
  onLock,
  onCancel,
  onReopen,
}: MigrationListCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800">ترحيلات الرصيد الافتتاحي</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && <p className="text-xs text-slate-400 p-4">جارٍ التحميل...</p>}
        {migrations.length === 0 && !isLoading && (
          <p className="text-xs text-slate-400 p-4 text-center">لا توجد ترحيلات بعد</p>
        )}
        <div className="divide-y divide-slate-100">
          {migrations.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">
                  {m.cutover_date.split("T")[0]} — {m.lines.length} بنود
                  <StatusBadge status={m.status} />
                </div>
                <div className="text-xs text-slate-400 truncate">{m.notes || "بدون ملاحظات"}</div>
              </div>

              {m.status === "Draft" && (
                <>
                  <Button
                    size="sm"
                    disabled={transitioningTo === m.id}
                    onClick={() => onValidate(m.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "تحقق"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancellingId === m.id}
                    onClick={() => onCancel(m.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5 ml-1.5" /> إلغاء
                  </Button>
                </>
              )}

              {m.status === "Validated" && (
                <>
                  <Button
                    size="sm"
                    disabled={transitioningTo === m.id}
                    onClick={() => onApprove(m.id)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" /> {transitioningTo === m.id ? "جارٍ..." : "اعتماد"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancellingId === m.id}
                    onClick={() => onCancel(m.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5 ml-1.5" /> إلغاء
                  </Button>
                </>
              )}

              {m.status === "Approved" && (
                <>
                  <Button
                    size="sm"
                    disabled={postingId === m.id}
                    onClick={() => onPost(m.id)}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" /> {postingId === m.id ? "جارٍ..." : "ترحيل"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancellingId === m.id}
                    onClick={() => onCancel(m.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                  >
                    <XCircle className="w-3.5 h-3.5 ml-1.5" /> إلغاء
                  </Button>
                </>
              )}

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