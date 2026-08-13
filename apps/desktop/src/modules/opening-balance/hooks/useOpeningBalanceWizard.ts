import { useMemo, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccountDto } from "@erp/shared-types";
import type { WizardStepDef } from "@modules/opening-balance/components/WizardShell";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { accountingService } from "@modules/accounting/api/accountingService";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { materialService } from "@modules/inventory/api/materialService";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type OpeningLineInput,
  type OpeningItemInput,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";

export const KIND_AR = "AR";
export const KIND_AP = "AP";
export const KIND_INVENTORY = "Inventory";
export const KIND_FIXED_ASSET = "FixedAsset";

export interface WizLine {
  key: string;
  account_id: string;
  amount: string;
}

// A sub-ledger row links a REAL entity (customer/supplier/material/asset) to
// the opening amount it carries inside the migration. `reference` is the
// source-system reference (invoice/order number), never a free-text id.
export interface DetailRow {
  key: string;
  entity_id: string;
  reference: string;
  amount: string;
  qty: string;
}

export function newLine(): WizLine {
  return { key: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, account_id: "", amount: "" };
}

export function newDetail(): DetailRow {
  return { key: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, entity_id: "", reference: "", amount: "", qty: "" };
}

export interface EntityOption {
  value: string;
  label: string;
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

  const { data: customers = [] } = useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => customerService.list(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: QUERY_KEYS.suppliers,
    queryFn: () => supplierService.list(),
  });
  const { data: materials = [] } = useQuery({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.list(),
  });
  const { data: fixedAssets = [] } = useQuery({
    queryKey: QUERY_KEYS.fixedAssets,
    queryFn: () => fixedAssetService.list(),
  });

  const customerOptions: EntityOption[] = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.code || ""} — ${c.name}` })),
    [customers],
  );
  const supplierOptions: EntityOption[] = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: `${s.code || ""} — ${s.name}` })),
    [suppliers],
  );
  const materialOptions: EntityOption[] = useMemo(
    () => materials.map((m) => ({ value: m.id, label: `${m.code || m.barcode || ""} — ${m.name}` })),
    [materials],
  );
  const fixedAssetOptions: EntityOption[] = useMemo(
    () => fixedAssets.map((a) => ({ value: a.id, label: `${a.code || ""} — ${a.name}` })),
    [fixedAssets],
  );

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
        const item = (kind: string, rows: DetailRow[]): OpeningItemInput[] =>
          rows
            .filter((r) => r.entity_id && r.amount)
            .map((r) => ({
              kind,
              entity_id: r.entity_id,
              reference: r.reference || null,
              amount: r.amount,
              qty: r.qty || "0",
            }));
        const items = [
          ...item(KIND_AR, arRows),
          ...item(KIND_AP, apRows),
          ...item(KIND_INVENTORY, invRows),
          ...item(KIND_FIXED_ASSET, faRows),
        ];
        await openingBalanceService.saveMigrationItems({ migration_id: created.id, items });
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
    customerOptions,
    supplierOptions,
    materialOptions,
    fixedAssetOptions,
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