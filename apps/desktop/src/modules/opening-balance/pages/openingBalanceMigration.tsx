import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { RefreshCw, ArrowLeft, Play } from "lucide-react";
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { Badge } from "@shared/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shared/ui/tabs";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import { toLocalDateStr } from "@shared/lib/format";
import { settingsService } from "@modules/core/api/settingsService";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import type { OpeningPositionControlDto } from "@erp/shared-types";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type NetProfitAllocationDto,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";
import { invalidateAccountingMutationQueries, queryClient, QUERY_KEYS } from "@shared/hooks/queryClient";
import {
  INIT_STATE_LABELS,
  companyCapabilities,
  companyTypeOf,
  deriveCompanyInitState,
} from "../lib/company-lifecycle";
import { MigrationListCard } from "../components/MigrationListCard";
import { ReconciliationCard } from "../components/ReconciliationCard";
import { PositionControlCard } from "../components/PositionControlCard";
import { ProfitAllocationCard } from "../components/ProfitAllocationCard";
import { GuidedTransitionWizard } from "../components/GuidedTransitionWizard";
import { OpeningDashboard } from "../components/OpeningDashboard";
import { deriveOpeningSnapshot } from "../lib/derive-opening-snapshot";

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
  const [tab, setTab] = useState("overview");

  const {
    data: migrations = [],
    refetch: refetchMigrations,
    isLoading,
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

  const { data: openingDraft = null } = useQuery<string | null>({
    queryKey: QUERY_KEYS.openingDraft,
    queryFn: () => openingBalanceService.getOpeningDraft(),
  });

  // Derived company initialization state (from company type + migration status +
  // existence of a first fiscal period) shown as a header badge.
  const initState = deriveCompanyInitState({ settings, migrations, periods: fiscalPeriods });

  // Overview dashboard snapshot over the most recent (non-cancelled) migration.
  const latestMigration = useMemo(
    () =>
      [...migrations]
        .filter((m) => m.status !== "Cancelled")
        .sort((a, b) => b.cutover_date.localeCompare(a.cutover_date))[0] ?? null,
    [migrations],
  );
  const snapshot = useMemo(
    () => deriveOpeningSnapshot({ status: latestMigration?.status ?? null, position }),
    [latestMigration, position],
  );

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

  // The opening workflow is only reachable while it is still open (Phase 5):
  // a NEW company never has one, and once an EXISTING company's migration is
  // Locked (OPENING_LOCKED … ACTIVE) the workflow closes for good — the pages
  // are hidden from navigation and direct URLs redirect away. Settings still
  // loading = no redirect.
  if (settings && !companyCapabilities(companyTypeOf(settings), initState).canAccessOpeningWorkflow) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <OperationalTableTemplate
      title="رصيد افتتاح الشركة"
      badge={<Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-50">{INIT_STATE_LABELS[initState]}</Badge>}
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchMigrations()} className="border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
          <Tabs value={tab} onValueChange={setTab} dir="rtl">
            <TabsList className="bg-white border border-slate-200 p-1 h-11 rounded-xl shadow-sm mb-1">
              <TabsTrigger value="overview" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">نظرة عامة</TabsTrigger>
              <TabsTrigger value="wizard" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">المعالج</TabsTrigger>
              <TabsTrigger value="list" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">قائمة الترحيلات</TabsTrigger>
              <TabsTrigger value="position" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">المركز والتسوية</TabsTrigger>
              <TabsTrigger value="allocation" className="rounded-lg px-5 gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all font-bold">توزيع الأرباح</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-2 space-y-4">
              {latestMigration === null ? (
                <WelcomeCard onStart={() => setTab("wizard")} />
              ) : (
                <OpeningDashboard
                  snapshot={snapshot}
                  loading={positionLoading}
                  onOpenSection={() => setTab("wizard")}
                  footer={
                    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        تاريخ القطع: <span className="font-bold text-slate-700">{toLocalDateStr(latestMigration.cutover_date)}</span>
                        {latestMigration.notes ? ` — ${latestMigration.notes}` : ""}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setTab("wizard")} className="border-slate-200 font-bold">
                        <ArrowLeft className="w-4 h-4 ml-1.5" /> متابعة في المعالج
                      </Button>
                    </div>
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="wizard" className="mt-2 space-y-4">
              <GuidedTransitionWizard />
            </TabsContent>

            <TabsContent value="list" className="mt-2 space-y-4">
              <MigrationListCard
                migrations={migrations}
                isLoading={isLoading}
                cancellingId={cancellingId}
                transitioningTo={transitioningTo}
                draft={openingDraft}
                onResume={() => setTab("wizard")}
                onLock={handleLock}
                onCancel={(id) => setConfirmAction({ type: "cancel", id })}
                onReopen={(id) => setConfirmAction({ type: "reopen", id })}
              />
            </TabsContent>

            <TabsContent value="position" className="mt-2 space-y-4">
              <PositionControlCard
                candidates={reconcileCandidates}
                positionId={positionId}
                onPositionIdChange={setPositionId}
                loading={positionLoading}
                position={position}
                onShow={handleShowPosition}
              />

              <ReconciliationCard
                candidates={reconcileCandidates}
                reconId={reconId}
                onReconIdChange={setReconId}
                loading={reconLoading}
                reconciliation={reconciliation}
              />
            </TabsContent>

            <TabsContent value="allocation" className="mt-2 space-y-4">
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
            </TabsContent>
          </Tabs>
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

// NOT_STARTED welcome — explains what the opening setup does (cutover snapshot
// of the legacy position, no automatic cash), and routes into the wizard.
function WelcomeCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <p className="text-sm font-black text-slate-800">إعداد رصيد افتتاح الشركة القائمة</p>
      <p className="text-xs text-slate-500 leading-relaxed">
        بما أنك تبدأ استخدام التطبيق الآن، سيُدخل المعالج الموجه الحالة المالية الفعلية للشركة في تاريخ
        بدء الاستخدام («تاريخ القطع»). تُرصد الأرصدة قسماً بقسم — نقد وبنوك، عملاء، مخزون، أصول ثابتة، موردون،
        قروض، شركاء — ثم تُسوّى مع دليل الحسابات وتُرحَّل وتُقفل، ويُفتتح بعدها أول فترة تشغيلية تُقيد عليها
        الحركات اليومية.
      </p>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
        <p className="text-xs font-bold text-amber-700">لن تُنشأ حركة نقدية تلقائية</p>
        <p className="text-xs text-amber-600">
          رأس المال والذمم والبنود القديمة أرصدة تاريخية تُرصد للشركة القائمة — ليست مساهمات نقدية جديدة،
          ولا تُسجَّل أي حركات يومية قبل إقفال الرصيد الافتتاحي.
        </p>
      </div>
      <Button size="sm" onClick={onStart} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
        <Play className="w-4 h-4 ml-1.5" /> ابدأ المعالج
      </Button>
    </div>
  );
}