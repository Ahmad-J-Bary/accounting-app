import { useMemo, useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AccountDto,
  CustomerDto,
  SupplierDto,
  PartnerDto,
  FixedAssetDto,
  MaterialDto,
  UpdateSettingsRequest,
} from "@erp/shared-types";
import type { WizardStepDef } from "@modules/opening-balance/components/WizardShell";
import { queryClient, QUERY_KEYS } from "@shared/hooks/queryClient";
import { accountingService } from "@modules/accounting/api/accountingService";
import { settingsService } from "@modules/core/api/settingsService";
import { partnerService } from "@modules/partners/api/partnerService";
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

export const START_MODE_NEW = "NewCompany";
export const START_MODE_EXISTING = "ExistingCompanyMigration";

// Opening Balance Equity control account (code 53) — the residual plug.
const OPENING_EQUITY_CODE = "53";

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

// A read-only line DERIVED from an owning module (customers / suppliers /
// fixed assets / partners). Shown with a "مشتق" badge; never manually edited.
export interface DerivedRow {
  key: string;
  entity_id: string;
  label: string;
  account_id: string;
  account_code: string;
  amount: string;
  kind: "AR" | "AP" | "FixedAsset" | "Equity";
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

const toNum = (v?: string): number => parseFloat(v || "0") || 0;

export function useOpeningBalanceWizard() {
  const [step, setStep] = useState(0);
  const [startMode, setStartMode] = useState<string>(START_MODE_NEW);
  const [cutoverDate, setCutoverDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sourceSystem, setSourceSystem] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [notes, setNotes] = useState("");
  const [residualClassification, setResidualClassification] = useState("");
  const [residualAccountId, setResidualAccountId] = useState("");
  const [assetsManual, setAssetsManual] = useState<WizLine[]>([]);
  const [liabilitiesManual, setLiabilitiesManual] = useState<WizLine[]>([]);
  const [equityManual, setEquityManual] = useState<WizLine[]>([]);
  const [migration, setMigration] = useState<OpeningBalanceMigrationDto | null>(null);
  const [reconciliation, setReconciliation] = useState<OpeningReconciliationDto | null>(null);
  const [busy, setBusy] = useState(false);

  const startModeLoaded = useRef(false);
  useEffect(() => {
    if (startModeLoaded.current) return;
    startModeLoaded.current = true;
    settingsService
      .getSettings()
      .then((s) => setStartMode(s.accounting_start_mode || START_MODE_NEW))
      .catch(() => {});
  }, []);

  const handleStartModeChange = async (mode: string) => {
    setStartMode(mode);
    try {
      const current = await settingsService.getSettings();
      await settingsService.updateSettings({
        company_name: current.company_name,
        company_name_en: current.company_name_en,
        tax_number: current.tax_number,
        commercial_register: current.commercial_register,
        address: current.address,
        phone: current.phone,
        email: current.email,
        currency: current.currency,
        currency_symbol: current.currency_symbol,
        tax_rate: Number(current.tax_rate),
        invoice_prefix: current.invoice_prefix,
        purchase_prefix: current.purchase_prefix,
        journal_prefix: current.journal_prefix,
        fiscal_year_start_month: current.fiscal_year_start_month,
        purchase_warehouse_id: current.purchase_warehouse_id,
        sales_warehouse_id: current.sales_warehouse_id,
        numeral_system: current.numeral_system,
        accounting_start_mode: mode,
      } as UpdateSettingsRequest);
      toast.success(
        mode === START_MODE_EXISTING
          ? "وضع: شركة قائمة (رصيد افتتاحي بدون خزينة)"
          : "وضع: شركة جديدة (رأس المال يضاف للصندوق)",
      );
    } catch (error) {
      toast.error("فشل تغيير الوضع: " + error);
    }
  };

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
  });

  const { data: customers = [] } = useQuery<CustomerDto[]>({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => customerService.list(),
  });
  const { data: suppliers = [] } = useQuery<SupplierDto[]>({
    queryKey: QUERY_KEYS.suppliers,
    queryFn: () => supplierService.list(),
  });
  const { data: partners = [] } = useQuery<PartnerDto[]>({
    queryKey: QUERY_KEYS.partners,
    queryFn: () => partnerService.listPartners(),
  });
  const { data: materials = [] } = useQuery<MaterialDto[]>({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.list(),
  });
  const { data: fixedAssets = [] } = useQuery<FixedAssetDto[]>({
    queryKey: QUERY_KEYS.fixedAssets,
    queryFn: () => fixedAssetService.list(),
  });

  const accountCode = useCallback(
    (id?: string | null) => (id ? accounts.find((a) => a.id === id)?.code || "" : ""),
    [accounts],
  );

  // ── Module-derived rows (read-only) ─────────────────────────────────────
  const derivedAr: DerivedRow[] = useMemo(
    () =>
      customers
        .filter((c) => c.account_id && toNum(c.opening_balance) !== 0)
        .map((c) => ({
          key: `ar_${c.id}`,
          entity_id: c.id,
          label: `${c.code || ""} — ${c.name}`,
          account_id: c.account_id as string,
          account_code: accountCode(c.account_id),
          amount: String(toNum(c.opening_balance)),
          kind: "AR" as const,
        })),
    [customers, accountCode],
  );

  const derivedAp: DerivedRow[] = useMemo(
    () =>
      suppliers
        .filter((s) => s.account_id && toNum(s.opening_balance) !== 0)
        .map((s) => ({
          key: `ap_${s.id}`,
          entity_id: s.id,
          label: `${s.code || ""} — ${s.name}`,
          account_id: s.account_id as string,
          account_code: accountCode(s.account_id),
          amount: String(toNum(s.opening_balance)),
          kind: "AP" as const,
        })),
    [suppliers, accountCode],
  );

  const derivedFa: DerivedRow[] = useMemo(
    () =>
      fixedAssets
        .filter((a) => a.status === "Active" && a.asset_account_id)
        .map((a) => ({
          key: `fa_${a.id}`,
          entity_id: a.id,
          label: `${a.code || ""} — ${a.name}`,
          account_id: a.asset_account_id,
          account_code: accountCode(a.asset_account_id),
          amount: String(toNum(a.purchase_cost?.amount) - toNum(a.accumulated_depreciation?.amount)),
          kind: "FixedAsset" as const,
        }))
        .filter((r) => toNum(r.amount) !== 0),
    [fixedAssets, accountCode],
  );

  const partnerEquity: DerivedRow[] = useMemo(
    () =>
      partners
        .filter((p) => p.linked_account_id && toNum(p.amount_local) !== 0)
        .map((p) => ({
          key: `eq_${p.id}`,
          entity_id: p.id,
          label: `${p.code || ""} — ${p.name}`,
          account_id: p.linked_account_id as string,
          account_code: accountCode(p.linked_account_id),
          amount: String(toNum(p.amount_local)),
          kind: "Equity" as const,
        })),
    [partners, accountCode],
  );

  // ── Inventory: handled by the Phase-3 opening-invoice flow (read-only) ──
  const inventorySummary = useMemo(() => {
    const rows = materials
      .map((m) => ({
        name: m.name,
        available: toNum(m.total_available),
        value: toNum(m.total_available) * toNum(m.average_cost_base),
      }))
      .filter((r) => r.available !== 0);
    return {
      rows,
      total: rows.reduce((s, r) => s + r.value, 0),
      count: rows.length,
    };
  }, [materials]);

  // ── Totals (never asked from the user) ──────────────────────────────────
  const sumLines = (list: Array<{ amount?: string }>) =>
    list.reduce((s, l) => s + toNum(l.amount), 0);

  const manualAssetsTotal = sumLines(assetsManual);
  const manualLiabilitiesTotal = sumLines(liabilitiesManual);
  const manualEquityTotal = sumLines(equityManual);
  const arTotal = sumLines(derivedAr);
  const apTotal = sumLines(derivedAp);
  const faTotal = sumLines(derivedFa);
  const equityTotal = sumLines(partnerEquity);

  const debit = manualAssetsTotal + arTotal + faTotal;
  const credit = manualLiabilitiesTotal + manualEquityTotal + apTotal + equityTotal;
  const residual = debit - credit;

  const obeAccountId = useMemo(
    () => accounts.find((a) => a.code === OPENING_EQUITY_CODE)?.id || "",
    [accounts],
  );

  // The residual plug on 53 is only added for a credit residual (net assets >
  // explicit equity) that the accountant classified; a debit residual must be
  // closed by an explicit manual line instead.
  const hasResidualPlug = useMemo(
    () => residual > 0 && !!residualClassification && !!residualAccountId && !!obeAccountId,
    [residual, residualClassification, residualAccountId, obeAccountId],
  );

  const totals = useMemo(() => {
    const plugAmount = hasResidualPlug ? residual : 0;
    const debitTotal = debit;
    const liabilities = manualLiabilitiesTotal + apTotal;
    const equity = manualEquityTotal + equityTotal;
    const creditTotal = credit + plugAmount;
    return {
      debit: debitTotal,
      liabilities,
      equity,
      credit: creditTotal,
      balanced: Math.abs(debitTotal - creditTotal) < 0.01,
      total: debitTotal + creditTotal,
      residual,
      plugAmount: hasResidualPlug ? plugAmount : 0,
    };
  }, [debit, credit, residual, hasResidualPlug, manualLiabilitiesTotal, apTotal, manualEquityTotal, equityTotal]);

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

  const collectLines = useCallback((): OpeningLineInput[] => {
    const lines: OpeningLineInput[] = [];
    for (const r of [...derivedAr, ...derivedAp, ...derivedFa, ...partnerEquity]) {
      lines.push({ account_id: r.account_id, amount: r.amount, description: undefined });
    }
    for (const l of [...assetsManual, ...liabilitiesManual, ...equityManual]) {
      if (l.account_id && l.amount) {
        lines.push({ account_id: l.account_id, amount: l.amount, description: "بند يدوي" });
      }
    }
    if (hasResidualPlug) {
      lines.push({ account_id: obeAccountId, amount: String(totals.plugAmount), description: "بند تسوية الرصيد المتبقي" });
    }
    return lines;
  }, [derivedAr, derivedAp, derivedFa, partnerEquity, assetsManual, liabilitiesManual, equityManual, hasResidualPlug, obeAccountId, totals]);

  const collectItems = useCallback((): OpeningItemInput[] => {
    const items: OpeningItemInput[] = [];
    for (const r of derivedAr) items.push({ kind: KIND_AR, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    for (const r of derivedAp) items.push({ kind: KIND_AP, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    for (const r of derivedFa) items.push({ kind: KIND_FIXED_ASSET, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    return items;
  }, [derivedAr, derivedAp, derivedFa]);

  const invalidateMigrations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.openingBalanceMigrations });
  }, []);

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return startMode === START_MODE_EXISTING && !!cutoverDate;
      case 1:
        return true;
      case 2:
        return debit > 0;
      case 3:
        return true;
      case 4:
        return totals.balanced && totals.total > 0;
      case 5:
        return !!migration && !!reconciliation;
      case 6:
        return !!migration && migration.status === "Validated";
      case 7:
        return !!migration && migration.status === "Approved";
      case 8:
        return !!migration && migration.status === "Posted";
      case 9:
        return !!migration && migration.status === "Locked";
      default:
        return true;
    }
  }, [step, startMode, cutoverDate, debit, totals, migration, reconciliation]);

  const committed = step >= 5;
  const canPrev = step > 0 && !committed && !busy;

  const nextLabel = useMemo(() => {
    switch (step) {
      case 5: return "حفظ وفحص التسوية";
      case 6: return "تأكيد التحقق";
      case 7: return "تأكيد الترحيل";
      case 8: return "تأكيد القفل";
      default: return undefined;
    }
  }, [step]);

  const runStep = async () => {
    try {
      if (step === 5) {
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
        await openingBalanceService.saveMigrationItems({
          migration_id: created.id,
          items: collectItems(),
        });
        const recon = await openingBalanceService.getReconciliation(created.id);
        setMigration(created);
        setReconciliation(recon);
        invalidateMigrations();
        toast.success("تم حفظ المسودة وفحص التسوية");
        setBusy(false);
        return true;
      }

      if (!migration) return false;

      if (step === 6) {
        setBusy(true);
        const updated = await openingBalanceService.validateMigration(migration.id, "system");
        setMigration(updated);
        invalidateMigrations();
        setBusy(false);
        return true;
      }
      if (step === 7) {
        setBusy(true);
        const res = await openingBalanceService.postMigration(migration.id);
        setMigration(res.migration);
        invalidateMigrations();
        // Move the classified 53 plug out into the chosen account so the OBE
        // control zeroes and the lock gate can be satisfied.
        if (residualClassification && residualAccountId && totals.plugAmount !== 0) {
          await openingBalanceService.applyResidual(migration.id);
        }
        toast.success("تم الترحيل (متوازن)");
        setBusy(false);
        return true;
      }
      if (step === 8) {
        setBusy(true);
        const updated = await openingBalanceService.lockMigration(migration.id);
        setMigration(updated);
        invalidateMigrations();
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
    if (step === 5 || (step >= 6 && step <= 8)) {
      const ok = await runStep();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return {
    step,
    setStep,
    startMode,
    handleStartModeChange,
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
    assetsManual,
    setAssetsManual,
    liabilitiesManual,
    setLiabilitiesManual,
    equityManual,
    setEquityManual,
    derivedAr,
    derivedAp,
    derivedFa,
    partnerEquity,
    inventorySummary,
    migration,
    reconciliation,
    busy,
    accounts,
    detailAccounts,
    updateLine,
    collectLines,
    totals,
    obeAccountId,
    canNext,
    canPrev,
    committed,
    nextLabel,
    handleNext,
    customers,
    suppliers,
    materials,
    fixedAssets,
  };
}

export const STEPS: WizardStepDef[] = [
  { id: "company-start", label: "بدء الحسابات" },
  { id: "partners", label: "الشركاء ورأس المال" },
  { id: "assets", label: "الأصول القائمة" },
  { id: "liabilities", label: "الخصوم" },
  { id: "reconciliation", label: "التسوية" },
  { id: "review", label: "المراجعة والحفظ" },
  { id: "validate", label: "التحقق" },
  { id: "post", label: "الترحيل" },
  { id: "lock", label: "القفل" },
  { id: "done", label: "اكتمال" },
];