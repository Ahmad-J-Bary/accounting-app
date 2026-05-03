# المواكب · Almowakeb

[![CI](https://github.com/Ahmad-J-Bary/accounting-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Ahmad-J-Bary/accounting-app/actions/workflows/ci.yml)
[![Release](https://github.com/Ahmad-J-Bary/accounting-app/actions/workflows/release.yml/badge.svg)](https://github.com/Ahmad-J-Bary/accounting-app/actions/workflows/release.yml)

نظام محاسبة وتخطيط موارد مؤسسات (ERP) محلي صغير-متوسط، يعمل كتطبيق سطح مكتب أصلي عبر [Tauri 2](https://tauri.app/)، مكتوب بـ Rust في الخلفية وReact + TypeScript في الواجهة. مصمَّم للسوق العربي (واجهة RTL، عملات متعددة، ترميز محلي) ولكنه يدعم الإنجليزية أيضًا.

> A local desktop ERP / accounting app for Arabic-speaking SMBs, built with **Tauri 2 + Rust + React + TypeScript** following Clean Architecture.

---

## المحتويات

- [الميزات الرئيسية](#الميزات-الرئيسية)
- [البنية المعمارية](#البنية-المعمارية)
- [بنية المستودع](#بنية-المستودع)
- [المتطلبات](#المتطلبات)
- [التشغيل المحلي](#التشغيل-المحلي)
- [البناء](#البناء)
- [الاختبار والتدقيق](#الاختبار-والتدقيق)
- [CI/CD](#cicd)
- [الإصدار](#الإصدار)
- [المساهمة](#المساهمة)
- [الترخيص](#الترخيص)

---

## الميزات الرئيسية

- **محاسبة كاملة**: شجرة حسابات هرمية، قيود يومية مزدوجة القيد، حسابات مساعدة (أصول/التزامات/حقوق ملكية/إيرادات/مصاريف)، عملات متعددة مع سعر الصرف.
- **فواتير موحَّدة**: نوع `UnifiedInvoice` يجمع فواتير المبيعات والمشتريات وأرصدة افتتاحية، مع طرق دفع (نقد/آجل/جزئي) وقابلية عكس الفاتورة (`reversal workflow`).
- **مخزون متقدم**: مواد بوحدات قياس متعددة (`MaterialUnit` بمعاملات تحويل)، حركات مخزون، أوامر إنتاج، تسويات، عناصر تالفة، مخزون افتتاحي.
- **عملاء، موردون، شركاء**: مع ربط تلقائي بحسابات شجرة الحسابات وأرصدة افتتاحية.
- **مدفوعات** مع دعم تخصيص جزئي لفواتير متعددة.
- **أصول ثابتة ومستهلكات**: مع إهلاك دوري، حركات أصول، فئات.
- **صلاحيات وأدوار**: مستخدمون وأدوار قابلة للتخصيص (`Roles & Permissions`).
- **تدقيق**: سجل عمليات (`AuditLog`) لكل تغيير حساس.
- **واجهة عربية RTL** مع دعم الإنجليزية، تبويبات متعددة، اختصارات لوحة مفاتيح، بحث عام، شجرة حسابات تفاعلية، ومعاينة مستندات.
- **دقّة مالية صارمة** عبر [`rust_decimal`](https://docs.rs/rust_decimal) — لا تُستخدم أعداد عائمة (floats) في حسابات المال.
- **تطبيق سطح مكتب أصلي** عبر Tauri 2: حجم صغير، أداء عالٍ مقارنة بـ Electron، تخزين محلي بـ SQLite.

## البنية المعمارية

يتبع المشروع **Clean Architecture / Hexagonal (Ports & Adapters)** بصرامة:

```
┌─────────────────────────────────────────────────────────────┐
│  apps/desktop/src/  (React + TypeScript + Vite + shadcn/ui) │
└────────────────────────────┬────────────────────────────────┘
                             │ tauri::invoke
┌────────────────────────────▼────────────────────────────────┐
│  crates/tauri-adapter      (Tauri commands + DI bootstrap)  │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  crates/application        (use cases + DTOs + ports)       │
└──────────────┬──────────────────────────────────┬───────────┘
               │                                  │
┌──────────────▼─────────────┐    ┌───────────────▼──────────┐
│  crates/domain             │    │  crates/infrastructure   │
│  (entities + biz rules)    │    │  (SQLite via SQLx)       │
└────────────────────────────┘    └──────────────────────────┘
```

- **`domain`**: لا تعرف عن SQL ولا عن Tauri ولا عن أي إطار عمل. `Account`, `JournalEntry`, `UnifiedInvoice`, `Material`, `Money`, `Currency`, `MaterialId` (newtype IDs)، إلخ.
- **`application`**: تعرف فقط `ports` و`domain`. كل ميزة لها `*UseCase` (مثل `CreateInvoiceUseCase`, `PostJournalEntryUseCase`).
- **`ports`**: واجهات (`traits`) للـ Repositories و`UnitOfWork`.
- **`infrastructure`**: تنفيذ مستودعات SQLite عبر [SQLx](https://github.com/launchbadge/sqlx) مع 30+ ملف ترحيل في `crates/infrastructure/migrations/`.
- **`tauri-adapter`**: يسجّل ~70 أمر Tauri (`#[tauri::command]`)، يحقن التبعيات في `bootstrap/container.rs`.

## بنية المستودع

```
accounting-app/
├── apps/
│   └── desktop/                    # تطبيق Tauri (الواجهة + غلاف Rust)
│       ├── src/                    # React + TypeScript
│       │   ├── pages/              # 27 صفحة (محاسبة، فواتير، مخزون، تقارير...)
│       │   ├── components/erp/     # 62 مكوّن خاص بـ ERP
│       │   └── components/ui/      # 50 مكوّن shadcn/ui
│       └── src-tauri/              # نقطة الدخول الفعلية لـ Tauri
│           ├── tauri.conf.json
│           └── tauri.windows.conf.json   # تجاوزات خاصة بـ Windows
├── crates/
│   ├── domain/                     # الكيانات والقواعد التجارية
│   ├── application/                # Use cases + DTOs + ports
│   ├── ports/                      # Trait abstractions
│   ├── infrastructure/             # تنفيذ SQLite/SQLx + ترحيلات
│   │   └── migrations/             # 030_*.sql
│   └── tauri-adapter/              # Tauri commands + DI container
├── packages/
│   └── shared-types/               # أنواع TypeScript مشتركة (مولَّدة)
├── scripts/
│   └── set-version.mjs             # توحيد الإصدار عبر كل package.json + Cargo.toml
└── .github/workflows/              # CI + Release
    ├── ci.yml
    └── release.yml
```

## المتطلبات

- **Rust**: 1.85+ (مطلوب لاعتماديات edition 2024). شغّل `rustup update stable`.
- **Node.js**: 22 LTS+ (تستخدم CI `lts/*`).
- **pnpm**: `10.29.2` بالضبط (مثبَّت في `package.json` عبر `packageManager`). ثبّته بـ `npm install -g pnpm@10.29.2`.
- **Linux فقط**: مكتبات Tauri 2:

  ```bash
  sudo apt-get install -y \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libsoup-3.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev
  ```

- **macOS**: Xcode Command Line Tools.
- **Windows**: WebView2 Runtime (يُثبَّت تلقائيًا عبر NSIS bootstrapper المدمج في الإصدار).

## التشغيل المحلي

```bash
# 1) تثبيت الاعتماديات
pnpm install --frozen-lockfile

# 2) تشغيل التطبيق في وضع التطوير (HMR + Tauri dev server)
pnpm tauri:dev
```

سيفتح Tauri نافذة التطبيق ويبدأ Vite على منفذ المعاينة. أي تعديل في `apps/desktop/src/` يُعاد تحميله مباشرة. أي تعديل في `crates/*` يُعيد بناء الخلفية.

> ملاحظة: في أول تشغيل سيتم إنشاء قاعدة البيانات `erp.db` في مجلد بيانات التطبيق (`AppData/Roaming/Almowakeb/` على Windows، `~/Library/Application Support/Almowakeb/` على macOS، `~/.local/share/Almowakeb/` على Linux) وتشغيل ترحيلات `infrastructure/migrations/` تلقائيًا.

## البناء

### بناء الواجهة فقط (Vite)

```bash
pnpm build      # ينتج apps/desktop/dist/
```

### بناء تطبيق سطح المكتب الكامل

```bash
# Linux: .deb / .rpm / .AppImage
pnpm tauri build

# تسريع التطوير: حزمة واحدة فقط (مثلاً .deb)
pnpm --filter desktop tauri build --bundles deb

# macOS: ينتج .app + .dmg (universal binary على CI)
pnpm tauri build

# Windows: ينتج .msi + .exe (NSIS) — يُدمج تلقائيًا
# tauri.windows.conf.json (WebView2Loader.dll + bootstrapper)
pnpm tauri build
```

المخرجات تذهب إلى `target/release/bundle/` ضمن workspace target الجذري.

## الاختبار والتدقيق

```bash
# اختبارات Rust (39 اختبار وحدة)
cargo test --workspace

# Clippy على كامل workspace (CI يستخدم -D warnings)
cargo clippy --workspace --all-targets -- -D warnings

# Lint الواجهة
pnpm lint

# Typecheck الواجهة (ضمن vite build)
pnpm build
```

## CI/CD

كل PR يشغّل خمس مهام بالتوازي:

| Job | الوظيفة |
|---|---|
| **Lint & Typecheck (Frontend)** | `pnpm lint` + `pnpm build` |
| **Rust Tests (Linux)** | `cargo clippy -D warnings` + `cargo test` على Ubuntu |
| **Rust Check (macos-latest)** | `cargo check` على macOS لتأكيد البناء العابر للمنصات |
| **Rust Check (windows-latest)** | `cargo check` على Windows |
| **Tauri Build Smoke Test (Linux)** | `pnpm tauri build --bundles deb` للتأكد من اكتمال الحزم |

عند إنشاء tag بصيغة `v*`، يعمل [`release.yml`](.github/workflows/release.yml) ويُنشئ إصدار GitHub مع حزم `.dmg`/`.app` (universal macOS)، `.deb`/`.AppImage` (Ubuntu)، و`.msi`/`.exe` (Windows مع WebView2 bootstrapper).

## الإصدار

لتوحيد رقم الإصدار عبر كل `package.json` و`Cargo.toml`:

```bash
node scripts/set-version.mjs 0.7.0
```

ثم:

```bash
git tag v0.7.0 && git push --tags
```

سيشغّل ذلك workflow الإصدار تلقائيًا.

## المساهمة

1. أنشئ فرعًا من `main` بصيغة `feat/...` أو `fix/...`.
2. تأكد من نجاح `pnpm lint`، `cargo clippy --workspace --all-targets -- -D warnings`، و`cargo test --workspace` محليًا قبل فتح PR.
3. كل PR يجب أن يجتاز كل مهام CI الخمس قبل الدمج.
4. للمعاملات المالية: استخدم `rust_decimal::Decimal` لا `f32`/`f64`. لا تُكسر هذه القاعدة.
5. لا تعدّل ملفات الترحيل (`crates/infrastructure/migrations/NNN_*.sql`) بعد دمجها — أضف ترحيلًا جديدًا.

## الترخيص

غير محدد بعد. يرجى التواصل مع المؤلف لاستخدامات تجارية.

---

**Author**: [Ahmad Abdelbary](https://github.com/Ahmad-J-Bary)  
**Issues**: <https://github.com/Ahmad-J-Bary/accounting-app/issues>
