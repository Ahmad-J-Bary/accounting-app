import { useMemo, useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AccountDto, UpdateSettingsRequest, FiscalPeriodDto, CustomerDto, SupplierDto, FixedAssetDto } from "@erp/shared-types";
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
import { warehouseService } from "@modules/inventory/api/warehouseService";
import { fixedAssetService } from "@modules/fixed-assets/api/fixedAssetService";
import { invoiceService } from "@modules/invoicing/api/invoiceService";
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
  KIND_INVENTORY,
  START_MODE_NEW,
  START_MODE_EXISTING,
  OPENING_EQUITY_CODE,
  newLine,
  toNum,
  type WizLine,
  type DerivedRow,
} from "@modules/opening-balance/lib/wizard-types";
import {
  deriveAr,
  deriveAp,
  deriveFa,
  derivePartnerEquity,
  deriveInventoryRows,
  sumLines,
  type InventoryEntry,
} from "@modules/opening-balance/lib/derive-rows";
import { defaultAccountFor } from "@modules/opening-balance/lib/auto-accounts";

// Step indices for the ExistingCompany 15-step layout.
const STEP_REVIEW = 9;
const STEP_VALIDATE = 10;
const STEP_POST = 11;
const STEP_LOCK = 12;
const STEP_FIRST_PERIOD = 13;

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
  // Amount-only sections (auto-default accounts, overridable manually).
  const [cashBanks, setCashBanks] = useState<WizLine[]>([]);
  const [loans, setLoans] = useState<WizLine[]>([]);
  // Per-asset opening net-book-value overrides that only affect the migration
  // (the fixed-asset module stays authoritative for cost/depreciation).
  const [faOverrides, setFaOverrides] = useState<Record<string, string>>({});
  // Inventory entries: editable qty + cost per material, plus the account the
  // migration line is booked on.
  const [inventoryInputs, setInventoryInputs] = useState<Record<string, { qty: string; cost: string }>>({});
  const [inventoryAccountId, setInventoryAccountId] = useState("");
  const [inventoryPosted, setInventoryPosted] = useState(false);
  const [inventoryPosting, setInventoryPosting] = useState(false);
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
  // an Existing company runs the full 15-step transition incl. the first period.
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
  // Existing-company migration path is active (avoids wasted queries on mount).
  const existing = startMode === START_MODE_EXISTING;

  const { data: accounts = [] } = useQuery<AccountDto[]>({
    queryKey: QUERY_KEYS.chartOfAccounts,
    queryFn: () => accountingService.getChartOfAccounts(),
    enabled: existing,
  });
  const { data: appSettings } = useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: () => settingsService.getSettings(),
    enabled: existing,
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses,
    queryFn: () => warehouseService.list(),
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

  // ── Module-derived rows (read-only derivation) ───────────────────────────
  const derivedAr: DerivedRow[] = useMemo(() => deriveAr(customers, accounts), [customers, accounts]);
  const derivedAp: DerivedRow[] = useMemo(() => deriveAp(suppliers, accounts), [suppliers, accounts]);
  const derivedFa: DerivedRow[] = useMemo(() => deriveFa(fixedAssets, accounts), [fixedAssets, accounts]);
  const partnerEquity: DerivedRow[] = useMemo(() => derivePartnerEquity(partners, accounts), [partners, accounts]);

  // Fixed assets may carry a wizard-side opening NBV override (migration only).
  const faRows: DerivedRow[] = useMemo(() => {
    return derivedFa.map((r) => {
      const over = faOverrides[r.entity_id];
      return over !== undefined && over !== "" ? { ...r, amount: over } : r;
    });
  }, [derivedFa, faOverrides]);

  // ── Inventory (in-wizard, editable qty/cost, single posting) ─────────────
  const inventoryEntries: InventoryEntry[] = useMemo(() => deriveInventoryRows(materials), [materials]);
  const effectiveInventory = useMemo(() => {
    return inventoryEntries.map((r) => {
      const over = inventoryInputs[r.material_id];
      const qty = over?.qty ?? r.qty;
      const cost = over?.cost ?? r.cost;
      return { ...r, qty, cost, value: toNum(qty) * toNum(cost) };
    });
  }, [inventoryEntries, inventoryInputs]);
  const inventoryTotal = useMemo(
    () => effectiveInventory.reduce((s, r) => s + r.value, 0),
    [effectiveInventory],
  );

  // ── Auto-default accounts (amount-only / inventory booking) ──────────────
  const defaultCashAccount = useMemo(() => defaultAccountFor(accounts, "cash"), [accounts]);
  const defaultBankAccount = useMemo(() => defaultAccountFor(accounts, "bank"), [accounts]);
  const defaultLoanAccount = useMemo(() => defaultAccountFor(accounts, "loan"), [accounts]);
  const defaultInventoryAccount = useMemo(() => defaultAccountFor(accounts, "inventory"), [accounts]);
  const effectiveInventoryAccountId = inventoryAccountId || defaultInventoryAccount;

  // ── Totals (never asked from the user) ───────────────────────────────────
  const manualAssetsTotal = sumLines(assetsManual);
  const manualLiabilitiesTotal = sumLines(liabilitiesManual);
  const manualEquityTotal = sumLines(equityManual);
  const cashBanksTotal = sumLines(cashBanks);
  const loansTotal = sumLines(loans);
  const arTotal = sumLines(derivedAr);
  const apTotal = sumLines(derivedAp);
  const faTotal = sumLines(faRows);
  const equityTotal = sumLines(partnerEquity);

  const debit = manualAssetsTotal + cashBanksTotal + inventoryTotal + arTotal + faTotal;
  const credit = manualLiabilitiesTotal + loansTotal + apTotal + equityTotal + manualEquityTotal;
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
    const liabilities = manualLiabilitiesTotal + loansTotal + apTotal;
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
  }, [
    debit,
    credit,
    residual,
    hasResidualPlug,
    manualLiabilitiesTotal,
    loansTotal,
    apTotal,
    manualEquityTotal,
    equityTotal,
  ]);

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

  const addCashRow = useCallback(() => {
    setCashBanks((prev) => [
      ...prev,
      { key: newLine().key, account_id: defaultCashAccount || "", amount: "", kind: "cash" },
    ]);
  }, [defaultCashAccount]);
  const addBankRow = useCallback(() => {
    setCashBanks((prev) => [
      ...prev,
      { key: newLine().key, account_id: defaultBankAccount || "", amount: "", kind: "bank" },
    ]);
  }, [defaultBankAccount]);
  const addLoanRow = useCallback(() => {
    setLoans((prev) => [...prev, { key: newLine().key, account_id: defaultLoanAccount || "", amount: "", kind: "loan" }]);
  }, [defaultLoanAccount]);

  // ── Inline module saves (window-safe: no journals while the window is open) ─
  const saveCustomerOpening = useCallback(
    async (row: DerivedRow, value: string): Promise<boolean> => {
      const c = customers.find((x) => x.id === row.entity_id);
      if (!c) return false;
      try {
        const updated = await customerService.update({
          id: c.id,
          code: c.code,
          name: c.name,
          phone: c.phone,
          address: c.address,
          account_id: c.account_id,
          debit: c.debit,
          credit: c.credit,
          opening_balance: value || "0",
          currency: c.currency,
          notes: c.notes,
          is_active: c.is_active,
        });
        queryClient.setQueryData<CustomerDto[]>(QUERY_KEYS.customers, (old) =>
          old?.map((x) => (x.id === c.id ? updated : x)) ?? [],
        );
        toast.success("تم تحديث رصيد العميل");
        return true;
      } catch (e) {
        toast.error("فشل تحديث رصيد العميل: " + e);
        return false;
      }
    },
    [customers],
  );

  const saveSupplierOpening = useCallback(
    async (row: DerivedRow, value: string): Promise<boolean> => {
      const s = suppliers.find((x) => x.id === row.entity_id);
      if (!s) return false;
      try {
        const updated = await supplierService.update({
          id: s.id,
          code: s.code,
          name: s.name,
          phone: s.phone,
          address: s.address,
          account_id: s.account_id,
          debit: s.debit,
          credit: s.credit,
          opening_balance: value || "0",
          currency: s.currency,
          notes: s.notes,
          is_active: s.is_active,
        });
        queryClient.setQueryData<SupplierDto[]>(QUERY_KEYS.suppliers, (old) =>
          old?.map((x) => (x.id === s.id ? updated : x)) ?? [],
        );
        toast.success("تم تحديث رصيد المورد");
        return true;
      } catch (e) {
        toast.error("فشل تحديث رصيد المورد: " + e);
        return false;
      }
    },
    [suppliers],
  );

  const savePartnerCapital = useCallback(
    async (row: DerivedRow, value: string): Promise<boolean> => {
      const p = partners.find((x) => x.id === row.entity_id);
      if (!p) return false;
      try {
        await partnerService.updatePartner({
          id: p.id,
          code: p.code,
          name: p.name,
          currency: p.currency,
          exchangeRate: p.exchange_rate,
          amount: value || "0",
          isAmountInOriginal: p.is_amount_in_original,
          sharingType: p.profit_sharing_type,
          manualRatio: p.profit_sharing_ratio,
        });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.partners });
        toast.success("تم تحديث رأس مال الشريك");
        return true;
      } catch (e) {
        toast.error("فشل تحديث رأس مال الشريك: " + e);
        return false;
      }
    },
    [partners],
  );

  // Fixed assets: the module stays authoritative (cost/depreciation), so the
  // inline edit only adjusts the migration's opening valuation per asset.
  const saveFixedAssetOverride = useCallback(async (row: DerivedRow, value: string): Promise<boolean> => {
    setFaOverrides((prev) => ({ ...prev, [row.entity_id]: value || "" }));
    toast.success("تم تحديث قيمة الأصل الافتتاحية في المعالج");
    return true;
  }, []);

  const setInventoryRow = useCallback((materialId: string, patch: { qty?: string; cost?: string }) => {
    setInventoryInputs((prev) => {
      const cur = prev[materialId] || { qty: "", cost: "" };
      return { ...prev, [materialId]: { ...cur, ...patch } };
    });
  }, []);

  const defaultWarehouseId =
    appSettings?.purchase_warehouse_id || warehouses.find((w) => w.is_default)?.id || "";

  // Builds and posts the OpeningBalance invoice from the wizard's inventory
  // rows so real stock lots are seeded; the MaterialOpeningBalance journal is
  // deferred while the opening window is open (single ledger posting R1).
  const handlePostInventoryInvoice = useCallback(async (): Promise<boolean> => {
    const rows = effectiveInventory.filter((r) => toNum(r.qty) > 0 && toNum(r.cost) > 0);
    if (rows.length === 0) {
      toast.error("أدخل كميات وتكاليف للمواد قبل ترحيل رصيد البضاعة");
      return false;
    }
    if (inventoryPosted) return true;
    if (!appSettings?.currency) {
      toast.error("حدّد العملة الأساسية من الإعدادات أولاً");
      return false;
    }
    setInventoryPosting(true);
    try {
      const number = await invoiceService.getNextInvoiceNumber("OpeningBalance");
      const created = await invoiceService.createInvoice({
        invoice_number: number,
        invoice_type: "OpeningBalance",
        lines: rows.map((r) => ({
          id: "",
          material_id: r.material_id,
          material_name: r.name,
          quantity: r.qty,
          unit_id: r.default_unit_id ?? undefined,
          warehouse_id: r.default_warehouse_id || defaultWarehouseId || undefined,
          unit_price: r.cost,
          notes: "",
        })),
        tax_amount: "0",
        discount_amount: "0",
        extra_costs: "0",
        payment_method: "Deferred",
        amount_paid: "0",
        issued_at: new Date().toISOString(),
        currency_code: appSettings.currency,
        exchange_rate: "1",
        notes: "مواد أول المدة- رصيد افتتاحي للمواد",
      });
      await invoiceService.postInvoice(created.id);
      setInventoryPosted(true);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.materials });
      toast.success("تم ترحيل رصيد البضاعة إلى المخزون");
      return true;
    } catch (e) {
      toast.error("فشل ترحيل رصيد البضاعة: " + e);
      return false;
    } finally {
      setInventoryPosting(false);
    }
  }, [effectiveInventory, inventoryPosted, appSettings, defaultWarehouseId]);

  const collectLines = useCallback((): OpeningLineInput[] => {
    const lines: OpeningLineInput[] = [];
    for (const r of [...derivedAr, ...derivedAp, ...faRows, ...partnerEquity]) {
      lines.push({ account_id: r.account_id, amount: r.amount, description: undefined });
    }
    for (const l of cashBanks) {
      if (l.account_id && l.amount) {
        lines.push({ account_id: l.account_id, amount: l.amount, description: "نقد وبنوك — رصيد افتتاحي" });
      }
    }
    for (const l of loans) {
      if (l.account_id && l.amount) {
        lines.push({ account_id: l.account_id, amount: l.amount, description: "قروض — رصيد افتتاحي" });
      }
    }
    for (const l of [...assetsManual, ...liabilitiesManual, ...equityManual]) {
      if (l.account_id && l.amount) {
        lines.push({ account_id: l.account_id, amount: l.amount, description: "بند يدوي" });
      }
    }
    if (inventoryTotal !== 0 && effectiveInventoryAccountId) {
      lines.push({
        account_id: effectiveInventoryAccountId,
        amount: String(inventoryTotal),
        description: "مخزون أول المدة",
      });
    }
    if (hasResidualPlug) {
      lines.push({ account_id: obeAccountId, amount: String(totals.plugAmount), description: "بند تسوية الرصيد المتبقي" });
    }
    return lines;
  }, [
    derivedAr,
    derivedAp,
    faRows,
    partnerEquity,
    cashBanks,
    loans,
    assetsManual,
    liabilitiesManual,
    equityManual,
    inventoryTotal,
    effectiveInventoryAccountId,
    hasResidualPlug,
    obeAccountId,
    totals,
  ]);

  const collectItems = useCallback((): OpeningItemInput[] => {
    const items: OpeningItemInput[] = [];
    for (const r of derivedAr) items.push({ kind: KIND_AR, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    for (const r of derivedAp) items.push({ kind: KIND_AP, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    for (const r of faRows) items.push({ kind: KIND_FIXED_ASSET, entity_id: r.entity_id, reference: r.label, amount: r.amount, qty: "0" });
    for (const r of effectiveInventory) {
      if (r.value !== 0) {
        items.push({ kind: KIND_INVENTORY, entity_id: r.material_id, reference: r.name, amount: String(r.value), qty: String(toNum(r.qty)) });
      }
    }
    return items;
  }, [derivedAr, derivedAp, faRows, effectiveInventory]);

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
        default:
          return true;
      }
    }
    switch (step) {
      case 0:
        return startMode === START_MODE_EXISTING && !!cutoverDate;
      case STEP_REVIEW:
        return totals.balanced && totals.total > 0;
      case STEP_VALIDATE:
        return !!migration && migration.status === "Validated";
      case STEP_POST:
        return !!migration && migration.status === "Validated";
      case STEP_LOCK:
        return !!migration && migration.status === "Posted";
      case STEP_FIRST_PERIOD:
        return datesValid;
      default:
        return true;
    }
  }, [step, startMode, cutoverDate, totals, migration, firstPeriodStart, firstPeriodEnd]);

  const committed = step >= STEP_REVIEW;
  const canPrev = step > 0 && !committed && !busy;

  const nextLabel = useMemo(() => {
    if (startMode === START_MODE_NEW) {
      return step === 0 ? "إنشاء الفترة الأولى والبدء" : undefined;
    }
    switch (step) {
      case STEP_REVIEW: return "حفظ وفحص التسوية";
      case STEP_VALIDATE: return "تأكيد التحقق";
      case STEP_POST: return "تأكيد الترحيل";
      case STEP_LOCK: return "تأكيد القفل";
      case STEP_FIRST_PERIOD: return "إنشاء أول فترة تشغيلية";
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

      // Existing: Step 14 creates the first operational period after opening Lock.
      if (step === STEP_FIRST_PERIOD) {
        setBusy(true);
        const ok = await createFirstPeriod();
        setBusy(false);
        return ok;
      }

      if (step === STEP_REVIEW) {
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

      if (step === STEP_VALIDATE) {
        setBusy(true);
        const updated = await openingBalanceService.validateMigration(migration.id, "system");
        setMigration(updated);
        invalidateMigrations();
        setBusy(false);
        return true;
      }
      if (step === STEP_POST) {
        setBusy(true);
        // The backend only posts an Approved migration. Approval is folded into
        // the "تأكيد الترحيل" step so the wizard never dead-ends at Post.
        const approved = await openingBalanceService.approveMigration(migration.id, "system");
        setMigration(approved);
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
      if (step === STEP_LOCK) {
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
    const runOnNext = startMode === START_MODE_NEW ? step === 0 : step === STEP_REVIEW || (step >= STEP_VALIDATE && step <= STEP_FIRST_PERIOD);
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
    cashBanks,
    setCashBanks,
    loans,
    setLoans,
    addCashRow,
    addBankRow,
    addLoanRow,
    defaultCashAccount,
    defaultBankAccount,
    defaultLoanAccount,
    derivedAr,
    derivedAp,
    faRows,
    faOverrides,
    setFaOverrides,
    saveFixedAssetOverride,
    partnerEquity,
    saveCustomerOpening,
    saveSupplierOpening,
    savePartnerCapital,
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
    // Inventory section
    effectiveInventory,
    inventoryTotal,
    setInventoryRow,
    inventoryAccountId,
    setInventoryAccountId,
    effectiveInventoryAccountId,
    defaultInventoryAccount,
    inventoryPosted,
    inventoryPosting,
    handlePostInventoryInvoice,
    defaultWarehouseId,
  };
}

// ExistingCompany: full 15-step guided transition incl. the first period.
export const STEPS_EXISTING: WizardStepDef[] = [
  { id: "company-start", label: "بدء الحسابات" },
  { id: "cash-banks", label: "النقد والبنوك" },
  { id: "customers", label: "الذمم المدينة" },
  { id: "inventory", label: "المخزون" },
  { id: "fixed-assets", label: "الأصول الثابتة" },
  { id: "other-assets", label: "أصول أخرى" },
  { id: "suppliers", label: "الذمم الدائنة" },
  { id: "loans", label: "القروض" },
  { id: "partners-equity", label: "الشركاء وحقوق الملكية" },
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