import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { StatusBadge } from "@shared/ui/status-badge";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { toFixed } from "@shared/lib/format";
import { Badge } from "@shared/ui/badge";
import { WizardShell } from "@modules/opening-balance/components/WizardShell";
import { WizardLineEditor } from "@modules/opening-balance/components/WizardLineEditor";
import {
  useOpeningBalanceWizard,
  START_MODE_NEW,
  START_MODE_EXISTING,
  type DerivedRow,
} from "@modules/opening-balance/hooks/useOpeningBalanceWizard";
import { RECON_ROW_LABEL } from "@modules/opening-balance/lib/migration-labels";
import { Link } from "react-router-dom";

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
            <>حالة الترحيل النهائية: <StatusBadge status={w.migration?.status || ""} /> — تاريخ القطع: {w.migration?.cutover_date.split("T")[0]}</>
          )}
        </p>
      </div>
      {w.firstPeriod && (
        <div className="rounded-lg p-3 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          أول فترة مالية: {w.firstPeriod.start_date.split("T")[0]} ← {w.firstPeriod.end_date.split("T")[0]}
        </div>
      )}
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

            {w.startMode === START_MODE_NEW && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-blue-700">
                    الشركة تعمل بوضع «شركة جديدة»
                  </p>
                  <p className="text-xs text-blue-600">
                    لا يُنشأ رصيد افتتاحي في هذا الوضع — تبدأ السجلات من الصفر. حدّد نافذة أول فترة
                    مالية (النافذة الزمنية الأولى التي تُقيد عليها الحركات) ثم اضغط «إنشاء الفترة الأولى
                    والبدء».
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

            {w.startMode === START_MODE_EXISTING && (
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
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              رؤوس أموال الشركاء (طبيعة دائن) تُشتق تلقائياً من سجل الشركاء. أضف يدوياً بنود حقوق ملكية
              أخرى فقط (أرباح مبقاة، تعديلات...).
            </p>
            <DerivedRows title="رؤوس أموال الشركاء (مشتقة)" rows={w.partnerEquity} />
            {w.partnerEquity.length === 0 && (
              <p className="text-xs text-slate-400">لا يوجد شركاء برأس مال — أضفهم عبر صفحة «الشركاء ورأس المال» أو أدخل حقوق ملكية يدوياً.</p>
            )}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">حقوق ملكية أخرى (يدوي)</div>
              <WizardLineEditor rows={w.equityManual} setter={w.setEquityManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب حقوق ملكية..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              الذمم المدينة والأصول الثابتة تُشتق من سجل العملاء والأصول الثابتة (طبيعة مدين). أضف يدوياً
              النقد والبنك والأصول الأخرى الباقية فقط.
            </p>
            <DerivedRows title="الذمم المدينة — العملاء (مشتقة)" rows={w.derivedAr} />
            <DerivedRows title="الأصول الثابتة (مشتقة — صافي القيمة الدفترية)" rows={w.derivedFa} />

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">المخزون (معلومات قراءة فقط)</p>
                <span className="tabular-nums text-xs font-bold text-indigo-700">{toFixed(w.inventorySummary.total, 2)}</span>
              </div>
              <p className="text-xs text-slate-500">
                تقييم المخزون الحالي (متاح × متوسط التكلفة) عبر {w.inventorySummary.count} مادة. لا يُدخل
                المخزون عبر هذا المعالج — يُرصد من خلال{" "}
                <Link to="/opening-balance" className="text-blue-600 underline font-semibold">فاتورة أول المدة</Link>
                .
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">بنود أصول يدوية (نقد/بنك/أخرى)</div>
              <WizardLineEditor rows={w.assetsManual} setter={w.setAssetsManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب أصل..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              الذمم الدائنة تُشتق من سجل الموردين (طبيعة دائن). أضف يدوياً الخصوم الأخرى الباقية فقط.
            </p>
            <DerivedRows title="الذمم الدائنة — الموردون (مشتقة)" rows={w.derivedAp} />
            {w.derivedAp.length === 0 && (
              <p className="text-xs text-slate-400">لا توجد أرصدة موردين مستحقة.</p>
            )}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600">بنود خصوم يدوية (قروض/التزامات أخرى)</div>
              <WizardLineEditor rows={w.liabilitiesManual} setter={w.setLiabilitiesManual} updateLine={w.updateLine} placeholder="ابحث واختر حساب التزام..." accounts={w.accounts} detailAccounts={w.detailAccounts} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              معادلة الميزانية: الأصول (A) = الخصوم (L) + حقوق الملكية (E). يجب أن يتوازن الجانبان قبل
              المتابعة — وتُجبر التسوية في خطوة التحقق.
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
                    يُحسب الرصيد تلقائياً وطبيعته قرار محاسب صريح — لا تُسوّى قسراً. اختر تصنيفاً وحساباً
                    وسيضيف المعالج بند موازنة على حساب الرصيد الافتتاحي (53) يعاد تصنيفه بعد الترحيل.
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">
                    الرصيد المتبقي سالب (الخصوم/الملكية تزيد عن الأصول). أضف بنداً يدوياً مديناً
                    (مثال: مسحوبات الشركاء أو حساب تسوية) في الخطوات السابقة لموازنة القيد.
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
                بند موازنة تلقائي على حساب الرصيد الافتتاحي (53): {toFixed(w.totals.plugAmount, 2)} —
                سيعاد تصنيفه بعد الترحيل إلى الحساب المحدد.
              </div>
            )}

            <div className={"rounded-lg p-3 text-sm font-bold " + (w.totals.balanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
              {w.totals.balanced
                ? `متوازن ✓ — مدين ${toFixed(w.totals.debit, 2)} = دائن ${toFixed(w.totals.credit, 2)}`
                : `غير متوازن — فرق ${toFixed(w.totals.debit - w.totals.credit, 2)}`}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              سيتم حفظ المسودة (بنود الميزانية) وتفاصيل السجل المساعد ثم فحص تسوية الأرصدة مع دفتر الأستاذ.
            </p>
            <div className="text-xs font-semibold text-slate-600">
              عدد البنود: {w.collectLines().length} · الذمم المدينة: {w.derivedAr.length} · الذمم الدائنة: {w.derivedAp.length} · الأصول الثابتة: {w.derivedFa.length} · رأس مال الشركاء: {w.partnerEquity.length}
            </div>
            {w.reconciliation && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {w.reconciliation.rows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="font-semibold text-slate-700">
                      {RECON_ROW_LABEL[r.key] || r.key}
                      <StatusBadge
                        status={r.reconciled ? "متطابق" : "فرق"}
                        label={r.reconciled ? "مطابق" : "فرق"}
                        tone={r.reconciled ? "green" : "red"}
                        className="mr-2"
                      />
                    </div>
                    <div className="tabular-nums text-slate-600">
                      السجل المساعد: {toFixed(parseFloat(r.subledger), 2)} ← الأستاذ: {toFixed(parseFloat(r.general_ledger), 2)}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-slate-50">
                  <span className={"font-bold " + (w.reconciliation.all_reconciled ? "text-green-700" : "text-red-600")}>
                    {w.reconciliation.all_reconciled ? "جميع الأرصدة متطابقة ✓" : "يوجد فرق في الأرصدة"}
                  </span>
                  <span className="tabular-nums text-slate-700 font-semibold">
                    رصيد الافتتاح (53): {toFixed(parseFloat(w.reconciliation.opening_control_balance), 2)} · مدين {toFixed(parseFloat(w.reconciliation.debit_total), 2)} / دائن {toFixed(parseFloat(w.reconciliation.credit_total), 2)}
                  </span>
                </div>
                {(() => {
                  const controlZero = parseFloat(w.reconciliation.opening_control_balance) === 0;
                  const readyToPost = w.reconciliation.debit_equals_credit && w.reconciliation.all_reconciled;
                  const readyToLock = readyToPost && controlZero;
                  const blockers = [
                    !w.reconciliation.debit_equals_credit && "القيد غير متوازن",
                    !w.reconciliation.all_reconciled && "الواجهات الفرعية غير مطابقة",
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
      case 6:
      case 7:
      case 8: {
        const labels: Record<number, [string, string]> = {
          6: ["التحقق", "تأكيد أن البيانات صحيحة ومكتملة قبل الانتقال للاعتماد. تُجبر هنا تسوية البنود مع دفتر الأستاذ."],
          7: ["الترحيل", "تسجيل قيد الرصيد الافتتاحي في دفتر الأستاذ العام."],
          8: ["القفل", "تثبيت الترحيل نهائياً وصفير رصيد حساب 53 ومنع أي تعديل مستقبلي."],
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
      case 9:
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
      case 10:
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
        : "جمع أرصدة الميزانية والسجل المساعد من وحدات النظام ثم التحقق والاعتماد والترحيل والقفل ثم إنشاء أول فترة تشغيلية."}
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
          تم إنشاء الفترة: {created.start_date.split("T")[0]} ← {created.end_date.split("T")[0]}
        </div>
      )}
    </div>
  );
}

function DerivedRows({ title, rows }: { title: string; rows: DerivedRow[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{title}</span>
        <span className="tabular-nums text-xs font-bold text-slate-700">
          {toFixed(rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0), 2)}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-1.5">لا توجد بنود مشتقة.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/40">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-2xs bg-blue-50 text-blue-700 border-blue-200">مشتق</Badge>
                <span className="text-2xs font-bold text-slate-400 tabular-nums">{r.account_code || "—"}</span>
                <span className="truncate text-slate-700">{r.label}</span>
              </div>
              <span className="tabular-nums font-semibold text-slate-700">{toFixed(parseFloat(r.amount) || 0, 2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}