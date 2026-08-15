import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { StatusBadge } from "@shared/ui/status-badge";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toLocalDateStr, toFixed } from "@shared/lib/format";
import { WizardShell } from "@modules/opening-balance/components/WizardShell";
import { WizardLineEditor } from "@modules/opening-balance/components/WizardLineEditor";
import {
  useOpeningBalanceWizard,
} from "@modules/opening-balance/hooks/useOpeningBalanceWizard";
import { START_MODE_NEW, START_MODE_EXISTING, type DerivedRow } from "@modules/opening-balance/lib/wizard-types";
import { reconciliationReadiness } from "@modules/opening-balance/lib/migration-labels";
import { ReconciliationStatusBanner } from "@modules/opening-balance/components/ReconciliationStatusBanner";
import { AutoAmountSection } from "@modules/opening-balance/components/AutoAmountSection";
import { InlineBalanceRow } from "@modules/opening-balance/components/InlineBalanceRow";
import { InventorySection } from "@modules/opening-balance/components/InventorySection";
import { ReconciliationRowsTable } from "@modules/opening-balance/components/ReconciliationRowsTable";

export function GuidedTransitionWizard() {
  const w = useOpeningBalanceWizard();
  const isNew = w.startMode === START_MODE_NEW;

  const renderDone = () => (
    <div className="space-y-3">
      <div className={"rounded-lg p-4 text-center " + (isNew || w.migration?.status === "Locked" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
        <p className="text-base font-black">
          {isNew ? "تم بدء المحاسبة بنجاح ✓" : w.migration?.status === "Locked" ? "اكتمل المعالج بنجاح ✓" : "اكتمل المعالج"}
        </p>
        <p className="text-xs mt-1">
          {isNew ? (
            "أول فترة مالية جاهزة — ابدأ تسجيل الحركات اليومية من الصفحات الرئيسية."
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
    </div>
  );

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

      {w.totals.residual !== 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-700">
            الرصيد المتبقي (غير مسجل من النظام السابق): {toFixed(w.totals.residual, 2)}
          </p>
          {w.totals.residual > 0 ? (
            <p className="text-xs text-amber-600">
              يُحسب الرصيد تلقائياً وطبيعته قرار محاسب صريح — لا تُسوّى قسراً. اختر تصنيفاً وحساباً وسيضيف
              المعالج بند موازنة على حساب الرصيد الافتتاحي (53) يعاد تصنيفه بعد الترحيل.
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              الرصيد المتبقي سالب (الخصوم/الملكية تزيد عن الأصول). أضف بنداً يدوياً مديناً (مثال: مسحوبات
              الشركاء أو حساب تسوية) في الخطوات السابقة لموازنة القيد.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select value={w.residualClassification} onValueChange={w.setResidualClassification}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-xs" aria-label="تصنيف الفرق المتبقي">
                <SelectValue placeholder="التصنيف (اختياري)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RetainedEarnings">أرباح مبقاة</SelectItem>
                <SelectItem value="OpeningEquityAdjustment">تعديل حقوق ملكية افتتاحي</SelectItem>
                <SelectItem value="PriorPeriodAdjustment">تعديل فترة سابقة</SelectItem>
                <SelectItem value="OtherEquity">حقوق ملكية أخرى</SelectItem>
                <SelectItem value="UnresolvedDifference">فرق غير محلول</SelectItem>
              </SelectContent>
            </Select>
            <Input
              list="wiz-equity-accounts"
              value={w.residualAccountId}
              onChange={(e) => w.setResidualAccountId(e.target.value)}
              placeholder="حساب حامل الفرق (مثال: 52)"
              aria-label="حساب حامل الفرق"
              className="h-9"
            />
            <datalist id="wiz-equity-accounts">
              {w.detailAccounts.filter((a) => a.account_type === "Equity").map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>
              ))}
            </datalist>
          </div>
        </div>
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
            <div className="space-y-1.5">
              <FieldLabel htmlFor="wiz-start-mode" required>طريقة بدء المحاسبة</FieldLabel>
              <Select value={w.startMode} onValueChange={w.handleStartModeChange}>
                <SelectTrigger id="wiz-start-mode" className="h-9 bg-white border-slate-200 text-xs">
                  <SelectValue placeholder="اختر وضع البدء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={START_MODE_NEW} className="text-xs">شركة جديدة (رأس المال يضاف للصندوق)</SelectItem>
                  <SelectItem value={START_MODE_EXISTING} className="text-xs">شركة قائمة (رصيد افتتاحي بدون خزينة)</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              الأصول الأخرى الباقية (استثمارات، سلف، مصروفات مقدمة...) تُدخل كبنود يدوية.
            </p>
            <WizardLineEditor rows={w.assetsManual} setter={w.setAssetsManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب أصل..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
          </div>
        );
      case 6:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              أرصدة الموردين تُشتق من سجل الموردين ويمكن تعديلها هنا مباشرة.
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
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
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
      case 8:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              رؤوس أموال الشركاء (طبيعة دائن) تُشتق من سجل الشركاء وقابلة للتعديل هنا.
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
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">حقوق ملكية أخرى (يدوي)</div>
              <WizardLineEditor rows={w.equityManual} setter={w.setEquityManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب حقوق ملكية..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            {renderTotalsSummary()}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">سيتم عند «حفظ وفحص التسوية»:</p>
              <p className="text-xs text-slate-500">
                حفظ المسودة (بنود الميزانية) وتفاصيل السجل المساعد ثم فحص تسوية الأرصدة مع دفتر الأستاذ.
                عدد البنود: {w.collectLines().length} ·
                العملاء: {w.derivedAr.length} · الموردون: {w.derivedAp.length} ·
                الأصول الثابتة: {w.faRows.length} · رأس مال الشركاء: {w.partnerEquity.length}
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
          </div>
        );
      case 10:
      case 11:
      case 12: {
        const labels: Record<number, [string, string]> = {
          10: ["التحقق", "تأكيد أن البيانات صحيحة ومكتملة قبل الانتقال للاعتماد. تُجبر هنا تسوية البنود مع دفتر الأستاذ."],
          11: ["الترحيل", "تسجيل قيد الرصيد الافتتاحي في دفتر الأستاذ العام."],
          12: ["القفل", "تثبيت الترحيل نهائياً وصفير رصيد حساب 53 ومنع أي تعديل مستقبلي."],
        };
        const [title, desc] = labels[w.step];
        return (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-xs text-slate-500">{desc}</p>
            <div className="text-xs font-semibold text-slate-600 flex items-center">
              الحالة الحالية:
              {w.migration ? (
                <StatusBadge status={w.migration.status} className="mr-1.5" />
              ) : (
                <span className="text-slate-400 mr-1.5">—</span>
              )}
              {w.migration && w.migration.notes && <span> · {w.migration.notes}</span>}
            </div>
            {w.busy && <p className="text-xs text-blue-600 font-semibold">جارٍ التنفيذ...</p>}
          </div>
        );
      }
      case 13:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              أُقفل الرصيد الافتتاحي. حدّد الآن نافذة أول فترة تشغيلية ستُقيد عليها الحركات الجديدة
              (عادةً من اليوم التالي لتاريخ القطع حتى نهاية السنة). لا يمكن ترحيل أي حركة خارج فترة
              مفتوحة.
            </p>
            <FirstPeriodFields
              start={w.firstPeriodStart}
              end={w.firstPeriodEnd}
              onStart={w.setFirstPeriodStart}
              onEnd={w.setFirstPeriodEnd}
              created={w.firstPeriod}
            />
            {w.firstPeriod ? (
              <div className="rounded-lg p-3 text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                تم إنشاء أول فترة تشغيلية ✓ — يمكنك المتابعة لتسجيل الحركات اليومية.
              </div>
            ) : (
              <p className="text-xs text-slate-400">اضغط «إنشاء أول فترة تشغيلية» لإنشائها ثم تابع.</p>
            )}
          </div>
        );
      case 14:
        return renderDone();
      default:
        return null;
    }
  };

  return (
    <WizardShell
      title={isNew ? "بدء محاسبة شركة جديدة" : "معالج التحويل الموجه (شركة قائمة)"}
      subtitle={isNew
        ? "أنشئ أول فترة مالية وابدأ تسجيل الحركات اليومية — لا يوجد رصيد افتتاحي في هذا الوضع."
        : "جمع الأرصدة قسماً بقسم (نقد وبنوك، عملاء، مخزون، أصول ثابتة، موردون، قروض، شركاء) ثم التحقق والاعتماد والترحيل والقفل ثم إنشاء أول فترة تشغيلية."}
      steps={w.steps}
      stepIndex={w.step}
      canNext={w.canNext}
      canPrev={w.canPrev}
      isNexting={w.busy}
      isFinal={w.step === w.steps.length - 1}
      nextLabel={w.nextLabel}
      onNext={w.handleNext}
      onPrev={() => w.setStep((s) => Math.max(0, s - 1))}
    >
      {renderStep()}
    </WizardShell>
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