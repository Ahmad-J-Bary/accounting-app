import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import type { OpeningPositionControlDto } from "@erp/shared-types";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type NetProfitAllocationDto,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";
import { invalidateAccountingMutationQueries, queryClient, QUERY_KEYS } from "@shared/hooks/queryClient";
import { MigrationListCard } from "../components/MigrationListCard";
import { ReconciliationCard } from "../components/ReconciliationCard";
import { PositionControlCard } from "../components/PositionControlCard";
import { ProfitAllocationCard } from "../components/ProfitAllocationCard";
import { GuidedTransitionWizard } from "../components/GuidedTransitionWizard";

interface ComputedProfit {
  net_profit: string;
  total_revenue: string;
  total_expenses: string;
  entry_count: number;
}

export default function OpeningBalanceMigration() {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [allocMigrationId, setAllocMigrationId] = useState<string>("");
  const [netProfit, setNetProfit] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "reopen"; id: string } | null>(null);
  const [allocResult, setAllocResult] = useState<NetProfitAllocationDto | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [computingProfit, setComputingProfit] = useState(false);
  const [computedProfit, setComputedProfit] = useState<ComputedProfit | null>(null);
  const [reconId, setReconId] = useState<string>("");
  const [reconciliation, setReconciliation] = useState<OpeningReconciliationDto | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [positionId, setPositionId] = useState<string>("");
  const [position, setPosition] = useState<OpeningPositionControlDto | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);

  const {
    data: migrations = [],
    refetch: refetchMigrations,
    isLoading,
  } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: QUERY_KEYS.openingBalanceMigrations,
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const handleLock = async (id: string) => {
    setTransitioningTo(id);
    try {
      await openingBalanceService.lockMigration(id);
      toast.success("تم قفل الترحيل");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل القفل: " + e);
    } finally {
      setTransitioningTo(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await openingBalanceService.cancelMigration(id);
      toast.success("تم إلغاء ترحيل الرصيد الافتتاحي وتسجيل القيد العكسي");
      refetchMigrations();
      await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
      toast.error("فشل الإلغاء: " + e);
    } finally {
      setCancellingId(null);
    }
  };

  const handleReopen = async (id: string) => {
    setTransitioningTo(id);
    try {
      await openingBalanceService.reopenMigration(id);
      toast.success("تمت إعادة فتح الترحيل كمسودة");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل إعادة الفتح: " + e);
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

  const postedMigrations = useMemo(
    () => migrations.filter((m) => m.status === "Posted"),
    [migrations],
  );

  const handleAllocate = async () => {
    if (!allocMigrationId) return toast.error("اختر ترحيلاً مرحّلاً");
    if (!netProfit || isNaN(parseFloat(netProfit))) return toast.error("أدخل صافي الربح");
    setAllocating(true);
    setAllocResult(null);
    try {
      const res = await openingBalanceService.allocateNetProfit({
        migration_id: allocMigrationId,
        net_profit: netProfit,
      });
      setAllocResult(res);
      toast.success("تم توزيع أرباح الترحيل على الشركاء");
      refetchMigrations();
      await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
      toast.error("فشل توزيع الأرباح: " + e);
    } finally {
      setAllocating(false);
    }
  };

  const handleComputeProfit = async () => {
    if (!allocMigrationId) return toast.error("اختر ترحيلاً مرحّلاً");
    setComputingProfit(true);
    setComputedProfit(null);
    try {
      const res = await openingBalanceService.computeNetProfit({
        migration_id: allocMigrationId,
      });
      setComputedProfit(res);
      setNetProfit(String(res.net_profit));
      toast.success("تم احتساب صافي الربح من قيدات اليومية حتى تاريخ القطع");
    } catch (e) {
      toast.error("فشل احتساب صافي الربح: " + e);
    } finally {
      setComputingProfit(false);
    }
  };

  const reconcileCandidates = useMemo(
    () => migrations.filter((m) => m.status !== "Cancelled"),
    [migrations],
  );

  const handleShowPosition = async () => {
    if (!positionId) return toast.error("اختر ترحيلاً لعرض المركز");
    setPositionLoading(true);
    setPosition(null);
    try {
      const res = await openingBalanceService.getOpeningPositionControl(positionId);
      setPosition(res);
    } catch (e) {
      toast.error("فشل تحميل المركز الافتتاحي: " + e);
    } finally {
      setPositionLoading(false);
    }
  };

  const autoLoadedId = useRef<string | null>(null);
  const autoReconId = useRef<string | null>(null);

  // Hero summary: preselect the most recent migration (by cutover date) when none
  // is selected or the selected one no longer exists.
  useEffect(() => {
    if (reconcileCandidates.length === 0) return;
    const latest = [...reconcileCandidates].sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0];
    if (!positionId || !reconcileCandidates.some((m) => m.id === positionId)) {
      setPositionId(latest.id);
    }
  }, [reconcileCandidates, positionId]);

  // Auto-load the opening position summary so the page reads as a state snapshot
  // ("ما هي حالة الشركة الافتتاحية الآن؟") without a manual select+click.
  useEffect(() => {
    if (!positionId || autoLoadedId.current === positionId) return;
    autoLoadedId.current = positionId;
    setPositionLoading(true);
    openingBalanceService
      .getOpeningPositionControl(positionId)
      .then((res) => setPosition(res))
      .catch((e) => toast.error("فشل تحميل المركز الافتتاحي: " + e))
      .finally(() => setPositionLoading(false));
  }, [positionId]);

  // Auto-load the reconciliation snapshot when a migration is picked, mirroring
  // the position card behavior — one fewer click to check the balances.
  useEffect(() => {
    if (!reconId || autoReconId.current === reconId) return;
    autoReconId.current = reconId;
    setReconLoading(true);
    setReconciliation(null);
    openingBalanceService
      .getReconciliation(reconId)
      .then((res) => setReconciliation(res))
      .catch((e) => toast.error("فشل تحميل التسوية: " + e))
      .finally(() => setReconLoading(false));
  }, [reconId]);

  return (
    <OperationalTableTemplate
      title="رصيد افتتاح الشركة"
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchMigrations()} className="border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
          <PositionControlCard
            candidates={reconcileCandidates}
            positionId={positionId}
            onPositionIdChange={setPositionId}
            loading={positionLoading}
            position={position}
            onShow={handleShowPosition}
          />

          <GuidedTransitionWizard />

          <MigrationListCard
            migrations={migrations}
            isLoading={isLoading}
            cancellingId={cancellingId}
            transitioningTo={transitioningTo}
            onLock={handleLock}
            onCancel={(id) => setConfirmAction({ type: "cancel", id })}
            onReopen={(id) => setConfirmAction({ type: "reopen", id })}
          />

          <ReconciliationCard
            candidates={reconcileCandidates}
            reconId={reconId}
            onReconIdChange={setReconId}
            loading={reconLoading}
            reconciliation={reconciliation}
          />

          <ProfitAllocationCard
            postedMigrations={postedMigrations}
            allocMigrationId={allocMigrationId}
            onAllocMigrationIdChange={setAllocMigrationId}
            netProfit={netProfit}
            onNetProfitChange={setNetProfit}
            allocating={allocating}
            computingProfit={computingProfit}
            allocResult={allocResult}
            computedProfit={computedProfit}
            onCompute={handleComputeProfit}
            onAllocate={handleAllocate}
          />
        </div>
      }
    >
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === "cancel" ? "إلغاء ترحيل الرصيد الافتتاحي" : "إعادة فتح الترحيل"}
        description={
          confirmAction?.type === "cancel"
            ? "سيتم ترحيل قيد عكسي يُلغي الرصيد الافتتاحي ويميّز الترحيل كملغى. هل تريد المتابعة؟"
            : "ستُعاد فتح الترحيل الملغى كمسودة لتعديل بنوده وإعادة سير التحقق. هل تريد المتابعة؟"
        }
        confirmLabel={confirmAction?.type === "cancel" ? "إلغاء الترحيل" : "إعادة الفتح"}
        destructive={confirmAction?.type === "cancel"}
        onConfirm={handleConfirmed}
      />
    </OperationalTableTemplate>
  );
}