import { useMemo, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccountDto } from "@erp/shared-types";
import type { WizardStepDef } from "@modules/opening-balance/components/WizardShell";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { accountingService } from "@modules/accounting/api/accountingService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type OpeningLineInput,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";

export interface WizLine {
  key: string;
  account_id: string;
  amount: string;
}

export interface DetailRow {
  key: string;
  reference: string;
  amount: string;
  qty: string;
}

export function newLine(): WizLine {
  return { key: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, account_id: "", amount: "" };
}

export function newDetail(reference: string, amount: string, qty: string): DetailRow {
  return { key: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, reference, amount, qty };
}

export function useOpeningBalanceWizard() {
  const [step, setStep] = useState(0);
  const [cutoverDate, setCutoverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sourceSystem, setSourceSystem] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [notes, setNotes] = useState("");
  const [residualClassification, setResidualClassification] = useState("");
  const [residualAccountId, setResidualAccountId] = useState("");
  const [assets, setAssets] = useState<WizLine[]>([]);
  const [liabilities, setLiabilities] = useState<WizLine[]>([]);
  const [equity, setEquity] = useState<WizLine[]>([]);
  const [arRows, setArRows] = useState<DetailRow[]>([]);
  const [apRows, setApRows] = useState<DetailRow[]>([]);
  const [invRows, setInvRows] = useState<DetailRow[]>([]);
  const [faRows, setFaRows] = useState<DetailRow[]>([]);
  const [migration, setMigration] = useState<OpeningBalanceMigrationDto | null>(null);
  const [reconciliation, setReconciliation] = useState<OpeningReconciliationDto | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
  });

  const detailAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.category === "Detail" &&
          a.is_active &&
          a.account_type !== "Revenue" &&
          a.account_type !== "Expenses",
      ),
    [accounts],
  );

  const updateLine = (setter: Dispatch<SetStateAction<WizLine[]>>, key: string, patch: Partial<WizLine>) => {
    setter((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const updateDetail = (setter: Dispatch<SetStateAction<DetailRow[]>>, key: string, patch: Partial<DetailRow>) => {
    setter((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const collectLines = useCallback(
    (): OpeningLineInput[] =>
      [...assets, ...liabilities, ...equity]
        .filter((l) => l.account_id && l.amount)
        .map((l) => ({
          account_id: l.account_id,
          amount: l.amount,
          description: undefined,
        })),
    [assets, liabilities, equity],
  );

  const totals = useMemo(() => {
    const debit = assets.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const credit =
      liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) +
      equity.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    return { debit, credit, balanced: debit === credit, total: debit + credit };
  }, [assets, liabilities, equity]);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return !!cutoverDate;
      case 1:
        return assets.some((l) => l.account_id && parseFloat(l.amount) > 0);
      case 8:
        return totals.balanced && totals.total > 0;
      case 9:
        return !!migration && !!reconciliation;
      case 10:
        return !!migration && migration.status === "Validated";
      case 11:
        return !!migration && migration.status === "Approved";
      case 12:
        return !!migration && migration.status === "Posted";
      case 13:
        return !!migration && migration.status === "Locked";
      default:
        return true;
    }
  }, [step, cutoverDate, assets, totals, migration, reconciliation]);

  const committed = step >= 9;
  const canPrev = step > 0 && !committed && !busy;

  const nextLabel = useMemo(() => {
    switch (step) {
      case 9: return "حفظ وفحص التسوية";
      case 10: return "تأكيد التحقق";
      case 11: return "تأكيد الاعتماد";
      case 12: return "تأكيد الترحيل";
      case 13: return "تأكيد القفل";
      default: return undefined;
    }
  }, [step]);

  const runStep = async () => {
    try {
      if (step === 9) {
        setBusy(true);
        const created = await openingBalanceService.createMigration({
          cutover_date: new Date(cutoverDate).toISOString(),
          notes: notes || null,
          lines: collectLines(),
          source_system: sourceSystem || null,
          source_reference: sourceReference || null,
        });
        if (residualClassification && residualAccountId) {
          await openingBalanceService.setResidualClassification({
            migration_id: created.id,
            classification: residualClassification,
            residual_account_id: residualAccountId,
          });
        }
        const details = {
          customer_items: arRows.map((r) => ({
            customer_id: r.reference,
            reference: r.reference,
            original_amount: r.amount,
            outstanding_amount: r.amount,
            due_date: null,
            currency_code: null,
            exchange_rate: null,
          })),
          supplier_items: apRows.map((r) => ({
            supplier_id: r.reference,
            reference: r.reference,
            original_amount: r.amount,
            outstanding_amount: r.amount,
            due_date: null,
            currency_code: null,
            exchange_rate: null,
          })),
          inventory_items: invRows.map((r) => ({
            material_id: r.reference,
            warehouse_id: null,
            quantity: r.qty || "1",
            unit_cost: r.amount,
            total_cost: String((parseFloat(r.qty || "1") || 1) * (parseFloat(r.amount) || 0)),
            batch: null,
            currency_code: null,
          })),
          fixed_assets: faRows.map((r) => ({
            asset_id: r.reference,
            acquisition_cost: r.amount,
            accumulated_depreciation: "0",
            net_book_value: r.amount,
            acquisition_date: null,
            depreciation_method: null,
            useful_life: null,
          })),
        };
        await openingBalanceService.saveDetails({ migration_id: created.id, ...details });
        const recon = await openingBalanceService.getReconciliation(created.id);
        setMigration(created);
        setReconciliation(recon);
        toast.success("تم حفظ المسودة وفحص التسوية");
        setBusy(false);
        return true;
      }

      if (!migration) return false;

      if (step === 10) {
        setBusy(true);
        const updated = await openingBalanceService.validateMigration(migration.id, "system");
        setMigration(updated);
        setBusy(false);
        return true;
      }
      if (step === 11) {
        setBusy(true);
        const updated = await openingBalanceService.approveMigration(migration.id, "system");
        setMigration(updated);
        setBusy(false);
        return true;
      }
      if (step === 12) {
        setBusy(true);
        const res = await openingBalanceService.postMigration(migration.id);
        setMigration(res.migration);
        // Auto-apply the residual reclassification (Dr 53 / Cr residual account)
        // so the OBE control (53) zeroes and the lock gate can be satisfied.
        if (residualClassification && residualAccountId) {
          await openingBalanceService.applyResidual(migration.id);
        }
        toast.success("تم الترحيل (متوازن)");
        setBusy(false);
        return true;
      }
      if (step === 13) {
        setBusy(true);
        const updated = await openingBalanceService.lockMigration(migration.id);
        setMigration(updated);
        setBusy(false);
        return true;
      }
      return true;
    } catch (e) {
      setBusy(false);
      toast.error("فشلت العملية: " + e);
      return false;
    }
  };

  const handleNext = async () => {
    if (step === 9 || (step >= 10 && step <= 13)) {
      const ok = await runStep();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return {
    step,
    setStep,
    cutoverDate,
    setCutoverDate,
    sourceSystem,
    setSourceSystem,
    sourceReference,
    setSourceReference,
    notes,
    setNotes,
    residualClassification,
    setResidualClassification,
    residualAccountId,
    setResidualAccountId,
    assets,
    setAssets,
    liabilities,
    setLiabilities,
    equity,
    setEquity,
    arRows,
    setArRows,
    apRows,
    setApRows,
    invRows,
    setInvRows,
    faRows,
    setFaRows,
    migration,
    reconciliation,
    busy,
    accounts,
    detailAccounts,
    updateLine,
    updateDetail,
    collectLines,
    totals,
    canNext,
    canPrev,
    committed,
    nextLabel,
    handleNext,
  };
}

export const STEPS: WizardStepDef[] = [
  { id: "info", label: "بيانات الترحيل" },
  { id: "assets", label: "الأصول" },
  { id: "liabilities", label: "الخصوم" },
  { id: "equity", label: "حقوق الملكية" },
  { id: "ar", label: "الذمم المدينة" },
  { id: "ap", label: "الذمم الدائنة" },
  { id: "inv", label: "المخزون" },
  { id: "fa", label: "الأصول الثابتة" },
  { id: "equation", label: "معادلة الميزانية" },
  { id: "commit", label: "الحفظ والتسوية" },
  { id: "validate", label: "التحقق" },
  { id: "approve", label: "الاعتماد" },
  { id: "post", label: "الترحيل" },
  { id: "lock", label: "القفل" },
  { id: "done", label: "اكتمال" },
];