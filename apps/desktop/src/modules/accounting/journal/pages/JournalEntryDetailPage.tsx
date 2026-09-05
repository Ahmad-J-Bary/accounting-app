import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { JOURNAL_TYPE_LABELS } from "@modules/accounting/journal/lib/journal-config";
import { Button } from "@shared/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { JournalEntrySummary } from "@modules/accounting/journal/components/JournalEntrySummary";
import { JOURNAL_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { formatDateTime, fmtMoney } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import type { JournalLineDraft } from "@modules/accounting/journal/lib/journal-entry-utils";
import { useTabs } from "@app/providers/TabContext";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Draft: "bg-slate-200 text-slate-600",
    Posted: "bg-emerald-100 text-emerald-700",
    Reversed: "bg-red-100 text-red-600",
    Cancelled: "bg-slate-300 text-slate-700",
  };
  const labels: Record<string, string> = {
    Draft: "مسودة",
    Posted: "مرحل",
    Reversed: "معكوس",
    Cancelled: "ملغي",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
        styles[status] || "bg-slate-100 text-slate-600",
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export default function JournalEntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openTab } = useTabs();

  const [confirmAction, setConfirmAction] = useState<"post" | "reverse" | null>(null);

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ["journal-entry", id],
    queryFn: () => journalEntryService.getJournalEntryDetails(id!),
    enabled: !!id,
  });

  const handleBack = useCallback(() => {
    navigate("/journal");
  }, [navigate]);

  const handlePost = useCallback(async () => {
    if (!entry) return;
    try {
      await journalEntryService.postJournalEntry(entry.id);
      toast.success(`تم ترحيل القيد ${entry.entry_number} بنجاح`);
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
      setConfirmAction(null);
    } catch (e) {
      toast.error("فشل ترحيل القيد: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [entry, queryClient]);

  const handleReverse = useCallback(async () => {
    if (!entry) return;
    try {
      const reversal = await journalEntryService.reverseJournalEntry(entry.id);
      toast.success(`تم ترحيل القيد العكسي ${reversal.entry_number}`);
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
      openTab({
        id: `journal-entry-${reversal.id}`,
        title: `تفاصيل القيد ${reversal.entry_number}`,
        path: `/journal/${reversal.id}`,
        closable: true,
      });
      setConfirmAction(null);
    } catch (e) {
      toast.error("فشل عكس القيد: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [entry, queryClient, openTab]);

  const totalDebit = entry?.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0) || 0;
  const totalCredit = entry?.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0) || 0;

  const summaryLines: JournalLineDraft[] =
    entry?.lines.map((l) => ({
      key: l.account_id,
      account_id: l.account_id,
      side: parseFloat(l.debit) > 0 ? "debit" : "credit",
      amount: parseFloat(l.debit) > 0 ? l.debit : l.credit,
      currency: l.currency,
      fx_rate: l.fx_rate,
      description: l.description,
    })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-500">جاري التحميل...</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-red-600">خطأ في تحميل بيانات القيد</p>
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          العودة
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0"
              aria-label="العودة"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">
                  تفاصيل القيد رقم {entry.entry_number}
                </h1>
                <StatusBadge status={entry.status} />
              </div>
              <p className="text-xs text-slate-500">
                {JOURNAL_TYPE_LABELS[entry.journal_type] || entry.journal_type_display}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {entry.status === "Draft" && (
              <>
                <Button
                  type="button"
                  onClick={() => setConfirmAction("post")}
                  className="h-9 px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  ترحيل القيد
                </Button>
              </>
            )}
            {entry.status === "Posted" && !entry.reversal_of_entry_id && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmAction("reverse")}
                className="h-9 px-4 font-bold text-red-600 border-red-200 hover:bg-red-50"
              >
                <Undo2 className="w-4 h-4 ms-1" />
                عكس القيد
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">معلومات القيد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">رقم القيد</p>
                  <p className="font-bold text-slate-800">{entry.entry_number}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">نوع اليومية</p>
                  <p className="font-bold text-slate-800">
                    {JOURNAL_TYPE_LABELS[entry.journal_type] || entry.journal_type}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">التاريخ</p>
                  <p className="font-bold text-slate-800">{formatDateTime(entry.entry_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">الحالة</p>
                  <StatusBadge status={entry.status} />
                </div>
                <div className="md:col-span-4">
                  <p className="text-slate-500 text-xs mb-0.5">البيان</p>
                  <p className="font-bold text-slate-800">{entry.description}</p>
                </div>
                {entry.source_id && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">مصدر القيد</p>
                    <p className="font-bold text-slate-800">{entry.source_id}</p>
                  </div>
                )}
                {entry.reversal_of_entry_id && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">عكس القيد</p>
                    <p className="font-bold text-slate-800">{entry.reversal_of_entry_id}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">تاريخ الإنشاء</p>
                  <p className="font-bold text-slate-800">{formatDateTime(entry.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">بنود القيد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">#</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">الحساب</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">المدين</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">الدائن</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line, index) => (
                      <tr key={index} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 px-3 text-xs text-slate-400 tabular-nums">{index + 1}</td>
                        <td className="py-2 px-3">
                          <span className="flex items-center gap-2">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                              {line.account_code}
                            </span>
                            <span className="font-bold text-slate-800">{line.account_name}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-end">
                          {parseFloat(line.debit) > 0 ? (
                            <span className="tabular-nums font-bold text-blue-700">
                              {fmtMoney(line.debit)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-end">
                          {parseFloat(line.credit) > 0 ? (
                            <span className="tabular-nums font-bold text-emerald-700">
                              {fmtMoney(line.credit)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-slate-600">{line.description}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold">
                      <td colSpan={2} className="py-2 px-3 text-end text-xs">الإجمالي</td>
                      <td className="py-2 px-3 text-end tabular-nums text-blue-700">
                        {fmtMoney(totalDebit)}
                      </td>
                      <td className="py-2 px-3 text-end tabular-nums text-emerald-700">
                        {fmtMoney(totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <JournalEntrySummary lines={summaryLines} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "post"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="تأكيد ترحيل القيد"
        description={`هل تريد ترحيل القيد رقم ${entry.entry_number}؟ بعد الترحيل لا يمكن تعديله.`}
        confirmLabel="ترحيل"
        cancelLabel="إلغاء"
        onConfirm={handlePost}
      />

      <ConfirmDialog
        open={confirmAction === "reverse"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="تأكيد عكس القيد"
        description="سيتم ترحيل قيد عكسي (معاكس) يُلغي أثر القيد ويحدد القيد الأصلي كمعكوس. هل تريد المتابعة؟"
        confirmLabel="عكس القيد"
        cancelLabel="إلغاء"
        destructive
        onConfirm={handleReverse}
      />
    </ErrorBoundary>
  );
}
