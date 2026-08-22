import { useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { TabContext } from "@app/providers/TabContext";
import type { AccountDto, ResidualClassificationSpecDto } from "@erp/shared-types";
import { Input } from "@shared/ui/input";
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { cn } from "@shared/lib/utils";
import { StatusBadge } from "@shared/ui/status-badge";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toLocalDateStr, toFixed, fmtMoney } from "@shared/lib/format";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import {
  type OpeningBalanceMigrationDto,
} from "@modules/accounting/api/openingBalanceService";
import { WizardShell } from "@modules/opening-balance/components/WizardShell";
import { WizardLineEditor } from "@modules/opening-balance/components/WizardLineEditor";
import { useOpeningBalanceWizard, STEP_REVIEW, STEP_ACTION } from "@modules/opening-balance/hooks/useOpeningBalanceWizard";
import { START_MODE_NEW, toNum, type DerivedRow, type WizLine } from "@modules/opening-balance/lib/wizard-types";
import { sumLines, inventoryMismatchHints } from "@modules/opening-balance/lib/derive-rows";
import { reconciliationReadiness, RECON_ROW_LABEL } from "@modules/opening-balance/lib/migration-labels";
import { ReconciliationStatusBanner } from "@modules/opening-balance/components/ReconciliationStatusBanner";
import { AutoAmountSection } from "@modules/opening-balance/components/AutoAmountSection";
import { InlineBalanceRow } from "@modules/opening-balance/components/InlineBalanceRow";
import { InventorySection } from "@modules/opening-balance/components/InventorySection";
import { ReconciliationRowsTable } from "@modules/opening-balance/components/ReconciliationRowsTable";
import { AccountCombobox } from "@modules/opening-balance/components/AccountCombobox";
import { AccountLineRow } from "@modules/opening-balance/components/AccountLineRow";
import { OpeningPositionSummary } from "@modules/opening-balance/components/OpeningPositionSummary";
import { OpeningProgressChecklist, type ChecklistItem } from "@modules/opening-balance/components/OpeningProgressChecklist";

export function GuidedTransitionWizard() {
  const w = useOpeningBalanceWizard();
  const isNew = w.startMode === START_MODE_NEW;
  const navigate = useNavigate();
  const tabs = useContext(TabContext);

  // The shell renders every page inside a TAB whose route comes from
  // `openTab` — plain `navigate("/dashboard")` only rewrites the URL and leaves
  // the current tab on the opening page. Real navigation closes the opening tab
  // and switches to the dashboard tab via TabProvider (falls back to navigate
  // when no tab shell is present, e.g. in isolated component tests).
  const goDashboard = () => {
    if (tabs) {
      tabs.closeTab(tabs.activeTabId);
      tabs.openTab({ id: "/dashboard", title: "لوحة التحكم", path: "/dashboard" });
      return;
    }
    navigate("/dashboard");
  };

  // Opens any route through the tab system (closing the current opening tab) so
  // the navigation behaves identically to every other report transition.
  const goTo = (path: string, title: string) => {
    if (tabs) {
      tabs.closeTab(tabs.activeTabId);
      tabs.openTab({ id: path, title, path });
      return;
    }
    navigate(path);
  };

  const handleNext = () => {
    // The final step's «إنهاء» finishes the flow: transition to the dashboard
    // instead of remaining stuck on the completion step.
    if (w.step === w.steps.length - 1) {
      goDashboard();
      return;
    }
    void w.handleNext();
  };

  // Completed steps for clickable step indicators — data-driven, not sequential.
  const completedSteps = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < w.steps.length; i++) {
      if (i === 0) {
        set.add(i);
      } else if (i === 1 && w.cashBanks.length > 0) {
        set.add(i);
      } else if (i === 2 && w.derivedAr.length > 0) {
        set.add(i);
      } else if (i === 3 && w.inventoryTotal > 0) {
        set.add(i);
      } else if (i === 4 && w.faRows.length > 0) {
        set.add(i);
      } else if (i === 5 && (w.derivedAp.length > 0 || w.loans.length > 0 || w.liabilitiesManual.length > 0)) {
        set.add(i);
      } else if (i === 6 && (w.partnerEquity.length > 0 || w.equityManual.length > 0 || w.partnerCurrentManual.length > 0)) {
        set.add(i);
      } else if (i === STEP_REVIEW && w.migration) {
        set.add(i);
      } else if (i === STEP_ACTION && w.migration) {
        if (["Validated", "Posted", "Locked"].includes(w.migration.status)) set.add(i);
      } else if (i === 9 && w.firstPeriod) {
        set.add(i);
      }
    }
    return set;
  }, [
    w.steps, w.cashBanks, w.derivedAr, w.inventoryTotal,
    w.faRows, w.derivedAp, w.loans, w.liabilitiesManual,
    w.partnerEquity, w.partnerCurrentManual, w.equityManual,
    w.migration, w.firstPeriod,
  ]);

  const renderDone = () => {
    const locked = w.migration?.status === "Locked";
    return (
      <div className="space-y-3">
        <div className={"rounded-lg p-4 text-center " + (isNew || locked ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
          <p className="text-base font-black">
            {isNew ? "تم بدء المحاسبة بنجاح ✓" : locked ? "اكتمل إعداد الشركة ✓" : "اكتمل المعالج"}
          </p>
          <p className="text-xs mt-1">
            {isNew ? (
              "أول فترة مالية جاهزة — الشركة الآن في وضع المحاسبة العادي ويمكن تسجيل الحركات اليومية."
            ) : locked ? (
              "التحويل مكتمل: الرصيد الافتتاحي مقفول نهائياً وأول فترة تشغيلية جاهزة — الشركة الآن في وضع المحاسبة العادي."
            ) : (
              <>حالة الترحيل النهائية: <StatusBadge status={w.migration?.status || ""} /> — تاريخ القطع: {toLocalDateStr(w.migration?.cutover_date || "")}</>
            )}
          </p>
        </div>
        {w.firstPeriod && (
          <div className="rounded-lg p-3 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            أول فترة مالية: {toLocalDateStr(w.firstPeriod.start_date)} ← {toLocalDateStr(w.firstPeriod.end_date)}
          </div>
        )}
        {locked && w.migration && (
          <RetainedEarningsOverview
            migration={w.migration}
            firstPeriod={w.firstPeriod}
            onViewBalanceSheet={() => goTo("/accounting/reports/balance-sheet", "الميزانية العمومية")}
            onDistribute={() => goTo(
              `/accounting/profit-distribution?source=opening&migration=${w.migration!.id}`,
              "توزيع الأرباح",
            )}
          />
        )}
        <div className="flex justify-center pt-1">
          <Button size="sm" onClick={goDashboard} className="bg-green-600 hover:bg-green-700 text-white font-bold">
            الانتقال إلى لوحة التحكم
          </Button>
        </div>
      </div>
    );
  };

  const renderTotalsSummary = () => (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        معادلة الميزانية: الأصول (A) = الخصوم (L) + حقوق الملكية (E). يجب أن يتوازن الجانبان قبل الحفظ.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
          <div className="text-xs font-semibold text-blue-700">الأصول (مدين)</div>
          <div className="text-xl font-black tabular-nums text-blue-700">{toFixed(w.totals.debit, 2)}</div>
        </div>
        <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
          <div className="text-xs font-semibold text-emerald-700">الخصوم (دائن)</div>
          <div className="text-xl font-black tabular-nums text-emerald-700">{toFixed(w.totals.liabilities, 2)}</div>
        </div>
        <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
          <div className="text-xs font-semibold text-indigo-700">حقوق الملكية (دائن)</div>
          <div className="text-xl font-black tabular-nums text-indigo-700">
            {toFixed(w.totals.equity + w.totals.plugAmount, 2)}
          </div>
        </div>
      </div>

      {w.totals.residual > 0 && (
        <ResidualClassificationSection
          residual={w.totals.residual}
          plugAmount={w.totals.plugAmount}
          specs={w.residualSpecs}
          value={w.residualClassification}
          onValueChange={w.handleClassificationChange}
          residualAccountId={w.residualAccountId}
          onResidualAccountChange={w.setResidualAccountId}
          accounts={w.accounts}
          spec={w.residualSpec}
        />
      )}

      {w.totals.residual < 0 && (
        <NegativeResidualSection
          residual={w.totals.residual}
          manualLines={w.assetsManual}
          onAdd={w.addManualDebitLine}
          onUpdate={w.updateManualDebitLine}
          onRemove={w.removeManualDebitLine}
          accounts={w.accounts}
          detailAccounts={w.detailAccounts}
        />
      )}

      {w.totals.plugAmount !== 0 && (
        <div className="rounded-lg p-3 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          بند موازنة تلقائي على حساب الرصيد الافتتاحي (53): {toFixed(w.totals.plugAmount, 2)} — سيعاد
          تصنيفه بعد الترحيل إلى الحساب المحدد.
        </div>
      )}

      <div className={"rounded-lg p-3 text-sm font-bold " + (w.totals.balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
        {w.totals.balanced
          ? `متوازن ✓ — مدين ${toFixed(w.totals.debit, 2)} = دائن ${toFixed(w.totals.credit, 2)}`
          : `غير متوازن — فرق ${toFixed(w.totals.debit - w.totals.credit, 2)}`}
      </div>
    </div>
  );

  const renderStep = () => {
    switch (w.step) {
      case 0:
        return (
          <div className="space-y-4">
            {isNew && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-700">الشركة تعمل بوضع «شركة جديدة»</p>
                  <p className="text-xs text-blue-600">
                    لا يُنشأ رصيد افتتاحي في هذا الوضع — تبدأ السجلات من الصفر. حدّد نافذة أول فترة
                    مالية ثم اضغط «إنشاء الفترة الأولى والبدء».
                  </p>
                </div>
                <FirstPeriodFields
                  start={w.firstPeriodStart}
                  end={w.firstPeriodEnd}
                  onStart={w.setFirstPeriodStart}
                  onEnd={w.setFirstPeriodEnd}
                  created={w.firstPeriod}
                />
              </>
            )}

            {!isNew && (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-700">شركة قائمة تبدأ استخدام التطبيق الآن:</p>
                  <p className="text-xs text-amber-600">
                    سيُدخل الحالة المالية الفعلية للشركة في تاريخ بدء الاستخدام (تاريخ القطع). لن يُنشأ
                    أي حركة نقدية تلقائية — رأس مال الشركاء رصيد سابق، وليس مساهمة نقدية جديدة.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="wiz-cutover-date" required>تاريخ القطع (Cutover)</FieldLabel>
                    <Input id="wiz-cutover-date" type="date" value={w.cutoverDate} onChange={(e) => w.setCutoverDate(e.target.value)} className="h-9" />
                    <p className="text-2xs text-slate-500">تاريخ بدء استخدام التطبيق الذي تُرصد بناءً عليه أرصدة الميزانية القديمة.</p>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="wiz-source-system">النظام السابق (Source System)</FieldLabel>
                    <Input id="wiz-source-system" value={w.sourceSystem} onChange={(e) => w.setSourceSystem(e.target.value)} placeholder="مثال: نظام محاسبة قديم" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="wiz-source-reference">المرجع (Source Reference)</FieldLabel>
                    <Input id="wiz-source-reference" value={w.sourceReference} onChange={(e) => w.setSourceReference(e.target.value)} placeholder="رقم الميزانية / المرجع" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="wiz-notes">ملاحظات</FieldLabel>
                    <Input id="wiz-notes" value={w.notes} onChange={(e) => w.setNotes(e.target.value)} placeholder="اختياري" className="h-9" />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 1:
        if (isNew) return renderDone();
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              أدخل أرصدة الصندوق والبنوك كمبالغ فقط — الحساب الافتراضي يُقترح تلقائياً ويمكن تغييره يدوياً.
            </p>
            <AutoAmountSection
              title="الصندوق والنقد"
              rows={w.cashBanks.filter((l) => l.kind === "cash")}
              onAdd={w.addCashRow}
              onPatch={(key, patch) => w.updateLine(w.setCashBanks, key, patch)}
              onRemove={(key) => w.setCashBanks((prev) => prev.filter((x) => x.key !== key))}
              accounts={w.accounts}
              detailAccounts={w.detailAccounts}
              defaultAccount={w.defaultCashAccount}
              addLabel="إضافة صندوق/نقد"
            />
            <AutoAmountSection
              title="البنوك"
              hint="تُقيد أرصدة الشيكات والحسابات البنكية هنا على حساب بنكي."
              rows={w.cashBanks.filter((l) => l.kind === "bank")}
              onAdd={w.addBankRow}
              onPatch={(key, patch) => w.updateLine(w.setCashBanks, key, patch)}
              onRemove={(key) => w.setCashBanks((prev) => prev.filter((x) => x.key !== key))}
              accounts={w.accounts}
              detailAccounts={w.detailAccounts}
              defaultAccount={w.defaultBankAccount}
              addLabel="إضافة حساب بنكي"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              أرصدة العملاء تُشتق من سجل العملاء ويمكن تعديلها هنا مباشرة.
            </p>
            <InlineRows
              title="الذمم المدينة — العملاء (مشتقة)"
              rows={w.derivedAr}
              onSave={w.saveCustomerOpening}
              label="رصيد العميل"
              nativeHint="debit"
            />
            {w.derivedAr.length === 0 && (
              <p className="text-xs text-slate-400">لا يوجد عملاء بأرصدة — أضفهم من صفحة «العملاء» أو تخطَّ.</p>
            )}
          </div>
        );
      case 3:
        return (
          <InventorySection
            rows={w.effectiveInventory}
            onRowChange={w.setInventoryRow}
            total={w.inventoryTotal}
            accountId={w.effectiveInventoryAccountId}
            defaultAccount={w.defaultInventoryAccount}
            onAccountChange={w.setInventoryAccountId}
            posted={w.inventoryPosted}
            posting={w.inventoryPosting}
            onPost={() => { void w.handlePostInventoryInvoice(); }}
            accounts={w.accounts}
            detailAccounts={w.detailAccounts}
          />
        );
      case 4:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              صافي القيمة الدفترية (التكلفة − مجمع الإهلاك) مشتق من سجل الأصول الثابتة. التعديل هنا يؤثر على
              قيمة الافتتاح في المعالج فقط — سجل الأصول والاستهلاك يبقى كما هو.
            </p>
            <InlineRows
              title="الأصول الثابتة (مشتقة — صافي القيمة الدفترية)"
              rows={w.faRows}
              onSave={w.saveFixedAssetOverride}
              label="القيمة الافتتاحية"
              nativeHint="debit"
            />
            {w.faRows.length === 0 && (
              <p className="text-xs text-slate-400">لا توجد أصول ثابتة نشطة.</p>
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              أرصدة الموردين (مشتقة) + القروض والالتزامات (يدوي) — جميعها طبيعة دائن (خصوم).
            </p>
            <InlineRows
              title="الذمم الدائنة — الموردون (مشتقة)"
              rows={w.derivedAp}
              onSave={w.saveSupplierOpening}
              label="رصيد المورد"
              nativeHint="credit"
            />
            {w.derivedAp.length === 0 && (
              <p className="text-xs text-slate-400">لا توجد أرصدة موردين مستحقة.</p>
            )}
            <AutoAmountSection
              title="القروض"
              hint="قروض وتسليفات بنكية — تُقيد كالتزام على حساب قرض."
              rows={w.loans}
              onAdd={w.addLoanRow}
              onPatch={(key, patch) => w.updateLine(w.setLoans, key, patch)}
              onRemove={(key) => w.setLoans((prev) => prev.filter((x) => x.key !== key))}
              accounts={w.accounts}
              detailAccounts={w.detailAccounts}
              defaultAccount={w.defaultLoanAccount}
              addLabel="إضافة قرض"
            />
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">التزامات أخرى (يدوي)</div>
              <WizardLineEditor rows={w.liabilitiesManual} setter={w.setLiabilitiesManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب التزام..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              حقوق الشركاء: رؤوس أموال (مشتقة من سجل الشركاء) + حسابات جارية + حقوق ملكية يدوية — جميعها طبيعة دائن.
            </p>
            <InlineRows
              title="رؤوس أموال الشركاء (مشتقة)"
              rows={w.partnerEquity}
              onSave={w.savePartnerCapital}
              label="رأس المال"
              nativeHint="credit"
            />
            {w.partnerEquity.length === 0 && (
              <p className="text-xs text-slate-400">لا يوجد شركاء برأس مال — أضفهم عبر صفحة «الشركاء ورأس المال» أو أدخل حقوق ملكية يدوياً.</p>
            )}
            <InlineRows
              title="الحسابات الجارية للشركاء"
              rows={w.partnerCurrentManualRows}
              onSave={w.savePartnerCurrentAccount}
              label="الحساب الجاري"
              nativeHint="credit"
            />
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">حقوق ملكية أخرى (يدوي)</div>
              <WizardLineEditor rows={w.equityManual} setter={w.setEquityManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب حقوق ملكية..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            {renderTotalsSummary()}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">سيتم عند «حفظ وفحص التسوية»:</p>
              <p className="text-xs text-slate-500">
                حفظ المسودة (بنود الميزانية) وتفاصيل السجل المساعد ثم فحص تسوية الأرصدة مع دفتر الأستاذ.
                عدد البنود: {w.collectLines().length} ·
                العملاء: {w.derivedAr.length} · الموردون: {w.derivedAp.length} ·
                الأصول الثابتة: {w.faRows.length} · حقوق الشركاء: {w.partnerEquity.length + w.partnerCurrentManual.length}
              </p>
            </div>
            {w.reconciliation && (
              <div className="space-y-3">
                <ReconciliationRowsTable
                  rows={w.reconciliation.rows}
                  allReconciled={w.reconciliation.all_reconciled}
                  openingControlBalance={w.reconciliation.opening_control_balance}
                  debitTotal={w.reconciliation.debit_total}
                  creditTotal={w.reconciliation.credit_total}
                />
                <ReconciliationStatusBanner readiness={reconciliationReadiness(w.reconciliation)} />
              </div>
            )}
            {w.residualClassification === "RetainedEarnings" && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
                <p className="text-xs font-bold text-indigo-700">
                  التصنيف المعتمد: الأرباح المبقاة — تُرحَّل إلى حسابها وتظهر في الميزانية العمومية ضمن بند
                  «الأرباح المبقاة» منفصلةً عن رأس مال الشركاء.
                </p>
                <p className="text-xs text-indigo-600">
                  بعد ترحيل الرصيد الافتتاحي وقفله يصير صافي الأرباح متاحاً للتوزيع على الشركاء عبر
                  آلية التوزيع الموحّدة (تصنّف الحصص بحسب نسب التقاسم المسجّلة وتُقيَّد على الحسابات الجارية
                  دون المساس برأس المال).
                </p>
                <Button
                  size="sm"
                  onClick={() => goTo(
                    `/accounting/profit-distribution?source=opening&migration=${w.migration?.id ?? ""}`,
                    "توزيع الأرباح",
                  )}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  توزيع الأرباح
                </Button>
              </div>
            )}
          </div>
        );
      case STEP_ACTION: {
        return (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">إتمام الترحيل</p>
            <p className="text-xs text-slate-500">
              تأكيد صحة البيانات وتسجيل قيد الرصيد الافتتاحي في دفتر الأستاذ ثم تثبيته نهائياً ومنع أي تعديل مستقبلي.
            </p>
            <div className="text-xs font-semibold text-slate-600 flex items-center">
              الحالة الحالية:
              {w.migration ? (
                <StatusBadge status={w.migration.status} className="mr-1.5" />
              ) : (
                <span className="text-slate-400 mr-1.5">—</span>
              )}
              {w.migration && w.migration.notes && <span> · {w.migration.notes}</span>}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
              {[
                { label: "التحقق من صحة البيانات", done: ["Validated", "Posted", "Locked"].includes(w.migration?.status || "") },
                { label: "ترحيل قيد الرصيد الافتتاحي", done: ["Posted", "Locked"].includes(w.migration?.status || "") },
                { label: "القفل النهائي", done: w.migration?.status === "Locked" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs font-semibold">
                  <span className={cn("rounded-full p-0.5", item.done ? "bg-emerald-600 text-white" : "bg-slate-300 text-white")}>
                    <Check className="w-3 h-3" />
                  </span>
                  <span className={item.done ? "text-emerald-700" : "text-slate-500"}>{item.label}</span>
                </div>
              ))}
            </div>
            {w.busy && <p className="text-xs text-blue-600 font-semibold">جارٍ التنفيذ...</p>}
          </div>
        );
      }
      case 9: {
        // Post-lock onboarding: once the migration is Locked this step sets up
        // the first operational period.
        const locked = w.migration?.status === "Locked";
        const showCompletionPanel = locked && !w.firstPeriod && !w.onboardingStarted;
        return (
          <div className="space-y-4">
            {locked && !w.firstPeriod && (
              <>
                <LockedCompletionPanel
                  posted={!!w.migration && ["Posted", "Locked"].includes(w.migration.status)}
                  reconciled={w.reconciliation?.all_reconciled === true}
                  locked={locked}
                />
                <RetainedEarningsOverview
                  migration={w.migration}
                  firstPeriod={w.firstPeriod}
                  onViewBalanceSheet={() => goTo("/accounting/reports/balance-sheet", "الميزانية العمومية")}
                  onDistribute={() => goTo(
                    `/accounting/profit-distribution?source=opening&migration=${w.migration!.id}`,
                    "توزيع الأرباح",
                  )}
                />
                {!w.onboardingStarted && (
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      onClick={w.beginFirstPeriodSetup}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      بدء أول فترة تشغيلية
                    </Button>
                  </div>
                )}
              </>
            )}
            {(w.onboardingStarted || !locked || !!w.firstPeriod) && (
              <div className="space-y-3">
                {!showCompletionPanel && (
                  <p className="text-xs text-slate-500">
                    أُقفل الرصيد الافتتاحي. حدّد الآن نافذة أول فترة تشغيلية ستُقيد عليها الحركات الجديدة
                    (عادةً من اليوم التالي لتاريخ القطع حتى نهاية السنة). لا يمكن ترحيل أي حركة خارج فترة
                    مفتوحة.
                  </p>
                )}
                <FirstPeriodFields
                  start={w.firstPeriodStart}
                  end={w.firstPeriodEnd}
                  onStart={w.setFirstPeriodStart}
                  onEnd={w.setFirstPeriodEnd}
                  created={w.firstPeriod}
                />
                {w.firstPeriod ? (
                  <div className="rounded-lg p-3 text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                    تم إنشاء أول فترة تشغيلية ✓ — اضغط «التالي» لإكمال الإعداد أو انتقل إلى لوحة التحكم.
                  </div>
                ) : w.onboardingStarted ? (
                  <p className="text-xs text-slate-400">اضغط «إنشاء أول فترة تشغيلية» لإنشائها ثم تابع.</p>
                ) : null}
              </div>
            )}
          </div>
        );
      }
      case 10:
        return renderDone();
      default:
        return null;
    }
  };

  // ── Live opening-position summary (§13) derived from wizard state ─────────
  const summary = useMemo(() => {
    const cash = sumLines(w.cashBanks.filter((l) => l.kind === "cash"));
    const bank = sumLines(w.cashBanks.filter((l) => l.kind === "bank"));
    const receivables = sumLines(w.derivedAr);
    const inventory = w.inventoryTotal;
    const fixedAssets = sumLines(w.faRows);
    const suppliers = sumLines(w.derivedAp);
    const loans = sumLines(w.loans);
    const otherLiabilities = sumLines(w.liabilitiesManual);
    const partnerCapital = sumLines(w.partnerEquity);
    const partnerCurrent = sumLines(w.partnerCurrentManual);
    const otherEquity = sumLines(w.equityManual);

    const totalAssets = cash + bank + receivables + inventory + fixedAssets;
    const totalLiabilities = suppliers + loans + otherLiabilities;
    const recognizedEquity = partnerCapital + partnerCurrent + otherEquity;
    const residual = totalAssets - totalLiabilities - recognizedEquity;

    // Smart, section-targeted hints (§14): tell the accountant WHICH section
    // needs fixing and by how much, never "journal line 17 is invalid".
    const hints: string[] = [];
    if (residual > 0.01) {
      hints.push(`إجمالي الأصول أكبر من الخصوم وحقوق الملكية بمبلغ ${toFixed(residual, 2)} — صُنّف الرصيد المتبقي من قسم «حقوق الشركاء».`);
    } else if (residual < -0.01) {
      hints.push(`الخصوم وحقوق الملكية تزيد عن الأصول بمبلغ ${toFixed(-residual, 2)} — أضف بنداً مديناً (مثل مسحوبات الشركاء أو تسوية) في أحد أقسام الأصول.`);
    }
    for (const r of w.derivedAr) {
      if (toNum(r.amount) > 0 && !r.account_id) {
        hints.push(`يوجد رصيد عميل «${r.label}» بقيمة ${fmtMoney(r.amount)} غير مرتبط بحساب عميل — راجعه في قسم «الذمم المدينة».`);
      }
    }
    for (const r of w.derivedAp) {
      if (toNum(r.amount) > 0 && !r.account_id) {
        hints.push(`يوجد رصيد مورد «${r.label}» بقيمة ${fmtMoney(r.amount)} غير مرتبط بحساب مورد — راجعه في قسم «الذمم الدائنة».`);
      }
    }
    if (w.reconciliation && !w.reconciliation.all_reconciled) {
      for (const row of w.reconciliation.rows) {
        if (toNum(row.subledger) !== toNum(row.general_ledger)) {
          hints.push(
            `رصيد ${RECON_ROW_LABEL[row.key] || row.key}: السجل المساعد ${fmtMoney(row.subledger)} لا يطابق دفتر الأستاذ ${fmtMoney(row.general_ledger)}.`,
          );
        }
      }
    }
    hints.push(...inventoryMismatchHints(w.effectiveInventory, w.materials));
    // Amounts entered on rows that resolved no ledger account: they would be
    // silently dropped from the saved lines while still counting in the
    // section totals — the exact source of the GL ≠ wizard mismatch.
    for (const hint of w.missingAccountHints) {
      hints.push(`${hint} — اختر حساباً من القائمة ليُضمَّن في بنود الميزانية ودفتر الأستاذ.`);
    }

    return {
      cash,
      bank,
      receivables,
      inventory,
      fixedAssets,
      suppliers,
      loans,
      otherLiabilities,
      partnerCapital,
      partnerCurrent,
      otherEquity,
      residual,
      hints,
    };
  }, [w.cashBanks, w.derivedAr, w.derivedAp, w.faRows, w.loans, w.liabilitiesManual, w.partnerEquity, w.partnerCurrentManual, w.equityManual, w.inventoryTotal, w.reconciliation, w.effectiveInventory, w.materials, w.missingAccountHints]);

  // ── Progress checklist (§15): every section's done-state, derived from data
  // and the reached step so the user never has to remember what is finished.
  const checklistItems: ChecklistItem[] = useMemo(() => {
    const ar = sumLines(w.derivedAr);
    const ap = sumLines(w.derivedAp);
    const loansT = sumLines(w.loans);
    const otherLiab = sumLines(w.liabilitiesManual);
    const cap = sumLines(w.partnerEquity);
    const partnerCurr = sumLines(w.partnerCurrentManual);
    const otherEq = sumLines(w.equityManual);
    const cashBank = sumLines(w.cashBanks);
    const fa = sumLines(w.faRows);
    return [
      { key: "cutover", label: "تاريخ القطع", done: !!w.cutoverDate },
      { key: "cash", label: "أرصدة النقد والبنوك", done: cashBank > 0 || w.step > 1 },
      { key: "customers", label: "العملاء (الذمم المدينة)", done: ar > 0 || w.step > 2 },
      { key: "inventory", label: "المخزون (ترحيل البضاعة)", done: !!w.inventoryPosted || w.inventoryTotal === 0 || w.step > 3 },
      { key: "fixed-assets", label: "الأصول الثابتة", done: fa > 0 || w.step > 4 },
      { key: "suppliers-loans", label: "الموردون والالتزامات", done: ap > 0 || loansT > 0 || otherLiab > 0 || w.step > 5 },
      { key: "partners", label: "حقوق الشركاء", done: cap > 0 || partnerCurr > 0 || otherEq > 0 || w.step > 6 },
      { key: "reconcile", label: "التسوية", done: !!w.reconciliation && w.reconciliation.all_reconciled },
      { key: "balanced", label: "متوازن", done: w.savedTotals.balanced },
      { key: "ready", label: "جاهز للترحيل", done: w.step >= STEP_REVIEW && w.canNext },
    ];
  }, [w.derivedAr, w.derivedAp, w.loans, w.liabilitiesManual, w.partnerEquity, w.equityManual, w.cashBanks, w.faRows, w.inventoryPosted, w.inventoryTotal, w.step, w.cutoverDate, w.reconciliation, w.savedTotals, w.canNext]);

  const wizard = (
    <WizardShell
      title={isNew ? "بدء محاسبة شركة جديدة" : "معالج التحويل الموجه (شركة قائمة)"}
      subtitle={isNew
        ? "أنشئ أول فترة مالية وابدأ تسجيل الحركات اليومية — لا يوجد رصيد افتتاحي في هذا الوضع."
        : "جمع الأرصدة قسماً بقسم (نقد وبنوك، عملاء، مخزون، أصول ثابتة، مورden والالتزامات، شركاء) ثم إتمام الترحيل ثم إنشاء أول فترة تشغيلية."}
      steps={w.steps}
      stepIndex={w.step}
      canNext={w.canNext}
      canPrev={w.canPrev}
      isNexting={w.busy}
      isFinal={w.step === w.steps.length - 1}
      nextLabel={w.nextLabel}
      canNextHint={w.nextDisabledReason}
      onNext={handleNext}
      onPrev={() => w.setStep((s) => Math.max(0, s - 1))}
      onStepClick={w.navigateToStep}
      canNavigateToStep={w.canNavigateToStep}
      completedSteps={completedSteps}
    >
      {renderStep()}
    </WizardShell>
  );

  // Once the migration is sealed the opening position summary / progress
  // checklist are opening controls — no longer relevant. The wizard shows only
  // the post-transition onboarding.
  if (isNew || w.migration?.status === "Locked") return wizard;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start" dir="rtl">
      {wizard}
      <aside className="lg:sticky lg:top-4 space-y-3 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto custom-scrollbar">
        <OpeningPositionSummary {...summary} plugAmount={w.totals.plugAmount} balanced={w.savedTotals.balanced} />
        <OpeningProgressChecklist items={checklistItems} />
      </aside>
    </div>
  );
}

function InlineRows({
  title,
  rows,
  onSave,
  label,
  nativeHint,
}: {
  title: string;
  rows: DerivedRow[];
  onSave: (row: DerivedRow, value: string) => Promise<boolean>;
  label: string;
  nativeHint?: "debit" | "credit";
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{title}</span>
        <span className="tabular-nums text-xs font-bold text-slate-700">
          {rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(2)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-1.5">لا توجد بنود مشتقة.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/40">
          {rows.map((r) => (
            <InlineBalanceRow key={r.key} row={r} onSave={onSave} label={label} nativeHint={nativeHint} />
          ))}
        </div>
      )}
    </div>
  );
}

function FirstPeriodFields({
  start,
  end,
  onStart,
  onEnd,
  created,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  created: { start_date: string; end_date: string } | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-indigo-700">أول فترة مالية (أساسية للمحاسبة)</p>
        <p className="text-xs text-indigo-600">
          الفترات المالية هي الأساس الذي تُقيد عليه كل الحركات — دون فترة مفتوحة تغطي تاريخ القيد لا يمكن
          ترحيل أي حركة محاسبية.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wiz-period-start" required>بداية الفترة</FieldLabel>
          <Input id="wiz-period-start" type="date" value={start} onChange={(e) => onStart(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="wiz-period-end" required>نهاية الفترة</FieldLabel>
          <Input id="wiz-period-end" type="date" value={end} onChange={(e) => onEnd(e.target.value)} className="h-9" />
        </div>
      </div>
      {created && (
        <div className="rounded-lg p-3 text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          تم إنشاء الفترة: {toLocalDateStr(created.start_date)} ← {toLocalDateStr(created.end_date)}
        </div>
      )}
    </div>
  );
}

// ── Locked-completion panel: shown after the migration is sealed.
// Presents the four confirmation checkmarks then the "next step" call-to-action.
export function LockedCompletionPanel({
  posted,
  reconciled,
  locked,
}: {
  posted: boolean;
  reconciled: boolean;
  locked: boolean;
}) {
  const items = [
    { label: "الأرصدة الافتتاحية مُرحّلة إلى دفتر الأستاذ", done: posted },
    { label: "التسوية مكتملة ومتوازنة (دليل الحسابات = السجلات المساعدة)", done: reconciled },
    { label: "التحويل مقفول نهائياً — لا يُقبل أي تعديل لاحق", done: locked },
    { label: "الشركة في وضع المحاسبة العادي — الحركات اليومية متاحة", done: locked },
  ];
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
      <p className="text-sm font-black text-emerald-700">تم التحويل بنجاح ✓</p>
      <p className="text-xs text-emerald-600">اكتملت مرحلة الرصيد الافتتاحي بجميع خطواتها:</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <span className={"rounded-full p-0.5 " + (it.done ? "bg-emerald-600 text-white" : "bg-amber-400 text-amber-900")}>
              <Check className="w-3.5 h-3.5" />
            </span>
            {it.label}
          </li>
        ))}
      </ul>
      <div className="pt-0.5 rounded-lg bg-white border border-emerald-200 p-3 space-y-1">
        <p className="text-xs font-bold text-emerald-800">الخطوة التالية: إعداد أول فترة تشغيلية</p>
        <p className="text-xs text-emerald-600">
          تُقيد الحركات الجديدة على فترة مالية مفتوحة — عادةً من اليوم التالي لتاريخ القطع حتى نهاية السنة.
        </p>
      </div>
    </div>
  );
}

// ── Retained-earnings overview: shown once the migration is locked. It reads
// the historical retained balance (as at cutover) and — once the first
// operational period exists — the current retained balance and the amount
// available for distribution. The [توزيع الأرباح] action navigates INTO the
// general-purpose profit-distribution workflow with the source preselected
// (`source=opening&migration=<id>`) — the SAME engine, never a second mechanism.
function RetainedEarningsOverview({
  migration,
  firstPeriod,
  onViewBalanceSheet,
  onDistribute,
}: {
  migration: OpeningBalanceMigrationDto;
  firstPeriod: { start_date: string; end_date: string } | null;
  onViewBalanceSheet: () => void;
  onDistribute: () => void;
}) {
  const AS_AT_CUTOVER_START = "1970-01-01T00:00:00Z";
  const endOfCutover = useMemo(() => {
    const day = migration.cutover_date.slice(0, 10);
    return day ? new Date(`${day}T23:59:59Z`).toISOString() : "";
  }, [migration.cutover_date]);

  const asAtLock = useQuery({
    queryKey: QUERY_KEYS.distributableProfit(AS_AT_CUTOVER_START, endOfCutover),
    queryFn: () => fiscalPeriodService.getDistributableProfit(AS_AT_CUTOVER_START, endOfCutover),
    enabled: !!migration.id && !!endOfCutover,
  });

  const current = useQuery({
    queryKey: QUERY_KEYS.distributableProfit(firstPeriod?.start_date ?? "", firstPeriod?.end_date ?? ""),
    queryFn: () =>
      fiscalPeriodService.getDistributableProfit(firstPeriod?.start_date ?? "", firstPeriod?.end_date ?? ""),
    enabled: !!firstPeriod?.start_date && !!firstPeriod?.end_date,
  });

  const historicalRetained = parseSafeNumber(asAtLock.data?.retained_earnings_balance);
  const currentRetained = current.data
    ? parseSafeNumber(current.data.retained_earnings_balance)
    : historicalRetained;
  const currentDistributed = current.data
    ? parseSafeNumber(current.data.allocated_to_date)
    : parseSafeNumber(asAtLock.data?.allocated_to_date);
  const available =
    current.data
      ? parseSafeNumber(current.data.distributable)
      : parseSafeNumber(asAtLock.data?.distributable);

  return (
    <div className="rounded-lg border border-indigo-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-slate-700">الأرباح المبقاة</p>
        <span className="text-[11px] font-semibold text-slate-400">المتاح للتوزيع حسب النموذج المحاسبي</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">الأرباح المبقاة التاريخية</p>
          <p className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(historicalRetained)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">الأرباح المبقاة الحالية</p>
          <p className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(currentRetained)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500">المُوزَّع سابقاً</p>
          <p className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(currentDistributed)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-emerald-600">المتبقي للتوزيع</p>
          <p className="text-lg font-black tabular-nums text-emerald-700">{fmtMoney(available)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between pt-0.5">
        <Button variant="outline" size="sm" onClick={onViewBalanceSheet} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold">
          عرض الأرباح المبقاة
        </Button>
        <Button size="sm" onClick={onDistribute} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
          توزيع الأرباح
        </Button>
      </div>
    </div>
  );
}

// ── Residual classification: the user picks the ACCOUNTING MEANING, the system
// picks the designated account. Classification cards replace the raw
// drop-down; the account is only chosen explicitly in Advanced mode, filtered
// to the classification's controlled purposes. UnresolvedDifference blocks
// posting/locking and never carries an account.
export function ResidualClassificationSection({
  residual,
  plugAmount,
  specs,
  value,
  onValueChange,
  residualAccountId,
  onResidualAccountChange,
  accounts,
  spec,
}: {
  residual: number;
  plugAmount: number;
  specs: ResidualClassificationSpecDto[];
  value: string;
  onValueChange: (key: string) => void;
  residualAccountId: string;
  onResidualAccountChange: (accountId: string) => void;
  accounts: AccountDto[];
  spec: ResidualClassificationSpecDto | undefined;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const confirmSpec = specs.find((s) => s.key === confirmKey);

  const apply = (key: string) => {
    onValueChange(key);
    setAdvanced(false);
  };

  const onPick = (key: string) => {
    if (key === value) return;
    const candidate = specs.find((s) => s.key === key);
    if (candidate?.requires_confirmation) {
      setConfirmKey(key);
      return;
    }
    apply(key);
  };

  const effectiveAccount = accounts.find((a) => a.id === residualAccountId);
  const advancedOptions = spec
    ? accounts.filter(
        (a) =>
          a.account_type === "Equity" &&
          (a.purpose ? spec.allowed_purposes.includes(a.purpose) : false) &&
          a.is_active,
      )
    : [];

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-amber-700">
        الرصيد المتبقي (غير مسجل من النظام السابق): {toFixed(residual, 2)}
      </p>
      {residual > 0 ? (
        <p className="text-xs text-amber-600">
          يُحسب الرصيد تلقائياً وطبيعته قرار محاسب صريح — لا تُسوّى قسراً. اختر المعنى المحاسبي وسيختار
          النظام الحساب المخصص تلقائياً (52 / 521 / 525 / 526) ويضيف بند موازنة على حساب الرصيد الافتتاحي
          (53) يُعاد تصنيفه بعد الترحيل.
        </p>
      ) : (
        <p className="text-xs text-amber-600">
          الرصيد المتبقي سالب (الخصوم/الملكية تزيد عن الأصول). أضف بنداً يدوياً مديناً (مثال: مسحوبات
          الشركاء أو حساب تسوية) في الخطوات السابقة لموازنة القيد.
        </p>
      )}

      {residual > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="تصنيف الفرق المتبقي">
            {specs.map((s) => {
              const selected = s.key === value;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onPick(s.key)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
                    selected
                      ? "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-400"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    !s.allows_posting && "text-red-600",
                  )}
                >
                  <span className="truncate">{s.label_ar}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>

          {value === "UnresolvedDifference" && (
            <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 space-y-1">
              <p className="text-xs font-bold text-red-700">
                فرق غير محلول — لن يُرحَّل ولن يُقفَل حتى يُحل الفرق
              </p>
              <p className="text-xs text-red-600">
                صحّح الأرصدة في الخطوات السابقة أو اختر تصنيفاً لحقوق الملكية أعلاه. لا يحمل هذا التصنيف
                حساباً، ولن يُنشأ أي قيد.
              </p>
            </div>
          )}

          {value !== "" && value !== "UnresolvedDifference" && (
            <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700">معاينة قبل التسجيل:</p>
              {plugAmount !== 0 && (
                <p className="text-xs text-slate-600">
                  القيمة: <span className="tabular-nums font-bold text-slate-800">{toFixed(plugAmount, 2)}</span>{" "}
                  — نوع المعالجة: <span className="font-bold text-slate-800">{spec?.label_ar ?? value}</span>
                </p>
              )}
              <p className="text-xs text-slate-600">{spec?.treatment_ar ?? ""}</p>
              {(spec?.designated_account || effectiveAccount) && (
                <p className="text-xs text-slate-600">
                  الحساب المخصص:{" "}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                      {(spec?.designated_account ?? effectiveAccount)?.code ?? ""}
                    </span>
                    <span className="font-bold text-slate-800">
                      {(spec?.designated_account ?? effectiveAccount)?.name_ar ?? ""}
                    </span>
                  </span>
                </p>
              )}
            </div>
          )}

          {value === "RetainedEarnings" && plugAmount !== 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50/70 p-3 space-y-1">
              <p className="text-xs font-bold text-green-700">
                ✓ تم تصنيف الرصيد كأرباح مبقاة — {toFixed(plugAmount, 2)}
              </p>
              <p className="text-xs text-green-600">
                بعد إكمال الترحيل تُرحَّل هذه القيمة إلى حساب الأرباح المبقاة (52) وتظهر في الميزانية
                العمومية ضمن بند «الأرباح المبقاة» منفصلةً عن رأس مال الشركاء.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-between pt-0.5">
            <button
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              className="text-[11px] font-semibold text-slate-500 underline decoration-dotted hover:text-slate-700"
              aria-expanded={advanced}
            >
              {advanced ? "إغلاق الوضع المتقدم" : "اختيار الحساب يدوياً (وضع متقدم)"}
            </button>
            {advanced && (
              <div className="w-full md:max-w-xs">
                <AccountCombobox
                  accounts={accounts}
                  options={advancedOptions}
                  value={residualAccountId}
                  onValueChange={onResidualAccountChange}
                  placeholder="حساب حقوق ملكية بالغرض المحدد"
                  emptyText="لا توجد حسابات بالغرض المحدد لهذا التصنيف"
                  disabled={value === "" || value === "UnresolvedDifference" || advancedOptions.length === 0}
                />
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmKey !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmKey(null);
        }}
        title={`تأكيد تصنيف «${confirmSpec?.label_ar ?? ""}»`}
        description="هذا التصنيف يعالج تصحيح خطأ من سنوات سابقة ولا يصحّح الأرباح المبقاة مباشرة. هل تريد المتابعة؟"
        confirmLabel="تأكيد التصنيف"
        cancelLabel="إلغاء"
        onConfirm={() => {
          if (confirmKey) apply(confirmKey);
          setConfirmKey(null);
        }}
      />
    </div>
  );
}

// ── Negative residual: when liabilities + equity > assets (debit residual), the
// accountant must add manual debit lines to balance the entry. This section
// provides an inline editor directly in the Review step.
function NegativeResidualSection({
  residual,
  manualLines,
  onAdd,
  onUpdate,
  onRemove,
  accounts,
  detailAccounts,
}: {
  residual: number;
  manualLines: WizLine[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<WizLine>) => void;
  onRemove: (key: string) => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}) {
  const total = sumLines(manualLines);
  const balanced = Math.abs(residual + total) < 0.01;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 space-y-3">
      <p className="text-xs font-semibold text-red-700">
        الرصيد المتبقي سالب: {toFixed(residual, 2)}
      </p>
      <p className="text-xs text-red-600">
        الخصوم/الملكية تزيد عن الأصول. أضف بنداً مديناً لموازنة القيد
        (مثال: مسحوبات الشركاء، حساب تسوية، خسارة افتتاحية).
      </p>
      <NegativeManualLinesEditor
        lines={manualLines}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        accounts={accounts}
        detailAccounts={detailAccounts}
      />
      {manualLines.length > 0 && (
        <div className={"rounded-lg p-2 text-xs font-semibold " + (balanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
          {balanced
            ? `متوازن بعد الإضافة — الفرق: ${toFixed(residual + total, 2)}`
            : `الفرق بعد الإضافة: ${toFixed(residual + total, 2)}`}
        </div>
      )}
    </div>
  );
}

// ── Inline editor for negative-residual manual debit lines.
function NegativeManualLinesEditor({
  lines,
  onAdd,
  onUpdate,
  onRemove,
  accounts,
  detailAccounts,
}: {
  lines: WizLine[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<WizLine>) => void;
  onRemove: (key: string) => void;
  accounts: AccountDto[];
  detailAccounts: AccountDto[];
}) {
  return (
    <div className="space-y-2">
      {lines.map((l) => {
        const amountNum = parseFloat(l.amount);
        const amountInvalid = l.amount.trim() !== "" && (Number.isNaN(amountNum) || amountNum <= 0);
        return (
          <AccountLineRow
            key={l.key}
            accountId={l.account_id}
            onAccountChange={(id) => onUpdate(l.key, { account_id: id })}
            amount={l.amount}
            onAmountChange={(amount) => onUpdate(l.key, { amount })}
            onRemove={() => onRemove(l.key)}
            accounts={accounts}
            options={detailAccounts}
            placeholder="ابحث واختر حساب أصل..."
            showErrorMessage={amountInvalid}
          />
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="w-full border-dashed border-red-300 text-red-600 hover:bg-red-50 font-bold"
      >
        + إضافة بند مدين
      </Button>
    </div>
  );
}