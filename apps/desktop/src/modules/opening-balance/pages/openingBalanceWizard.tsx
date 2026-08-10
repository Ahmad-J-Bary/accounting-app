import { Input } from "@shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { StatusBadge } from "@shared/ui/status-badge";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { WizardShell } from "@modules/opening-balance/components/WizardShell";
import { WizardLineEditor, WizardDetailEditor } from "@modules/opening-balance/components/WizardLineEditor";
import { useOpeningBalanceWizard, STEPS } from "@modules/opening-balance/hooks/useOpeningBalanceWizard";
import { RECON_ROW_LABEL } from "@modules/opening-balance/lib/migration-labels";

export default function OpeningBalanceWizard() {
  const {
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
    nextLabel,
    handleNext,
  } = useOpeningBalanceWizard();

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              أدخل بيانات الترحيل: النظام السابق الذي صدرت منه الأرصدة وتاريخ القطع.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <WizardLineEditor rows={assets} setter={setAssets} updateLine={updateLine} placeholder="ابحث واختر حساب أصل..." accounts={accounts} detailAccounts={detailAccounts} />
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">أرصدة الخصوم من الميزانية القديمة (طبيعة دائن).</p>
            <WizardLineEditor rows={liabilities} setter={setLiabilities} updateLine={updateLine} placeholder="ابحث واختر حساب التزام..." accounts={accounts} detailAccounts={detailAccounts} />
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">حقوق الملكية — رؤوس أموال الشركاء والأرباح المبقاة (طبيعة دائن).</p>
            <WizardLineEditor rows={equity} setter={setEquity} updateLine={updateLine} placeholder="ابحث واختر حساب حقوق ملكية..." accounts={accounts} detailAccounts={detailAccounts} />
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">
                تصنيف الفرق المتبقي (رصيد غير مسجل من النظام السابق):
              </p>
              <p className="text-xs text-amber-600">
                يُحسب الرصيد المتبقي تلقائياً بعد إدخال الخطوط، وطبيعته قرار محاسب صريح — لا تُسوّى قسراً.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Select value={residualClassification} onValueChange={setResidualClassification}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs">
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
        return <WizardDetailEditor rows={arRows} setter={setArRows} updateDetail={updateDetail} referenceLabel="مرجع/اسم العميل" withQty={false} />;
      case 5:
        return <WizardDetailEditor rows={apRows} setter={setApRows} updateDetail={updateDetail} referenceLabel="مرجع/اسم المورد" withQty={false} />;
      case 6:
        return <WizardDetailEditor rows={invRows} setter={setInvRows} updateDetail={updateDetail} referenceLabel="معرف المادة" withQty />;
      case 7:
        return <WizardDetailEditor rows={faRows} setter={setFaRows} updateDetail={updateDetail} referenceLabel="معرف الأصل الثابت" withQty={false} />;
      case 8:
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              معادلة الميزانية: الأصول (A) = الخصوم (L) + حقوق الملكية (E). يجب أن يتوازن الجانبان قبل المتابعة.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
                <div className="text-xs font-semibold text-blue-700">الأصول (مدين)</div>
                <div className="text-xl font-black tabular-nums text-blue-700">
                  {totals.debit.toFixed(2)}
                </div>
              </div>
              <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
                <div className="text-xs font-semibold text-emerald-700">الخصوم (دائن)</div>
                <div className="text-xl font-black tabular-nums text-emerald-700">
                  {liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                </div>
              </div>
              <div className="border border-slate-100 rounded-lg p-3 space-y-1 bg-white">
                <div className="text-xs font-semibold text-indigo-700">حقوق الملكية (دائن)</div>
                <div className="text-xl font-black tabular-nums text-indigo-700">
                  {equity.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toFixed(2)}
                </div>
              </div>
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
                      {RECON_ROW_LABEL[r.key] || r.key}
                      <StatusBadge
                        status={r.reconciled ? "متطابق" : "فرق"}
                        label={r.reconciled ? "مطابق" : "فرق"}
                        tone={r.reconciled ? "green" : "red"}
                        className="mr-2"
                      />
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
        <div className="flex flex-col h-full overflow-auto p-4 gap-4">
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