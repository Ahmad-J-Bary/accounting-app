import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { toast } from "sonner";
import type { AccountDto } from "@erp/shared-types";
import { accountingService } from "@modules/accounting/api/accountingService";
import {
  openingBalanceService,
  type OpeningBalanceMigrationDto,
  type OpeningLineInput,
  type OpeningReconciliationDto,
} from "@modules/accounting/api/openingBalanceService";
import { WizardShell, type WizardStepDef } from "@modules/opening-balance/components/WizardShell";

interface WizLine {
  key: string;
  account_id: string;
  amount: string;
}

interface DetailRow {
  key: string;
  reference: string;
  amount: string;
  qty: string;
}

const TYPE_LABEL: Record<string, string> = {
  Assets: "أصل",
  Liabilities: "التزام",
  Equity: "حقوق ملكية",
  Revenue: "إيراد",
  Expenses: "مصروف",
};

function isDebitNature(accountType: string): boolean {
  return accountType === "Assets" || accountType === "Expenses";
}

function newLine(): WizLine {
  return { key: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, account_id: "", amount: "" };
}

function newDetail(reference: string, amount: string, qty: string): DetailRow {
  return { key: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, reference, amount, qty };
}

const STEPS: WizardStepDef[] = [
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

export default function OpeningBalanceWizard() {
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
    queryKey: ["chart-of-accounts"],
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

  const updateLine = (setter: React.Dispatch<React.SetStateAction<WizLine[]>>, key: string, patch: Partial<WizLine>) => {
    setter((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const updateDetail = (setter: React.Dispatch<React.SetStateAction<DetailRow[]>>, key: string, patch: Partial<DetailRow>) => {
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
    const sum = (rows: WizLine[]) =>
      rows.reduce((s, l) => {
        const acc = accounts.find((a) => a.id === l.account_id);
        if (!acc || !l.amount) return s;
        return isDebitNature(acc.account_type) ? s + parseFloat(l.amount) : s;
      }, 0);
    const debit = assets.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const credit =
      liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) +
      equity.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    void sum;
    return { debit, credit, balanced: debit === credit, total: debit + credit };
  }, [assets, liabilities, equity, accounts]);

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

  const renderLineEditor = (
    rows: WizLine[],
    setter: React.Dispatch<React.SetStateAction<WizLine[]>>,
    placeholder: string,
  ) => (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود بعد</p>
      )}
      {rows.map((l) => {
        const acc = accounts.find((a) => a.id === l.account_id);
        return (
          <div key={l.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
            <Input
              list="wiz-accounts"
              value={l.account_id}
              onChange={(e) => updateLine(setter, l.key, { account_id: e.target.value })}
              placeholder={placeholder}
              className="h-9 flex-1"
            />
            <div className="w-[170px] shrink-0 text-xs text-slate-600">
              {acc ? `${acc.name_ar} (${TYPE_LABEL[acc.account_type]})` : "—"}
            </div>
            <Input
              value={l.amount}
              onChange={(e) => updateLine(setter, l.key, { amount: e.target.value })}
              placeholder="0.00"
              type="number"
              className="h-9 w-[110px] shrink-0 text-left tabular-nums"
            />
            <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== l.key))} className="text-red-500 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newLine()])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
      <datalist id="wiz-accounts">
        {detailAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name_ar} ({TYPE_LABEL[a.account_type]})
          </option>
        ))}
      </datalist>
    </div>
  );

  const renderDetailEditor = (
    rows: DetailRow[],
    setter: React.Dispatch<React.SetStateAction<DetailRow[]>>,
    referenceLabel: string,
    withQty: boolean,
  ) => (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-slate-400 py-2 text-center">لا توجد بنود (اختياري)</p>
      )}
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
          <Input
            value={r.reference}
            onChange={(e) => updateDetail(setter, r.key, { reference: e.target.value })}
            placeholder={referenceLabel}
            className="h-9 flex-1"
          />
          {withQty && (
            <Input
              value={r.qty}
              onChange={(e) => updateDetail(setter, r.key, { qty: e.target.value })}
              placeholder="الكمية"
              type="number"
              className="h-9 w-[90px] shrink-0 text-left tabular-nums"
            />
          )}
          <Input
            value={r.amount}
            onChange={(e) => updateDetail(setter, r.key, { amount: e.target.value })}
            placeholder="المبلغ"
            type="number"
            className="h-9 w-[110px] shrink-0 text-left tabular-nums"
          />
          <Button size="sm" variant="ghost" onClick={() => setter((prev) => prev.filter((x) => x.key !== r.key))} className="text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setter((prev) => [...prev, newDetail("", "", "")])} className="border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
        <Plus className="w-3.5 h-3.5 ml-1.5" /> إضافة بند
      </Button>
    </div>
  );

  const reconLabel: Record<string, string> = {
    AR: "الذمم المدينة",
    AP: "الذمم الدائنة",
    Inventory: "المخزون",
    FixedAssets: "الأصول الثابتة",
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              أدخل بيانات الترحيل: النظام السابق الذي صدرت منه الأرصدة وتاريخ القطع.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">تاريخ القطع (Cutover)</label>
                <Input type="date" value={cutoverDate} onChange={(e) => setCutoverDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">النظام السابق (Source System)</label>
                <Input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} placeholder="مثال: نظام محاسبة قديم" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">المرجع (Source Reference)</label>
                <Input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="رقم الميزانية / المرجع" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">ملاحظات</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" className="h-9" />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">أرصدة الأصول من الميزانية القديمة (طبيعة مدين).</p>
            {renderLineEditor(assets, setAssets, "ابحث واختر حساب أصل...")}
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">أرصدة الخصوم من الميزانية القديمة (طبيعة دائن).</p>
            {renderLineEditor(liabilities, setLiabilities, "ابحث واختر حساب التزام...")}
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">حقوق الملكية — رؤوس أموال الشركاء والأرباح المبقاة (طبيعة دائن).</p>
            {renderLineEditor(equity, setEquity, "ابحث واختر حساب حقوق ملكية...")}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">
                تصنيف الفرق المتبقي (رصيد غير مسجل من النظام السابق):
              </p>
              <p className="text-[11px] text-amber-600">
                يُحسب الرصيد المتبقي تلقائياً بعد إدخال الخطوط، وطبيعته قرار محاسب صريح — لا تُسوّى قسراً.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={residualClassification}
                  onChange={(e) => setResidualClassification(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">التصنيف (اختياري)</option>
                  <option value="RetainedEarnings">أرباح مبقاة</option>
                  <option value="OpeningEquityAdjustment">تعديل حقوق ملكية افتتاحي</option>
                  <option value="PriorPeriodAdjustment">تعديل فترة سابقة</option>
                  <option value="OtherEquity">حقوق ملكية أخرى</option>
                  <option value="UnresolvedDifference">فرق غير محلول</option>
                </select>
                <Input
                  list="wiz-equity-accounts"
                  value={residualAccountId}
                  onChange={(e) => setResidualAccountId(e.target.value)}
                  placeholder="حساب حامل الفرق (مثال: 52)"
                  className="h-9"
                />
                <datalist id="wiz-equity-accounts">
                  {detailAccounts.filter((a) => a.account_type === "Equity").map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name_ar}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        );
      case 4:
        return renderDetailEditor(arRows, setArRows, "مرجع/اسم العميل", false);
      case 5:
        return renderDetailEditor(apRows, setApRows, "مرجع/اسم المورد", false);
      case 6:
        return renderDetailEditor(invRows, setInvRows, "معرف المادة", true);
      case 7:
        return renderDetailEditor(faRows, setFaRows, "معرف الأصل الثابت", false);
      case 8:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              معادلة الميزانية: الأصول (A) = الخصوم (L) + حقوق الملكية (E). يجب أن يتوازن الجانبان قبل المتابعة.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-slate-200">
                <CardHeader className="py-2">
                  <CardTitle className="text-xs font-bold text-blue-700">الأصول (مدين)</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-black tabular-nums text-blue-700">
                  {totals.debit.toFixed(2)}
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardHeader className="py-2">
                  <CardTitle className="text-xs font-bold text-emerald-700">الخصوم (دائن)</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-black tabular-nums text-emerald-700">
                  {liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardHeader className="py-2">
                  <CardTitle className="text-xs font-bold text-indigo-700">حقوق الملكية (دائن)</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-black tabular-nums text-indigo-700">
                  {equity.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                </CardContent>
              </Card>
            </div>
            <div className={"rounded-lg p-3 text-sm font-bold " + (totals.balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
              {totals.balanced
                ? `متوازن ✓ — مدين ${totals.debit.toFixed(2)} = دائن ${totals.credit.toFixed(2)}`
                : `غير متوازن — فرق ${(totals.debit - totals.credit).toFixed(2)}`}
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              سيتم حفظ المسودة (بنود الميزانية) وتفاصيل السجل المساعد ثم فحص تسوية الأرصدة مع دفتر الأستاذ.
            </p>
            <div className="text-xs font-semibold text-slate-600">
              عدد البنود: {collectLines().length} · العملاء: {arRows.length} · الموردون: {apRows.length} · المخزون: {invRows.length} · الأصول الثابتة: {faRows.length}
            </div>
            {reconciliation && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {reconciliation.rows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="font-semibold text-slate-700">
                      {reconLabel[r.key] || r.key}
                      <span className={"mr-2 text-[11px] px-1.5 py-0.5 rounded-full " + (r.reconciled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                        {r.reconciled ? "مطابق" : "فرق"}
                      </span>
                    </div>
                    <div className="tabular-nums text-slate-600">
                      السجل المساعد: {parseFloat(r.subledger).toFixed(2)} ← الأستاذ: {parseFloat(r.general_ledger).toFixed(2)}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
                  <span className={"font-bold " + (reconciliation.all_reconciled ? "text-green-700" : "text-red-600")}>
                    {reconciliation.all_reconciled ? "جميع الأرصدة متطابقة ✓" : "يوجد فرق في الأرصدة"}
                  </span>
                  <span className="tabular-nums text-slate-700 font-semibold">
                    رصيد الافتتاح (53): {parseFloat(reconciliation.opening_control_balance).toFixed(2)} · مدين {parseFloat(reconciliation.debit_total).toFixed(2)} / دائن {parseFloat(reconciliation.credit_total).toFixed(2)}
                  </span>
                </div>
                {(() => {
                  const controlZero = parseFloat(reconciliation.opening_control_balance) === 0;
                  const readyToPost = reconciliation.debit_equals_credit && reconciliation.all_reconciled;
                  const readyToLock = readyToPost && controlZero;
                  const blockers = [
                    !reconciliation.debit_equals_credit && "القيد غير متوازن",
                    !reconciliation.all_reconciled && "الواجهات الفرعية غير مطابقة",
                    !controlZero && "رصيد 53 لم يُصفَّر بعد",
                  ].filter(Boolean) as string[];
                  return (
                    <div className={"px-3 py-2 text-xs font-bold rounded-b-lg " + (readyToPost ? (readyToLock ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700") : "bg-red-50 text-red-600")}>
                      {readyToLock
                        ? "جاهز للترحيل والقفل ✓"
                        : readyToPost
                          ? "جاهز للترحيل (صفّر رصيد 53 قبل القفل)"
                          : "غير جاهز: " + blockers.join(" · ")}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      case 10:
      case 11:
      case 12:
      case 13: {
        const labels: Record<number, [string, string]> = {
          10: ["التحقق", "تأكيد أن البيانات صحيحة ومكتملة قبل الانتقال للاعتماد."],
          11: ["الاعتماد", "موافقة الجهة المخولة على الأرصدة قبل الترحيل."],
          12: ["الترحيل", "تسجيل قيد الرصيد الافتتاحي في دفتر الأستاذ العام."],
          13: ["القفل", "تثبيت الترحيل نهائياً ومنع أي تعديل مستقبلي."],
        };
        const [title, desc] = labels[step];
        return (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-xs text-slate-500">{desc}</p>
            <div className="text-xs font-semibold text-slate-600">
              الحالة الحالية:{" "}
              <span className="text-blue-700">{migration ? migration.status : "—"}</span>
              {migration && migration.notes && <span> · {migration.notes}</span>}
            </div>
            {busy && <p className="text-xs text-blue-600 font-semibold">جارٍ التنفيذ...</p>}
          </div>
        );
      }
      case 14:
        return (
          <div className="space-y-3">
            <div className={"rounded-lg p-4 text-center " + (migration?.status === "Locked" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
              <p className="text-base font-black">
                {migration?.status === "Locked" ? "اكتمل المعالج بنجاح ✓" : "اكتمل المعالج"}
              </p>
              <p className="text-xs mt-1">حالة الترحيل النهائية: {migration?.status} — تاريخ القطع: {migration?.cutover_date.split("T")[0]}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <OperationalTableTemplate
      title="معالج الرصيد الافتتاحي (شركة قائمة)"
      tableContent={
        <div className="flex flex-col h-full overflow-auto p-4">
          <WizardShell
            title="رصيد افتتاح شركة قائمة"
            subtitle="جمع أرصدة الميزانية والسجل المساعد ثم التحقق والاعتماد والترحيل والقفل."
            steps={STEPS}
            stepIndex={step}
            canNext={canNext}
            canPrev={canPrev}
            isNexting={busy}
            isFinal={step === STEPS.length - 1}
            nextLabel={nextLabel}
            onNext={handleNext}
            onPrev={() => setStep((s) => Math.max(0, s - 1))}
          >
            {renderStep()}
          </WizardShell>
        </div>
      }
    />
  );
}