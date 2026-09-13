import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { journalTypeKey } from "@modules/accounting/journal/lib/journal-config";
import { useLocalization } from "@app/providers/LocalizationProvider";
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
  const { t } = useLocalization();
  const styles: Record<string, string> = {
    Draft: "bg-slate-200 text-slate-600",
    Posted: "bg-emerald-100 text-emerald-700",
    Reversed: "bg-red-100 text-red-600",
    Cancelled: "bg-slate-300 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
        styles[status] || "bg-slate-100 text-slate-600",
      )}
    >
      {t(`journal.detail.status.${status}`, { namespace: "accounting"})}
    </span>
  );
}

export default function JournalEntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openTab } = useTabs();
  const { t } = useLocalization();

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
      toast.success(t("journal.detail.toastPosted", { namespace: "accounting", vars: { number: entry.entry_number },  }));
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
      setConfirmAction(null);
    } catch (e) {
      toast.error(t("journal.detail.toastPostFailed", { namespace: "accounting", vars: { error: e instanceof Error ? e.message : String(e) } }));
    }
  }, [entry, queryClient, t]);

  const handleReverse = useCallback(async () => {
    if (!entry) return;
    try {
      const reversal = await journalEntryService.reverseJournalEntry(entry.id);
      toast.success(t("journal.detail.toastReversePosted", { namespace: "accounting", vars: { number: reversal.entry_number },  }));
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
      openTab({
        id: `journal-entry-${reversal.id}`,
        title: t("journal.detail.tabTitle", { namespace: "accounting", vars: { number: reversal.entry_number },  }),
        path: `/journal/${reversal.id}`,
        closable: true,
      });
      setConfirmAction(null);
    } catch (e) {
      toast.error(t("journal.detail.toastReverseFailed", { namespace: "accounting", vars: { error: e instanceof Error ? e.message : String(e) } }));
    }
  }, [entry, queryClient, openTab, t]);

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
        <p className="text-sm text-slate-500">{t("journal.loading", { namespace: "accounting",  })}</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-red-600">{t("journal.detail.loadError", { namespace: "accounting",  })}</p>
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          {t("journal.back", { namespace: "accounting",  })}
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
              aria-label={t("journal.back", { namespace: "accounting",  })}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">
                  {t("journal.detail.title", { namespace: "accounting", vars: { number: entry.entry_number },  })}
                </h1>
                <StatusBadge status={entry.status} />
              </div>
              <p className="text-xs text-slate-500">
                {t(journalTypeKey(entry.journal_type), { namespace: "accounting"})}
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
                  {t("journal.detail.post", { namespace: "accounting",  })}
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
                {t("journal.detail.reverse", { namespace: "accounting",  })}
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("journal.detail.infoSection", { namespace: "accounting",  })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.entryNumber", { namespace: "accounting",  })}</p>
                  <p className="font-bold text-slate-800">{entry.entry_number}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.journalType", { namespace: "accounting",  })}</p>
                  <p className="font-bold text-slate-800">
                    {t(journalTypeKey(entry.journal_type), { namespace: "accounting"})}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.date", { namespace: "accounting",  })}</p>
                  <p className="font-bold text-slate-800">{formatDateTime(entry.entry_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.statusLabel", { namespace: "accounting",  })}</p>
                  <StatusBadge status={entry.status} />
                </div>
                <div className="md:col-span-4">
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.description", { namespace: "accounting",  })}</p>
                  <p className="font-bold text-slate-800">{entry.description}</p>
                </div>
                {entry.source_id && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.source", { namespace: "accounting",  })}</p>
                    <p className="font-bold text-slate-800">{entry.source_id}</p>
                  </div>
                )}
                {entry.reversal_of_entry_id && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.reverses", { namespace: "accounting",  })}</p>
                    <p className="font-bold text-slate-800">{entry.reversal_of_entry_id}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">{t("journal.detail.createdAt", { namespace: "accounting",  })}</p>
                  <p className="font-bold text-slate-800">{formatDateTime(entry.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("journal.detail.linesSection", { namespace: "accounting",  })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">#</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">{t("journal.detail.colAccount", { namespace: "accounting",  })}</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">{t("journal.detail.colDebit", { namespace: "accounting",  })}</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">{t("journal.detail.colCredit", { namespace: "accounting",  })}</th>
                      <th className="text-end py-2 px-3 text-xs font-bold text-slate-500">{t("journal.detail.colDescription", { namespace: "accounting",  })}</th>
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
                      <td colSpan={2} className="py-2 px-3 text-end text-xs">{t("journal.detail.total", { namespace: "accounting",  })}</td>
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
        title={t("journal.detail.confirmPost.title", { namespace: "accounting",  })}
        description={t("journal.detail.confirmPost.description", { namespace: "accounting", vars: { number: entry.entry_number },  })}
        confirmLabel={t("journal.detail.confirmPost.confirm", { namespace: "accounting",  })}
        cancelLabel={t("journal.actions.cancel", { namespace: "accounting",  })}
        onConfirm={handlePost}
      />

      <ConfirmDialog
        open={confirmAction === "reverse"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t("journal.confirmReverse.title", { namespace: "accounting",  })}
        description={t("journal.confirmReverse.description", { namespace: "accounting",  })}
        confirmLabel={t("journal.confirmReverse.confirm", { namespace: "accounting",  })}
        cancelLabel={t("journal.actions.cancel", { namespace: "accounting",  })}
        destructive
        onConfirm={handleReverse}
      />
    </ErrorBoundary>
  );
}
