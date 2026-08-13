import { useMemo, useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccountDto, UpdateSettingsRequest, FiscalPeriodDto } from "@erp/shared-types";
import type { WizardStepDef } from "@modules/opening-balance/components/WizardShell";
import { queryClient, QUERY_KEYS } from "@shared/hooks/queryClient";
import { toLocalDatePart } from "@shared/lib/format";
import { accountingService } from "@modules/accounting/api/accountingService";
import { settingsService } from "@modules/core/api/settingsService";
import { fiscalPeriodService, periodWindowFromDateInput } from "@modules/accounting/api/fiscalPeriodService";
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
import {
  KIND_AR,
  KIND_AP,
  KIND_FIXED_ASSET,
  START_MODE_NEW,
  START_MODE_EXISTING,
  OPENING_EQUITY_CODE,
  type WizLine,
  type DerivedRow,
} from "@modules/opening-balance/lib/wizard-types";
import {
  deriveAr,
  deriveAp,
  deriveFa,
  derivePartnerEquity,
  inventorySummary as inventorySummaryFn,
  sumLines,
} from "@modules/opening-balance/lib/derive-rows";

export function useOpeningBalanceWizard() {
  const [step, setStep] = useState(0);
  const [startMode, setStartMode] = useState<string>(START_MODE_NEW);
  const [cutoverDate, setCutoverDate] = useState(() => toLocalDatePart(new Date()));
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
  // First active financial period (core accounting, independent of the opening
  // transition): defined inline for NewCompany (Step 1) and in a dedicated step
  // after opening Lock for Existing companies.
  const [firstPeriodStart, setFirstPeriodStart] = useState(() => toLocalDatePart(new Date()));
  const [firstPeriodEnd, setFirstPeriodEnd] = useState(() => `${new Date().getFullYear()}-12-31`);
  const [firstPeriod, setFirstPeriod] = useState<FiscalPeriodDto | null>(null);

  const startModeLoaded = useRef(false);
  useEffect(() => {
    if (startModeLoaded.current) return;
    startModeLoaded.current = true;
    settingsService
      .getSettings()
      .then((s) => setStartMode(s.accounting_start_mode || START_MODE_NEW))
      .catch(() => {});
  }, []);

  // A NewCompany only needs its first financial period (no opening migration);
  // an Existing company runs the full 11-step transition incl. the first period.
  const steps = startMode === START_MODE_NEW ? STEPS_NEW : STEPS_EXISTING;

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

  // NewCompany never touches these modules, so only fetch them when the
  // Existing-company migration path is active (avoids 6 wasted queries on mount).
  const existing = startMode === START_MODE_EXISTING;

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
    enabled: existing,
  });
  const { data: customers = [] } = useQuery({
    queryKey: QUERY_KEYS.customers,
    queryFn: () => customerService.list(),
    enabled: existing,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: QUERY_KEYS.suppliers,
    queryFn: () => supplierService.list(),
    enabled: existing,
  });
  const { data: partners = [] } = useQuery({
    queryKey: QUERY_KEYS.partners,
    queryFn: () => partnerService.listPartners(),
    enabled: existing,
  });
  const { data: materials = [] } = useQuery({
    queryKey: QUERY_KEYS.materials,
    queryFn: () => materialService.list(),
    enabled: existing,
  });
  const { data: fixedAssets = [] } = useQuery({
    queryKey: QUERY_KEYS.fixedAssets,
    queryFn: () => fixedAssetService.list(),
    enabled: existing,
  });

  // ── Module-derived rows (read-only, pure derivation) ────────────────────
  const derivedAr: DerivedRow[] = useMemo(() => deriveAr(customers, accounts), [customers, accounts]);
  const derivedAp: DerivedRow[] = useMemo(() => deriveAp(suppliers, accounts), [suppliers, accounts]);
  const derivedFa: DerivedRow[] = useMemo(() => deriveFa(fixedAssets, accounts), [fixedAssets, accounts]);
  const partnerEquity: DerivedRow[] = useMemo(() => derivePartnerEquity(partners, accounts), [partners, accounts]);

  // ── Inventory: handled by the Phase-3 opening-invoice flow (read-only) ──
  const inventorySummary = useMemo(() => inventorySummaryFn(materials), [materials]);

  // ── Totals (never asked from the user) ──────────────────────────────────
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

  // Creates (idempotently) the first active financial period from the current
  // inputs. Re-running with an unchanged window is a no-op so navigating back
  // and forth does not duplicate the period.
  const createFirstPeriod = useCallback(async (): Promise<boolean> => {
    if (!firstPeriodStart || !firstPeriodEnd || new Date(firstPeriodStart) >= new Date(firstPeriodEnd)) {
      toast.error("تاريخ بداية الفترة المالية يجب أن يسبق تاريخ النهاية");
      return false;
    }
    const window = periodWindowFromDateInput(firstPeriodStart, firstPeriodEnd);
    if (firstPeriod && firstPeriod.start_date === window.start_date && firstPeriod.end_date === window.end_date) {
      return true;
    }
    try {
      const created = await fiscalPeriodService.createFiscalPeriod(window);
      setFirstPeriod(created);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.fiscalPeriods });
      toast.success(
        startMode === START_MODE_NEW
          ? "تم إنشاء أول فترة مالية — يمكنك بدء العمل"
          : "تم إنشاء أول فترة تشغيلية بعد إقفال الرصيد الافتتاحي",
      );
      return true;
    } catch (e) {
      toast.error("فشل إنشاء الفترة المالية: " + e);
      return false;
    }
  }, [firstPeriodStart, firstPeriodEnd, firstPeriod, startMode]);

  const canNext = useMemo(() => {
    const datesValid = !!firstPeriodStart && !!firstPeriodEnd && firstPeriodStart < firstPeriodEnd;
    if (startMode === START_MODE_NEW) {
      switch (step) {
        case 0:
          return datesValid;
        case 1:
          return true;
        default:
          return true;
      }
    }
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
        return datesValid;
      case 10:
        return true;
      default:
        return true;
    }
  }, [step, startMode, cutoverDate, debit, totals, migration, reconciliation, firstPeriodStart, firstPeriodEnd]);

  const committed = step >= 5;
  const canPrev = step > 0 && !committed && !busy;

  const nextLabel = useMemo(() => {
    if (startMode === START_MODE_NEW) {
      return step === 0 ? "إنشاء الفترة الأولى والبدء" : undefined;
    }
    switch (step) {
      case 5: return "حفظ وفحص التسوية";
      case 6: return "تأكيد التحقق";
      case 7: return "تأكيد الترحيل";
      case 8: return "تأكيد القفل";
      case 9: return "إنشاء أول فترة تشغيلية";
      default: return undefined;
    }
  }, [step, startMode]);

  const runStep = async () => {
    try {
      // NewCompany: Step 1 creates the first financial period and nothing else.
      if (startMode === START_MODE_NEW && step === 0) {
        setBusy(true);
        const ok = await createFirstPeriod();
        setBusy(false);
        return ok;
      }

      // Existing: Step 9 creates the first operational period after opening Lock.
      if (step === 9) {
        setBusy(true);
        const ok = await createFirstPeriod();
        setBusy(false);
        return ok;
      }

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
    const runOnNext = startMode === START_MODE_NEW ? step === 0 : step === 5 || (step >= 6 && step <= 9);
    if (runOnNext) {
      const ok = await runStep();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
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
    steps,
    firstPeriodStart,
    setFirstPeriodStart,
    firstPeriodEnd,
    setFirstPeriodEnd,
    firstPeriod,
    createFirstPeriod,
    customers,
    suppliers,
    materials,
    fixedAssets,
  };
}

// ExistingCompany: full 11-step guided transition incl. first operational period.
export const STEPS_EXISTING: WizardStepDef[] = [
  { id: "company-start", label: "بدء الحسابات" },
  { id: "partners", label: "الشركاء ورأس المال" },
  { id: "assets", label: "الأصول القائمة" },
  { id: "liabilities", label: "الخصوم" },
  { id: "reconciliation", label: "التسوية" },
  { id: "review", label: "المراجعة والحفظ" },
  { id: "validate", label: "التحقق" },
  { id: "post", label: "الترحيل" },
  { id: "lock", label: "القفل" },
  { id: "first-period", label: "أول فترة تشغيلية" },
  { id: "done", label: "اكتمال" },
];

// NewCompany: the wizard only creates the first financial period, then finishes.
export const STEPS_NEW: WizardStepDef[] = [
  { id: "company-start", label: "بدء الحسابات" },
  { id: "done", label: "اكتمال" },
];

export const STEPS = STEPS_EXISTING;