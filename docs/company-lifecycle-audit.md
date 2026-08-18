# PHASE 1 — تدقيق «إنشاء الشركة ودورة الحياة» (قراءة فقط)

التاريخ: 2026-08-15
الحالة: **PASS** — اكتمل التدقيق ولم يُنفَّذ أي تعديل.

## 0. الإجابة المباشرة على الأسئلة العشرة

1. **أين تُنشأ الشركة؟** لا يوجد جدول/كيانات `companies`. «الشركة» عمليًا صف واحد في جدول `settings` يُزرع في الترحيل (`crates/infrastructure/src/db/migrations/002_full_schema.sql:208-231`). «إنشاء» هوية الشركة يتم عبر معالج `/setup` (`apps/desktop/src/modules/core/setup/pages/setupWizard.tsx`). **لا يوجد أمر backend لإنشاء شركة.**
2. **أين تُحفظ بيانات الشركة؟** في أعمدة جدول `settings` (company_name, currency, currency_symbol, tax_rate, prefixes, fiscal_year_start_month, accounting_start_mode, warehouse ids…). Domain: `crates/domain/src/settings/company_settings.rs`. Repo: `crates/infrastructure/src/repositories/settings`. Use cases: `crates/application/src/use_cases/settings/{queries,update}.rs`. العملة في جدول `currencies` بعلم `is_base`.
3. **كيف يعرف التطبيق الشركة الحالية؟** تطبيق أحادي الشركة — لا company id وقت التشغيل؛ كل use case يستدعي `settings_repo.get()` بقراءة DB جديدة بلا cache. الواجهة تجلب الإعدادات مباشرة وتعرض `company_name` في الـ TopBar (`apps/desktop/src/app/shell/TopBar.tsx:340`).
4. **هل يوجد company type؟** **لا enum.** String في `settings.accounting_start_mode` بقيمتين: `"NewCompany"` (افتراضي) / `"ExistingCompanyMigration"`. الثوابت في `opening_balance/create.rs:16-17` و`wizard-types.ts:9-10`. خطر: `partner/create.rs:37,86` يستقبل الوضع من العميل ويقارنه بنص حرفي.
5. **هل يوجد initialization/onboarding state؟** ثلاث بوابات بدء مكررة: `modules/auth/pages/index.tsx:9-22` (`/`)، `setupWizard.tsx:25-33`، و`CurrencyProvider.tsx:67-71`. لا حالة «اكتمل الإعداد» حقيقية؛ المتغيّر المُرسَل بقاء اسم الشركة `'شركتي'`. **اختيار السيناريو ليس في الإعداد** بل داخل معالج `GuidedTransitionWizard.tsx:131-140`.
6. **أين يُحدَّد ظهور Opening Balance؟** `/opening-balance-migration` (`apps/desktop/src/app/router/ErpRoutes.tsx:88`) وبند السايد بار (`app/shell/routeRegistry.ts:19`) **ظاهران دائمًا بلا أي شرط start_mode**. الفرع الوحيد داخل المعالج. ويوجد مفهومان متوازيان: فاتورة «أول المدة» للمخزون `/opening-balance` مقابل معالج شركة قائمة `/opening-balance-migration`.
7. **أين تُنشأ الحسابات؟** الواجهة: `modules/accounting/chart-of-accounts/pages/accounting.tsx` + `AccountDetailsSidebar.tsx` → `accountingService.createAccount` → `crates/application/src/use_cases/account/create.rs`. مخطط الحسابات يُنشأ إعلانيًا عبر ترحيلات SQL (007/010/011/013/036/037/042/148) + إصلاحات Rust عند الإقلاع في `crates/infrastructure/src/db/pool.rs:99-208`.
8. **أين تُنشأ الكيانات الأخرى؟** الشركاء: `modules/partners/pages/partners.tsx` → `partner/create.rs`. العملاء/الموردون: `modules/partners/pages/PartyPage.tsx` + `PartnerFormPanel` → `customer/create.rs`, `supplier/create.rs`. المواد: `modules/inventory/pages/materials.tsx` → `materialService.create` (ومضمّنة أيضًا في `openingBalance.tsx:185-198`). الأصول: `modules/fixed-assets/pages/fixedAssets.tsx` → `fixedAssetService.create`. المستودعات: `warehouseService.ensureDefaultWarehouse` (تصنع «مستودع {اسم الشركة}» عند كل mount للـ shell). الكيانات تحترم «نافذة الفتح» (أرصدة ثابتة بلا قيد أثناءها).
9. **أين يُبنى navigation؟** سجل مركزي: `app/shell/routeRegistry.ts` (`ALL_SYSTEM_ROUTES` + `SYSTEM_ROUTE_GROUPS`) → `sidebarConfig.ts:37-48` → `useSidebarLayout` → `Sidebar.tsx`/`TopBar.tsx`. جدول الروتات المركزي: `app/router/ErpRoutes.tsx`. **لا بوابات based على start_mode في الـ nav.**
10. **أين توجد شروط الشركة القائمة؟** Backend: `opening_balance/create.rs:34-40`، `opening_balance/guard.rs:36-46` (`opening_window_active()`)، `account/create.rs:102-115,171`، `unified_invoice/post.rs:194-195,770-791`، `partner/create.rs`، `partner/contribution.rs:51-56`، `customer/supplier create/update`. Frontend: `GuidedTransitionWizard` (`isNew`)، `useOpeningBalanceWizard` (steps/queries/runStep)، و`modules/partners/pages/partners.tsx:59-105`.

## 1. Current Company Creation Flow
ترحيل DB يُنشئ `settings` بصف `'default'` باسم «شركتي» وعملة `SAR` ← معالج `/setup` يملأ الاسم + العملة الأساسية/الثانوية + القيود الافتراضية ← `/dashboard`. لا عنصر تحكم «أي سيناريو» هنا؛ يُختار السيناريو لاحقًا داخل wizard الشركة القائمة.

## 2. Current Company State Model
`settings` (صف واحد) = بيانات الشركة + `accounting_start_mode` (String). `currencies` (is_base) = العملة. لا context كائن في AppState/React — قراءة DB في كل طلب. `company_id: Option<String>` في fiscal_period/opening_balance لكنه دائمًا `None` (تعليق: للحساب الأحادي حاليًا).

## 3. Current Opening Flow
صفحة ثابتة الظهور فيها 4 تبويبات: معالج/قائمة ترحيلات/موقف/توزيع. المعالج: New = خطوتان (إنشاء أول فترة)؛ Existing = 15 خطوة (قطع→أرصدة→…→تحقق→ترحيل→قفل→أول فترة) مع Summary + Checklist. Backend lifecycle: Draft→Validated→Approved→Posted→Locked + نافذة فتح توقف القيود المباشرة حتى الإقفال.

## 4. Current Navigation Logic
سجلان: `routeRegistry.ts` (nav) + `ErpRoutes.tsx` (routes). كل البنود ظاهرة دائمًا. بنود يتيمة (groupId `""`)، بنود مكررة للتقارير، روابط ميتة (`/inventory/reports/valuation`, `/low-stock`)، مسار مكرر (`/accounting/reports/ledger` و`/movements` → نفس المكوّن)، ومكوّنات Sidebar ميتة.

## 5. Current Account Creation Flow
SQL seeds → إنشاء المستخدم عبر صفحة دليل الحسابات → `account/create.rs`: أثناء نافذة الفتح يجبر أرصدة صفرية ويمنع قيد فتح الحساب (يتوازن مع `"53"`)، وبعد الفتح يُنشئ قيد فتح مقابل 53.

## 6. Current Problems
- **(P1)** لا كيان/نوع شركة؛ السيناريو String سائب، و`partner/create.rs` يستقبله من العميل بنص حرفي.
- **(P2)** خيار السيناريو داخل wizard الفتح لا في نقطة إنشاء الشركة، والصفحة/البند ظاهران دائمًا حتى في NewCompany، ويمكن تبديل الوضع في منتصف التشغيل.
- **(P3)** تكرار بدء ×3 + sentinel `'شركتي'` + 10+ قراءات `getSettings()` مباشرة (بلا cache) + hook ميت `useCompanySettings` + CustomEvent بدل invalidateQueries + 4 نماذج تعيد إرسال الإعدادات كاملة.
- **(P4)** فترات مالية معزولة عن حراسة الترحيل (`can_post` غير مستعمل في journal/invoice) — لا gate بالتاريخ.
- **(P5)** عملة/قاعدة غير متسقة: `"SAR"` ثابت في `opening_balance/post.rs:64`، fallback `"USD"`، `settings.base_currency_code` عرضي فقط vs `currencies.is_base`.
- **(P6)** كود الحسابات المعروفة مكرر: `"53"` في 7 مواضع + أدوات default-account مكررة.
- **(P7)** مفاهيم «فتح» متوازيتان (فاتورة أول المدة للمخزون vs ترحيل شركة قائمة).
- **(P8)** إعدادات write-only (`purchase_warehouse_id`/`sales_warehouse_id`/`fiscal_year_start_month`) + تكرار nav/status-badge.

## 7. Recommended Minimal Architecture (للمرحلة التالية — لم تُنفَّذ تنفيذًا للتعليمة)
1. توحيد مفهوم السيناريو: ثابت مشترك واحد يُقرأ من `settings` لا من العميل في `partner/create.rs`.
2. جعل `/setup` نقطة تحديد السيناريو (New/Existing أولًا)، ثم توجيه Existing لإكمال أرصدة الفتح، وNew مباشرة لأول فترة.
3. دمج البوابات الثلاث في بوابة/state موحّد + تفعيل `QUERY_KEYS.settings` invalidation + إزالة CustomEvent + إصلاح/استخدام `useCompanySettings`.
4. ربط ظهور فتح الأرصدة بالسيناريو: إخفاء تبويب/بند `opening-balance-migration` في New، ومنع تبديل الوضع بعد الترحيل.
5. مركزة الأكواد الشهيرة والعملة الأساسية وإصلاح `"SAR"` الثابت (P5/P6).
6. لاحقًا: ربط الفترات المالية بحارس الترحيل (P4).