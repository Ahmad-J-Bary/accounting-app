import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@shared/ui/button";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import type { AccountDto, OpeningPositionControlDto } from "@erp/shared-types";
import { accountingService } from "@modules/accounting/api/accountingService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type OpeningLineInput,
  type NetProfitAllocationDto,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";
import { invalidateAccountingMutationQueries, queryClient } from "@shared/hooks/queryClient";
import { OpeningDraftCard } from "../components/OpeningDraftCard";
import { MigrationListCard } from "../components/MigrationListCard";
import { ReconciliationCard } from "../components/ReconciliationCard";
import { PositionControlCard } from "../components/PositionControlCard";
import { ProfitAllocationCard } from "../components/ProfitAllocationCard";
import type { AccountLine } from "../lib/migration-labels";
import { findAccount, isDebitNature, newLineKey } from "../lib/migration-labels";

interface ComputedProfit {
  net_profit: string;
  total_revenue: string;
  total_expenses: string;
  entry_count: number;
}

export default function OpeningBalanceMigration() {
  const [cutoverDate, setCutoverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<AccountLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [allocMigrationId, setAllocMigrationId] = useState<string>("");
  const [netProfit, setNetProfit] = useState("");
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

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: ["chart-of-accounts"],
    queryFn: () => accountingService.getChartOfAccounts(),
  });

  const {
    data: migrations = [],
    refetch: refetchMigrations,
    isLoading,
  } = useQuery<OpeningBalanceMigrationDto[]>({
    queryKey: ["opening-balance-migrations"],
    queryFn: () => openingBalanceService.listMigrations(),
  });

  const detailAccounts = useMemo(
    () => accounts.filter((a) => a.category === "Detail" && a.is_active),
    [accounts],
  );

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      { key: newLineKey(), account_id: "", amount: "", description: "" },
    ]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<AccountLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const { debitTotal, creditTotal, isValid } = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const acc = findAccount(accounts, l.account_id);
      const amount = parseFloat(l.amount) || 0;
      if (!acc || !amount) continue;
      if (isDebitNature(acc.account_type)) debit += amount;
      else credit += amount;
    }
    return { debitTotal: debit, creditTotal: credit, isValid: debit === credit };
  }, [lines, accounts]);

  const handleCreate = async () => {
    if (!cutoverDate) return toast.error("اختر تاريخ الترحيل");
    const validLines = lines.filter((l) => l.account_id && l.amount);
    if (validLines.length === 0) return toast.error("أضف بنداً واحداً على الأقل مع الحساب والمبلغ");
    setSaving(true);
    try {
      const payload = {
        cutover_date: new Date(cutoverDate).toISOString(),
        notes: notes || null,
        lines: validLines.map((l): OpeningLineInput => ({
          account_id: l.account_id,
          amount: l.amount,
          description: l.description || undefined,
        })),
      };
      await openingBalanceService.createMigration(payload);
      toast.success("تم حفظ مسودة الترحيل");
      setLines([]);
      setNotes("");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل الحفظ: " + e);
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    setPostingId(id);
    try {
      const res = await openingBalanceService.postMigration(id);
      toast.success(
        "تم ترحيل الرصيد الافتتاحي (متوازن)"
          + ` — مدين ${res.debit_total} / دائن ${res.credit_total}`
      );
      refetchMigrations();
      await invalidateAccountingMutationQueries(queryClient);
    } catch (e) {
      toast.error("فشل الترحيل: " + e);
    } finally {
      setPostingId(null);
    }
  };

  const handleValidate = async (id: string) => {
    setTransitioningTo(id);
    try {
      await openingBalanceService.validateMigration(id, "system");
      toast.success("تم التحقق من الترحيل");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل التحقق: " + e);
    } finally {
      setTransitioningTo(null);
    }
  };

  const handleApprove = async (id: string) => {
    setTransitioningTo(id);
    try {
      await openingBalanceService.approveMigration(id, "system");
      toast.success("تم اعتماد الترحيل");
      refetchMigrations();
    } catch (e) {
      toast.error("فشل الاعتماد: " + e);
    } finally {
      setTransitioningTo(null);
    }
  };

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
    if (!window.confirm("سيتم ترحيل قيد عكسي يُلغي الرصيد الافتتاحي ويميّز الترحيل كملغى. هل تريد المتابعة؟")) {
      return;
    }
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
    if (!window.confirm("ستُعاد فتح الترحيل الملغى كمسودة لتعديل بنوده وإعادة سير التحقق. هل تريد المتابعة؟")) {
      return;
    }
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

  const handleReconcile = async () => {
    if (!reconId) return toast.error("اختر ترحيلاً للتحقق");
    setReconLoading(true);
    setReconciliation(null);
    try {
      const res = await openingBalanceService.getReconciliation(reconId);
      setReconciliation(res);
    } catch (e) {
      toast.error("فشل تحميل التسوية: " + e);
    } finally {
      setReconLoading(false);
    }
  };

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

  return (
    <OperationalTableTemplate
      title="رصيد افتتاح الشركة (شركة قائمة)"
      toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchMigrations()} className="border-slate-200 hover:bg-slate-50 font-bold">
            <RefreshCw className="w-4 h-4 ml-2 text-slate-500" /> تحديث
          </Button>
        </div>
      }
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
          <OpeningDraftCard
            cutoverDate={cutoverDate}
            onCutoverDateChange={setCutoverDate}
            notes={notes}
            onNotesChange={setNotes}
            lines={lines}
            detailAccounts={detailAccounts}
            accounts={accounts}
            onAddLine={addLine}
            onRemoveLine={removeLine}
            onUpdateLine={updateLine}
            debitTotal={debitTotal}
            creditTotal={creditTotal}
            isValid={isValid}
            saving={saving}
            onSaveDraft={handleCreate}
          />

          <MigrationListCard
            migrations={migrations}
            isLoading={isLoading}
            postingId={postingId}
            cancellingId={cancellingId}
            transitioningTo={transitioningTo}
            onValidate={handleValidate}
            onApprove={handleApprove}
            onPost={handlePost}
            onLock={handleLock}
            onCancel={handleCancel}
            onReopen={handleReopen}
          />

          <ReconciliationCard
            candidates={reconcileCandidates}
            reconId={reconId}
            onReconIdChange={setReconId}
            loading={reconLoading}
            reconciliation={reconciliation}
            onCheck={handleReconcile}
          />

          <PositionControlCard
            candidates={reconcileCandidates}
            positionId={positionId}
            onPositionIdChange={setPositionId}
            loading={positionLoading}
            position={position}
            onShow={handleShowPosition}
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
    />
  );
}