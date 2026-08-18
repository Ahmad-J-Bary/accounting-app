# PHASE 1 — مراجعة نطاق ما بعد إقفال حقوق الملكية / الفترات (Post-Lock Equity & Period-Closing Audit)

> قراءة فقط (Phase 1 of the follow-up task): consolidated findings over the
> post-lock equity model — Opening Balance Equity (53), retained earnings (52),
> partner capital/current, period closing and profit distribution — with exact
> `file:line` references. Decision scope: **implemented items 4–5** below;
> items E/F are flagged and deferred.

---

## A. منطق صحيح — يُحتفظ به كما هو

- **المسحوبات ليست مصاريف أبداً** — `compute_ledger_totals` يستبعد حسابات المسحوبات عبر
  `is_drawings_account()` وبنود غير المرحّلة (`crates/application/src/use_cases/opening_balance/net_profit.rs:119-135`)
  مع اختبارات دفاعية للحساب المصفَّف خطأً كنفقات (258-287) والانعكاسات (228-235). مسار الفترة يستخدم
  نفس المجمّع (`crates/application/src/use_cases/fiscal_period/net_profit.rs:62`).
- **توزيع الأرباح يُقيّد على الحساب الجاري للشريك لا على رأس المال**
  (`crates/application/src/use_cases/opening_balance/allocate.rs:236-255`) والأرباح المبقاة (52) هي وعاء الموازنة (270-274).
- **التوزيع ذاتي الإغلاق (idempotent)** عبر `profit_distribution:{id}` + قيد UNIQUE في قاعدة البيانات
  (`allocate.rs:154-157`، الإعادة عبر `dto_from_existing` 302-348).
- **إقفال الفترة ذاتي الإغلاق على مستوى API** (`crates/application/src/use_cases/fiscal_period/close.rs:34-39`)
  والدومين يرفض الإغلاق المزدوج (`crates/domain/src/accounting/fiscal_period.rs:103-120`)؛ والقفل نهائي
  لا يُعاد فتحه (141-159).
- **بوابة الاستعداد مشتركة**: `readiness_blockers` (`crates/application/src/use_cases/opening_balance/reconcile.rs:113-135`)
  تقود التحقق/الترحيل/القفل؛ و`require_control_zero` للقفل فقط — مطابقة لقرار P0 (الرصيد المصنَّف صالح مع 53≠0؛ القفل يتطلب 53=0).
- **الأرباح المبقاة ائتمانية الطبيعة وتُحتسب من المرحّل فقط**
  (`crates/application/src/use_cases/fiscal_period/distributable.rs:96-119`، اختبارات 180-201).
- **المركز (Position) لا يعدّ حقوق الملكية مرتين** (`position.rs:285-299`، اختبارات 592-632).

## B. منطق ناقص — معالَج جزئياً في هذه المرحلة

- **B1 ✅** — الحساب الهدف لتصنيف الرصيد المتبقي لم يكن مُتحكَّماً فيه بالغرض/النوع. أُضيف حارس:
  `AccountPurpose::is_residual_classification_target()` (`crates/domain/src/accounting/account.rs:76-90`)
  والفحص في `SetResidualClassificationUseCase` (`classify.rs`) ودفاعياً في `ApplyResidualToLedgerUseCase`
  (`residual_apply.rs:78-96`). الهدف المسموح: نوعه Equity وغرضه من {أرباح مبقاة، رصيد افتتاحي، عام، جاري شريك}.
  مرفوض: الأصول/المصاريف/رأس المال المسجّل/الذمم. اختبارات: `crates/infrastructure/tests/residual_target_purpose_guard.rs`.
- **B2** — التصنيف ليس شرطاً مسبقاً للتحقق/الترحيل في الـ API (الواجهة فقط تُجبره)؛ قرار P0 متعمَّد — تُوثَّق، لا تُغيَّر.
- **B3** — إقفال الفترة وقفلها لا يمسّان الدفتر (لا قيد إقفال، لا حارس أن حسابات قائمة الدخل صفر)؛ المرجأ — انظر E.
- **B4 ✅** — القفل كان يحوّل الحالة إلى `Locked` قبل فحص البوابة داخل الذاكرة. جرت إعادة الترتيب: البوابة أولاً ثم
  `migration.lock()` ثم الحفظ (`crates/application/src/use_cases/opening_balance/state.rs:109-138`). اختبار:
  فشل القفل يبقي الحالة `Posted` — `crates/infrastructure/tests/opening_lock_obe_clearance.rs`.
- **B5** — `unlock()` موجود في الدومين بلا use case موصول — سطح ميت، خارج نطاق التغيير الآمن حالياً.

## C. منطق مكرر — معالَج جزئياً

- **C1 ✅** — صافي حساب 53 كان محسوباً مرتين (`residual_apply.rs` + `reconcile.rs`). أُنشئ
  `crates/application/src/use_cases/opening_balance/obe.rs` مع `obe_control_net()` و`opening_source_id()/residual_source_id()`
  و`OPENING_EQUITY_ACCOUNT_CODE` وأُعيد استخدامها في `residual_apply.rs` و`reconcile.rs`.
- **C2 ✅** — ثابت `53` المكرر أُعيد توحيده في `obe.rs`.
- **C3** — وسيط `profit_distribution:` أُعيد استخدامه كاسم ثابت `AUTH_ALLOCATION_SOURCE_PREFIX`
  (`fiscal_period/types.rs:3`) في `allocate.rs:154` و`distributable.rs:77`. الغلاف `period_ledger_totals`
  (~no-op) أُبقِيَ طفيفاً.
- **C4** — مرآة الـ TS في `derive-opening-snapshot.ts` و`migration-labels.ts` مقبولة كمرآة رقيقة؛ الجذر
  الذي سبّب P0 (إعادة الدخول بدون ترطيب `migration/reconciliation`) عولج في جلسة سابقة بحقن الترطيب.

## D. تناقضات محاسبية

- **D1 ✅ (جزئياً)** — 53 حساب دائم في شجرة الحسابات يعرض في ميزان المراجعة، وفي الميزانية ضمن حقوق الملكية.
  بعده nets إلى صفر بعد التطبيق. الاختبار `opening_lock_obe_clearance.rs` يثبت أن موضع 53 في الدفتر كله = 0
  بعد التطبيق+القفل. حارس تقديم يُخفي صفر العبور في القوائم العادية **مرجأ** (قرار منتج).
- **D3 ✅** — الموضع (Position) لم يكن يُنبّه API الخارجية أن 53 معلّقٌ لم يُصفَّر حتى على ترحيل متوازن. أضيف
  `obe_pending_reclassification` إلى DTO (`position.rs:87-93, 326-329`) ومرآتها في `packages/shared-types/src/opening_balance.ts`.

## E. حسابات مؤقتة تبقى دائمة — غير معالَجة (مرجأة، قرار منتج)

لا يوجد في أي مكان قيد إقفال/ترحيل رياضي (carry-forward) من قائمة الدخل إلى الأرباح المبقاة؛
صافي الربح دائماً إسقاط نافذة زمنية (`fiscal_period/net_profit.rs` + `incomeStatement.ts`) وليس رصيداً محققاً بالدفتر.
معالجة كاملة = خطوة إقفال فترة تسجّل P&L → 52 (أو رصيد دائم محقق يومي) + تفضيل الأرباح المبقاة المحققة في الميزانية.

## F. سلوك الأرباح المبقاة ورأس المال/التوزيع — ناقص (مرجأ)

- **F1** — لا يوجد توزيع أرباح ربطاً بفترة مالية؛ `AllocateNetProfitUseCase` مربوط بالترحيل الافتتاحي فقط
  (الوصل: `crates/tauri-adapter/src/commands/opening_balance.rs:82`). `distributable.rs` يحيل إلى «أمر منفصل (Sec22)»
  غير موجود. مطلوب عند الحاجة: use case توزيع موصول بفترة (`profit_distribution:{period_id}`).
- **F2** — الأرباح المبقاة تتغير فقط عبر قيود صريحة (توزيع/تصنيف)؛ متّسق مع «لا تغيير صامت»، ويجب تثبيته باختبار.

---

## ما نُفِّذ في هذه المرحلة (Items 1–5)

1. **حارس غرض حساب التصنيف** (B1) — دومين + classify + residual_apply + اختبارات.
2. **ترتيب فحص القفل** (B4) — البوابة قبل التحويل؛ اختبار «الفشل يبقي Posted».
3. **توحيد حساب 53** (C1/C2) — `obe.rs` المشترك عبر residual_apply/reconcile + ثابت التوزيع الموحَّد.
4. **إشارة `obe_pending_reclassification`** في DTO (D3) + نوع الـ TS.
5. **اختبارات انحدار** — `residual_target_purpose_guard.rs` (4) و`opening_lock_obe_clearance.rs` (2).

## التحقق

- `cargo test -p domain -p application` — 152 تمريراً.
- `cargo test -p infrastructure` — كل الاختبارات (بما فيها 6 الجديدة) تمر.
- الواجهة: `pnpm --filter desktop test` / `lint` / `build` (أُجريت بعد المراجعات أعلاه).