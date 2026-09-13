import { Button } from "@shared/ui/button";
import { Lock, RefreshCw, XCircle, FileClock } from "lucide-react";
import { StatusBadge } from "@shared/ui/status-badge";
import { LoadingState } from "@widgets/table-shell/LoadingState";
import { EmptyState } from "@widgets/table-shell/EmptyState";
import { SectionCard } from "@shared/ui/section-card";
import { toLocalDateStr } from "@shared/lib/format";
import type { OpeningBalanceMigrationDto } from "../../accounting/api/openingBalanceService";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  const settled = migrations.filter((m) => m.status === "Posted" || m.status === "Locked" || m.status === "Cancelled");

  return (
    <SectionCard title={t("openingBalance.migrationLogTitle", { namespace: "accounting",  })} contentClassName="p-0">
      {draft && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dashed border-blue-200 bg-blue-50/50">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
              <FileClock className="w-4 h-4" /> {t("openingBalance.savedDraft", { namespace: "accounting",  })}
            </div>
            <div className="text-xs text-slate-500">{t("openingBalance.savedDraftDesc", { namespace: "accounting",  })}</div>
          </div>
          {onResume && (
              <Button size="sm" onClick={onResume} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {t("openingBalance.resumeButton", { namespace: "accounting",  })}
              </Button>
          )}
        </div>
      )}
      {isLoading && <LoadingState rows={3} />}
      {settled.length === 0 && !isLoading && (
        <EmptyState compact message={t("openingBalance.emptyMigrations", { namespace: "accounting",  })} suggestion={t("openingBalance.emptyMigrationsDesc", { namespace: "accounting",  })} />
      )}
      <div className="divide-y divide-slate-100">
        {settled.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700">
                {toLocalDateStr(m.cutover_date)} — {m.lines.length} {t("openingBalance.lineCount", { namespace: "accounting",  })}
                <StatusBadge status={m.status} className="me-2" />
              </div>
              <div className="text-xs text-slate-400 truncate">
                {m.notes || t("openingBalance.noNotes", { namespace: "accounting",  })}
                {m.locked_at ? ` · ${t("openingBalance.lockedAt", { namespace: "accounting", vars: { date: toLocalDateStr(m.locked_at) } })}` : ""}
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
                  <Lock className="w-3.5 h-3.5 ms-1.5" /> {transitioningTo === m.id ? t("openingBalance.loading", { namespace: "accounting",  }) : t("openingBalance.lockButton", { namespace: "accounting",  })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancellingId === m.id}
                  onClick={() => onCancel(m.id)}
                  className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
                >
                  <XCircle className="w-3.5 h-3.5 ms-1.5" /> {cancellingId === m.id ? t("openingBalance.loading", { namespace: "accounting",  }) : t("openingBalance.cancelPostButton", { namespace: "accounting",  })}
                </Button>
              </>
            )}

            {m.status === "Locked" && (
              <span className="text-2xs font-bold text-slate-400">{t("openingBalance.lockedPermanently", { namespace: "accounting",  })}</span>
            )}

            {m.status === "Cancelled" && (
              <Button
                size="sm"
                variant="outline"
                disabled={transitioningTo === m.id}
                onClick={() => onReopen(m.id)}
                className="border-amber-200 text-amber-700 hover:bg-amber-50 font-bold"
                title={t("openingBalance.reopenButton", { namespace: "accounting",  })}
              >
                <RefreshCw className="w-3.5 h-3.5 ms-1.5" /> {transitioningTo === m.id ? t("openingBalance.loading", { namespace: "accounting",  }) : t("openingBalance.reopenButton", { namespace: "accounting",  })}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}