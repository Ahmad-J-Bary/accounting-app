# خطة تحويل المشروع إلى معمارية Tauri + Rust + React

## نظرة عامة
تحويل تطبيق الويب React الحالي إلى تطبيق سطح مكتب باستخدام Tauri مع Rust backend و React frontend، وفق معمارية Clean Architecture متعددة الطبقات.

## المبادئ الأساسية
- **اتجاه الاعتمادية**: Domain ← Application ← Infrastructure ← Tauri Adapter ← React UI
- **الطبقات الخارجية تعتمد على الداخلية** — لا العكس
- **Domain مستقل تمامًا** عن أي شيء خارجي
- **src-tauri جسر رقيق** — لا منطق أعمال
- **React للعرض فقط** — تستهلك commands عبر DTOs

---

## المرحلة 1: إعداد هيكل Rust Workspace

### 1.1 إنشاء Cargo.toml الجذري
- إنشاء ملف `Cargo.toml` في جذر المشروع
- تعريف workspace مع جميع crates
- إعداد workspace dependencies المشتركة
- تكوين profile.release للتحسين

### 1.2 إنشاء هيكل crates/core-domain
- إنشاء مجلد `crates/core-domain`
- إنشاء `Cargo.toml` بدون تبعيات على Tauri/React
- إنشاء هيكل المجلدات: `src/shared/`, `src/accounting/`, `src/sales/`, `src/inventory/`

### 1.3 إنشاء كيانات Domain
- إنشاء `Invoice` مع قواعد الثبات
- إنشاء `Account` و `JournalEntry`
- إنشاء `Product` و `StockMovement`
- إضافة unit tests لكل كيان

### 1.4 إنشاء Value Objects
- إنشاء `Money` مع العمليات الحسابية
- إنشاء `Quantity` مع التحقق
- إنشاء Strong-typed IDs: `InvoiceId`, `AccountId`, `ProductId`
- إنشاء `DomainError` للأخطاء

---

## المرحلة 2: إعداد طبقة Application

### 2.1 إنشاء هيكل crates/core-application
- إنشاء مجلد `crates/core-application`
- إنشاء `Cargo.toml` مع تبعية على core-domain
- إنشاء هيكل: `src/ports/`, `src/use_cases/`, `src/dto/`

### 2.2 تعريف Ports (Traits)
- إنشاء `InvoiceRepository` trait
- إنشاء `CustomerRepository` trait
- إنشاء `ProductRepository` trait
- إنشاء `UnitOfWork` trait

### 2.3 تنفيذ Use Cases
- إنشاء `CreateInvoiceUseCase`
- إنشاء `PostInvoiceUseCase`
- إنشاء `CreateJournalEntryUseCase`
- إنشاء `ListInvoicesUseCase`
- إضافة unit tests مع Mock repositories

---

## المرحلة 3: إعداد طبقة Infrastructure

### 3.1 إنشاء هيكل crates/core-infrastructure
- إنشاء مجلد `crates/core-infrastructure`
- إنشاء `Cargo.toml` مع تبعيات: sqlx, tokio
- إنشاء هيكل: `src/db/`, `src/repositories/`, `src/http/`

### 3.2 تنفيذ SQLite Repositories
- إنشاء `SqliteInvoiceRepository`
- إنشاء `SqliteCustomerRepository`
- إنشاء `SqliteProductRepository`
- تنفيذ جميع Ports من Application layer

### 3.3 إعداد Database Migrations
- إنشاء مجلد `migrations/`
- إنشاء schema SQL: invoices, customers, products, journal_entries
- إعداد connection pool

---

## المرحلة 4: إعداد Tauri Adapter

### 4.1 تهيئة مشروع Tauri
- تثبيت Tauri CLI: `cargo install tauri-cli`
- تهيئة Tauri: `cargo tauri init`
- تكوين `tauri.conf.json`
- إعداد `beforeDevCommand` و `beforeBuildCommand`

### 4.2 إنشاء طبقة Commands
- إنشاء هيكل `src-tauri/src/commands/`
- إنشاء `invoice.rs` مع `create_invoice` command
- إنشاء `customer.rs` مع `list_customers` command
- تسجيل commands في `invoke_handler`

### 4.3 تنفيذ DI Container
- إنشاء `src-tauri/src/bootstrap/container.rs`
- ربط Ports بـ Implementations
- إنشاء `AppState` مع جميع repositories
- إعداد `build_app_state()` function

---

## المرحلة 5: إعداد shared-types Package

### 5.1 إنشاء packages/shared-types
- إنشاء مجلد `packages/shared-types`
- إنشاء `package.json` و `tsconfig.json`
- إضافة إلى pnpm workspace

### 5.2 تعريف TypeScript DTOs
- إنشاء `invoice.ts` مع `InvoiceDto`, `CreateInvoiceRequest`
- إنشاء `customer.ts` مع `CustomerDto`
- إنشاء `product.ts` مع `ProductDto`
- إنشاء `index.ts` لـ exports

---

## المرحلة 6: ترحيل React UI

### 6.1 إنشاء Services Wrappers
- إنشاء `src/services/invoiceService.ts`
- إنشاء `src/services/customerService.ts`
- استخدام `invoke()` من `@tauri-apps/api/core`
- إضافة type safety من shared-types

### 6.2 تحديث الصفحات لاستخدام Commands
- تحديث `Dashboard.tsx` لاستخدم invoice commands
- تحديث `InvoiceDetail.tsx` لاستخدم Tauri
- تحديث `CustomerDetail.tsx` لاستخدم Tauri
- إزالة أي API calls مباشرة

### 6.3 إعداد Tauri Provider
- إنشاء `src/app/providers/TauriProvider.tsx`
- إعداد event listeners من Rust
- معالجة الأخطاء من commands

---

## المرحلة 7: إظام Build System

### 7.1 تكوين Turbo
- إنشاء `turbo.json` في جذر المشروع
- تعريف tasks: dev, build, lint, test
- إعداد dependency caching

### 7.2 تكوين pnpm Workspace
- إنشاء `pnpm-workspace.yaml`
- إضافة `apps/desktop` و `packages/*`
- تحديث `package.json` الجذري

### 7.3 تكوين Cargo Workspace
- تحديث `Cargo.toml` الجذري
- إضافة جميع crates إلى members
- إعداد workspace dependencies

---

## المرحلة 8: الاختبار

### 8.1 كتابة Domain Unit Tests
- إضافة `#[cfg(test)]` modules في core-domain
- اختبار قواعد الثبات (invariants)
- اختبار Value Objects

### 8.2 كتابة Application Tests
- إنشاء Mock repositories
- اختبار Use Cases بالكامل
- اختبار معالجة الأخطاء

### 8.3 كتابة Integration Tests
- اختبار SQLite repositories
- اختبار Tauri commands
- E2E tests مع Playwright

---

## شجرة المشروع النهائية

```
repo/
├─ apps/
│  └─ desktop/
│     ├─ src/                      # React UI
│     │  ├─ app/
│     │  ├─ pages/
│     │  ├─ features/
│     │  ├─ components/
│     │  ├─ hooks/
│     │  ├─ store/
│     │  ├─ services/              # Tauri invoke wrappers
│     │  ├─ i18n/
│     │  └─ styles/
│     ├─ src-tauri/                # Tauri host
│     │  ├─ Cargo.toml
│     │  ├─ tauri.conf.json
│     │  └─ src/
│     │     ├─ main.rs
│     │     ├─ lib.rs
│     │     ├─ commands/
│     │     ├─ state/
│     │     ├─ events/
│     │     └─ bootstrap/
│     └─ package.json
├─ packages/
│  ├─ ui-kit/
│  ├─ shared-types/                # TS DTOs
│  ├─ form-utils/
│  └─ config/
├─ crates/
│  ├─ core-domain/                 # pure business entities
│  ├─ core-application/            # use cases + ports
│  ├─ core-infrastructure/         # SQLite impls
│  ├─ accounting/
│  ├─ inventory/
│  ├─ sales/
│  ├─ purchases/
│  ├─ payments/
│  ├─ reporting/
│  └─ auth/
├─ Cargo.toml
├─ pnpm-workspace.yaml
├─ package.json
├─ turbo.json
└─ README.md
```

---

## قواعد صارمة

1. **ابدأ من Rust** — لا تبدأ بواجهة React قبل اكتمال Domain + Application
2. **لا business logic في React** — الواجهة للعرض فقط
3. **لا API calls في الواجهة** — استخدم services wrappers
4. **src-tauri رقيق** — commands, state, bootstrap فقط
5. **التواصل عبر commands فقط** — لا وصول مباشر لـ Rust
6. **الواجهة تستخدم DTOs فقط** — لا أنواع Rust الداخلية
7. **Infrastructure قابلة للتبديل** — عبر Ports
8. **Domain مستقل تمامًا** — لا تبعيات خارجية
9. **الأولوية للاختبار** — فصل الطبقات وتقليل الاعتماديات
10. **React آخر طبقة** — فوق منظومة Rust مكتملة

---

## ترتيب التنفيذ

1. **Phase 1**: Rust workspace + core-domain
2. **Phase 2**: Application layer (use cases + ports)
3. **Phase 3**: Infrastructure layer (SQLite)
4. **Phase 4**: Tauri adapter (commands)
5. **Phase 5**: shared-types (DTOs)
6. **Phase 6**: React UI migration
7. **Phase 7**: Build system (Turbo + pnpm)
8. **Phase 8**: Testing
