import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Badge } from "@shared/ui/badge";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import { settingsService } from "@modules/core/api/settingsService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
} from "@modules/accounting/api/openingBalanceService";
import { invalidateAccountingMutationQueries, queryClient, QUERY_KEYS } from "@shared/hooks/queryClient";
import {
  initStateLabel,
  companyCapabilities,
  companyTypeOf,
  deriveCompanyInitState,
} from "../lib/company-lifecycle";
import { GuidedTransitionWizard } from "../components/GuidedTransitionWizard";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { ResponsiveActionItem } from "@widgets/page-header/ResponsiveActions";

export default function OpeningBalanceMigration() {
  const { t } = useLocalization();
  const [_cancellingId, setCancellingId] = useState<string | null>(null);
  const [_transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "reopen"; id: string } | null>(null);

  const {
    data: migrations = [],
    refetch: refetchMigrations,
  } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: QUERY_KEYS.openingBalanceMigrations,
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const { data: settings } = useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: () => settingsService.getSettings(),
  });

  const { data: fiscalPeriods = [] } = useQuery({
    queryKey: QUERY_KEYS.fiscalPeriods,
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  const initState = deriveCompanyInitState({ settings, migrations, periods: fiscalPeriods });

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await openingBalanceService.cancelMigration(id);
      toast.success(t("openingBalance.cancelMigrationSuccess", { namespace: "accounting",  }));
      refetchMigrations();
      await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
      toast.error(t("openingBalance.cancelMigrationFailed", { namespace: "accounting", vars: { error: String(e) } }));
    } finally {
      setCancellingId(null);
    }
  };

  const handleReopen = async (id: string) => {
    setTransitioningTo(id);
    try {
      await openingBalanceService.reopenMigration(id);
      toast.success(t("openingBalance.reopenMigrationSuccess", { namespace: "accounting",  }));
      refetchMigrations();
    } catch (e) {
      toast.error(t("openingBalance.reopenMigrationFailed", { namespace: "accounting", vars: { error: String(e) } }));
    } finally {
      setTransitioningTo(null);
    }
  };

  const handleConfirmed = async () => {
    if (!confirmAction) return;
    const { id } = confirmAction;
    setConfirmAction(null);
    if (confirmAction.type === "cancel") await handleCancel(id);
    else await handleReopen(id);
  };

  if (settings && companyCapabilities(companyTypeOf(settings), initState).isNewCompany) {
    return <Navigate to="/dashboard" replace />;
  }

  const toolbarActions: ResponsiveActionItem[] = [
    {
      id: "refresh-migrations",
      label: t("openingBalance.refreshButton", { namespace: "accounting" }),
      icon: RefreshCw,
      priority: "secondary",
      variant: "outline",
      onClick: () => {
        void refetchMigrations();
      },
    },
  ];

  return (
    <ErrorBoundary>
    <OperationalTableTemplate
      title={t("openingBalance.migrationPageTitle.closed", { namespace: "accounting",  })}
      badge={<Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-50">{initStateLabel(initState, t)}</Badge>}
      toolbarActions={toolbarActions}
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
          <GuidedTransitionWizard />
        </div>
      }
    >
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === "cancel" ? t("openingBalance.confirmCancelTitle", { namespace: "accounting",  }) : t("openingBalance.confirmReopenTitle", { namespace: "accounting",  })}
        description={
          confirmAction?.type === "cancel"
            ? t("openingBalance.confirmCancelDesc", { namespace: "accounting",  })
            : t("openingBalance.confirmReopenDesc", { namespace: "accounting",  })
        }
        confirmLabel={confirmAction?.type === "cancel" ? t("openingBalance.confirmCancelLabel", { namespace: "accounting",  }) : t("openingBalance.confirmReopenLabel", { namespace: "accounting",  })}
        destructive={confirmAction?.type === "cancel"}
        onConfirm={handleConfirmed}
      />
    </OperationalTableTemplate>
    </ErrorBoundary>
  );
}
