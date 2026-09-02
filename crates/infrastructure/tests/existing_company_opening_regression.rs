//! Full-stack accounting regression for the EXISTING-company
//! opening. One scenario ties every layer together:
//!
//!   CHART      — the canonical loan account is code 224 under 22 -> 2; Partner
//!                Current (54) hangs under the equity root 5; codes unique; the
//!                account tree is valid and acyclic.
//!   OPENING    — Cash 65, AR 80, Inventory 120, FA 200 (Dr 465) vs AP 70,
//!                Loans 50, Partner Capital 300, Historical Equity 45 (Cr 465):
//!                explicitly balanced, so it validates, posts and locks with an
//!                Opening Balance Control (53) of exactly zero.
//!   GL         — Customer Ammar's receivable is exactly ONE GL opening movement
//!                (80, never 80+80) with an empty `opening_entries` carrier.
//!   SUBLEDGER  — the AR sub-ledger (Ammar 80) reconciles to the GL (80) with a
//!                difference of zero, alongside AP / Inventory / FA / Loan.
//!   DATE       — the opening transaction is dated 2026-01-01 (the cutover /
//!                accounting date) even though the journal `created_at` is later;
//!                reports must use the accounting date, never creation time.
//!   REPORT     — a 2026-01-01 -> 2026-08-16 range surfaces one opening
//!                movement; a 2026-02-01 -> 2026-08-16 range keeps the opening
//!                as the beginning balance only, never a second in-range
//!                movement (frontend semantics covered by `openingLines` vitest).
//!   IDEMPOTENCY — posting the same opening migration twice creates exactly one
//!                GL journal (the second post is rejected; UNIQUE(source_type,
//!                source_id) is the schema backstop).
//!   FINAL      — the trial balance stays A = L + E (465 = 120 + 345), GL line
//!                counts equal journal lines, sub-ledgers reconcile, and report
//!                reads never mutate accounting rows.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::use_cases::account::AccountQueries;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput, SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, GetOpeningPositionControlUseCase,
    GetOpeningReconciliationUseCase, KIND_AR, KIND_AP, KIND_FIXED_ASSET, KIND_INVENTORY, KIND_LOAN,
    LockOpeningBalanceUseCase, PostOpeningBalanceUseCase, SaveOpeningItemsUseCase,
    ValidateOpeningBalanceUseCase,
};
use chrono::{DateTime, Utc};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::MigrationStatus;
use domain::assets::{AssetCategory, AssetType, FixedAsset};
use domain::customers::Customer;
use domain::inventory::material::Material;
use domain::shared::ids::AccountId;
use domain::shared::money::Money;
use domain::shared::Currency;
use domain::suppliers::Supplier;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqlitePartnerRepository, SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_existing_company_opening_{}.sqlite", uuid::Uuid::new_v4()));
    let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    let pool: Arc<sqlx::SqlitePool> = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    currency_repo.save(&test_currency()).await.unwrap();
    currency_repo.set_base_currency("S").await.unwrap();
    set_start_mode(&pool, START_MODE_EXISTING).await;
    pool
}

async fn set_start_mode(pool: &Arc<sqlx::SqlitePool>, mode: &str) {
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = mode.into();
    settings_repo.save(&settings).await.unwrap();
}

async fn account_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

/// Rows: (id, name_ar, account_type, category, purpose, level, parent_id).
type AccountRow = (String, String, String, String, String, i32, Option<String>);

async fn row_by_code(pool: &sqlx::SqlitePool, code: &str) -> Option<AccountRow> {
    sqlx::query_as::<_, AccountRow>(
        "SELECT id, name_ar, account_type, category, purpose, level, parent_id
         FROM accounts WHERE code = ?",
    )
    .bind(code)
    .fetch_optional(pool)
    .await
    .unwrap()
}

async fn save_account(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    purpose: AccountPurpose,
    account_type: AccountType,
) -> AccountId {
    let account = Account::new(
        code.to_string(),
        format!("حساب {}", code),
        format!("Account {}", code),
        account_type,
        None,
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap()
    .with_purpose(purpose);
    let id = account.id;
    SqliteAccountRepository::new(pool.clone()).save(&account).await.unwrap();
    id
}

#[allow(dead_code)]
struct Accounts {
    cash: AccountId,
    ar: AccountId,
    inventory: AccountId,
    fa: AccountId,
    ap: AccountId,
    loan: AccountId,
    capital: AccountId,
    historical_equity: AccountId,
}

/// Seeds the chart-derived accounts. The loan uses the canonical chart
/// account code 224 (purpose `loan`) — the same account the wizard resolves —
/// so the CHART assertion and the OPENING posting share the real account.
async fn seed_accounts(pool: &Arc<sqlx::SqlitePool>) -> Accounts {
    Accounts {
        cash: save_account(pool, "1910", AccountPurpose::General, AccountType::Assets).await,
        ar: save_account(pool, "1912", AccountPurpose::Receivable, AccountType::Assets).await,
        inventory: save_account(pool, "1913", AccountPurpose::Inventory, AccountType::Assets).await,
        fa: save_account(pool, "1914", AccountPurpose::FixedAsset, AccountType::Assets).await,
        ap: save_account(pool, "2910", AccountPurpose::Payable, AccountType::Liabilities).await,
        loan: account_id_by_code(pool, "224").await,
        capital: save_account(pool, "3910", AccountPurpose::PartnerCapital, AccountType::Equity).await,
        historical_equity: save_account(
            pool,
            "3912",
            AccountPurpose::RetainedEarnings,
            AccountType::Equity,
        )
        .await,
    }
}

struct Entities {
    customer: String,
    supplier: String,
    material: String,
    asset: String,
}

async fn seed_entities(pool: &Arc<sqlx::SqlitePool>) -> Entities {
    // Ammar — the customer whose 80 receivable is the sub-ledger under test.
    let customer = Customer::new(
        "C-AMMAR".into(),
        "عمّار".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(80),
        test_currency(),
        None,
    )
    .unwrap();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();

    let supplier = Supplier::new(
        "S-P6".into(),
        "مورد أول المدة".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(70),
        test_currency(),
        None,
    )
    .unwrap();
    SqliteSupplierRepository::new(pool.clone()).save(&supplier).await.unwrap();

    let material = Material::new(
        "مادة أول المدة".into(),
        "M-P6".into(),
        "M-P6".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    SqliteMaterialRepository::new(pool.clone()).save(&material).await.unwrap();

    let asset_repo = SqliteAssetRepository::new(pool.clone());
    let category = AssetCategory::new("أصول أول المدة".into(), AssetType::Fixed);
    asset_repo.save_category(&category).await.unwrap();
    let fa_dep = save_account(pool, "1915", AccountPurpose::General, AccountType::Assets).await;
    let fa_acc = save_account(pool, "1916", AccountPurpose::General, AccountType::Assets).await;
    let asset = FixedAsset::new(
        "FA-P6".into(),
        "أصل أول المدة".into(),
        category.id,
        None,
        chrono::Utc::now(),
        Money::new(dec!(200), test_currency()),
        dec!(1),
        24,
        account_id_by_code(pool, "1914").await.0,
        fa_dep.0,
        fa_acc.0,
    );
    asset_repo.save_asset(&asset).await.unwrap();

    Entities {
        customer: customer.id.to_string(),
        supplier: supplier.id.to_string(),
        material: material.id.to_string(),
        asset: asset.id.0.to_string(),
    }
}

fn line(account: AccountId, amount: &str) -> OpeningLineInput {
    OpeningLineInput { account_id: account.to_string(), amount: amount.into(), description: None }
}

/// The exact lines: Cash 65 / AR 80 / Inventory 120 / FA 200 (Dr 465)
/// vs AP 70 / Loans 50 / Partner Capital 300 / Historical Equity 45 (Cr 465).
/// Explicitly balanced — no OBE plug at all.
fn full_lines(a: &Accounts) -> Vec<OpeningLineInput> {
    vec![
        line(a.cash, "65"),
        line(a.ar, "80"),
        line(a.inventory, "120"),
        line(a.fa, "200"),
        line(a.ap, "70"),
        line(a.loan, "50"),
        line(a.capital, "300"),
        line(a.historical_equity, "45"),
    ]
}

/// Sub-ledger items: AR Ammar 80, AP supplier 70, Inventory material 120, FA
/// asset 200, Loan on the canonical account 224 for 50. No bank -> 0 / 0.
fn subledger_items(a: &Accounts, e: &Entities) -> Vec<OpeningItemInput> {
    vec![
        OpeningItemInput { kind: KIND_AR.into(), entity_id: e.customer.clone(), reference: None, amount: "80".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_AP.into(), entity_id: e.supplier.clone(), reference: None, amount: "70".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_INVENTORY.into(), entity_id: e.material.clone(), reference: None, amount: "120".into(), qty: "10".into() },
        OpeningItemInput { kind: KIND_FIXED_ASSET.into(), entity_id: e.asset.clone(), reference: None, amount: "200".into(), qty: "1".into() },
        OpeningItemInput { kind: KIND_LOAN.into(), entity_id: a.loan.to_string(), reference: Some("حساب القروض".into()), amount: "50".into(), qty: "0".into() },
    ]
}

fn create_uc(pool: &Arc<sqlx::SqlitePool>) -> CreateOpeningBalanceUseCase {
    CreateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
}

fn reconciler(pool: &Arc<sqlx::SqlitePool>) -> GetOpeningReconciliationUseCase {
    GetOpeningReconciliationUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

fn validator(pool: &Arc<sqlx::SqlitePool>) -> ValidateOpeningBalanceUseCase {
    ValidateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

fn poster(pool: &Arc<sqlx::SqlitePool>) -> PostOpeningBalanceUseCase {
    PostOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
}

fn locker(pool: &Arc<sqlx::SqlitePool>) -> LockOpeningBalanceUseCase {
    LockOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

fn positioner(pool: &Arc<sqlx::SqlitePool>) -> GetOpeningPositionControlUseCase {
    GetOpeningPositionControlUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

async fn save_items(pool: &Arc<sqlx::SqlitePool>, migration_id: &str, items: Vec<OpeningItemInput>) {
    SaveOpeningItemsUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
    )
    .execute(SaveOpeningItemsCommand { migration_id: migration_id.into(), items })
    .await
    .expect("save sub-ledger items");
}

/// A fully prepared fixture: account ids, entity ids and a migration id
/// referencing those exact account ids, with the sub-ledger items saved.
struct Fixture {
    pool: Arc<sqlx::SqlitePool>,
    accounts: Accounts,
    migration_id: String,
}

async fn fixture(cutover: &str) -> Fixture {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let entities = seed_entities(&pool).await;

    let draft = create_uc(&pool)
        .execute(CreateOpeningBalanceMigrationCommand {
            cutover_date: cutover.to_string(),
            notes: None,
            lines: full_lines(&accounts),
            source_system: Some("legacy".into()),
            source_reference: Some("P6-2025".into()),
        })
        .await
        .expect("create migration");
    let migration_id = draft.0.id.clone();
    save_items(&pool, &migration_id, subledger_items(&accounts, &entities)).await;

    Fixture { pool, accounts, migration_id }
}

/// Runs Validate -> Approve -> Post (returning the posted snapshot) for a
/// fixture; used by every test that exercises the final accounting state.
async fn post_fixture(fx: &Fixture) {
    validator(&fx.pool)
        .execute(fx.migration_id.clone(), "tester".into())
        .await
        .expect("balanced reconciled migration must validate");
    ApproveOpeningBalanceUseCase::new(Arc::new(SqliteOpeningMigrationRepository::new(fx.pool.clone())))
        .execute(fx.migration_id.clone(), "approver".into())
        .await
        .expect("validated migration must approve");
    poster(&fx.pool).execute(fx.migration_id.clone()).await.expect("approved reconciliation must post");
}

// ---------------------------------------------------------------------------
// 1. CHART OF ACCOUNTS — canonical 224 / 54 hierarchy, unique codes, valid
//    acyclic tree. (Domain assertions; the full chart suite lives in
//    chart_hierarchy.rs — this pins the scenario's loan account.)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn chart_canonical_loan_224_and_partner_current_54_under_equity() {
    let pool = build_pool().await;

    // Loans = 224, never 225; a Detail Liability under 22 -> 2.
    assert!(row_by_code(&pool, "225").await.is_none(), "loan must never use code 225");
    let loan = row_by_code(&pool, "224").await.expect("code 224 exists");
    assert_eq!(loan.1, "القروض");
    assert_eq!(loan.2, "Liabilities");
    assert_eq!(loan.3, "Detail");
    assert_eq!(loan.4, "loan");
    assert_eq!(loan.5, 3);
    let liab_22 = row_by_code(&pool, "22").await.expect("22 exists");
    assert_eq!(loan.6.as_deref(), Some(liab_22.0.as_str()));
    assert_eq!(liab_22.6.as_deref(), Some(row_by_code(&pool, "2").await.expect("2 exists").0.as_str()));

    // Partner Current Accounts under the equity root 5.
    let current = row_by_code(&pool, "54").await.expect("54 exists");
    assert_eq!(current.2, "Equity");
    assert_eq!(current.4, "partner_current");
    assert_eq!(current.6.as_deref(), Some(row_by_code(&pool, "5").await.expect("5 exists").0.as_str()));

    // No duplicate account codes (index backstop).
    let dupes: Vec<(String, i64)> =
        sqlx::query_as("SELECT code, COUNT(*) FROM accounts GROUP BY code HAVING COUNT(*) > 1")
            .fetch_all(&*pool)
            .await
            .unwrap();
    assert!(dupes.is_empty(), "duplicate account codes: {dupes:?}");

    // Every parent_id references an existing account and the tree is acyclic.
    let rows: Vec<(Option<String>, String)> =
        sqlx::query_as("SELECT parent_id, id FROM accounts").fetch_all(&*pool).await.unwrap();
    let ids: std::collections::HashSet<String> =
        rows.iter().map(|(_, id)| id.clone()).collect();
    for (parent, id) in &rows {
        if let Some(p) = parent {
            assert!(ids.contains(p), "account {id} parent {p} missing");
        }
        let mut cursor: Option<String> = Some(id.clone());
        let mut hops = 0;
        while let Some(c) = cursor {
            let next = rows.iter().find(|(_, i)| i == &c).and_then(|(p, _)| p.clone());
            match next {
                Some(up) => cursor = Some(up),
                None => break,
            }
            hops += 1;
            assert!(hops <= rows.len(), "cycle at account {id}");
        }
    }
}

// ---------------------------------------------------------------------------
// 2. OPENING — the exact 465/465 scenario validates, posts and locks with
//    control == 0 (no residual classification needed when equity is explicit).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn opening_exact_465_scenario_validates_posts_and_locks() {
    let fx = fixture("2026-01-01T00:00:00Z").await;

    let recon = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon");
    assert!(recon.all_reconciled, "every sub-ledger must reconcile: {recon:?}");
    assert_eq!(recon.debit_total, dec!(465));
    assert_eq!(recon.credit_total, dec!(465));
    assert!(recon.debit_equals_credit);
    let loan_row = recon.rows.iter().find(|r| r.key == "Loan").expect("Loan row");
    assert_eq!(loan_row.subledger, dec!(50));
    assert_eq!(loan_row.general_ledger, dec!(50), "loan GL via canonical account 224");

    post_fixture(&fx).await;

    // Control (53) exactly zero: no OBE plug exists, so lock passes directly.
    let after = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon after post");
    assert_eq!(after.opening_control_balance, dec!(0));

    let locked = locker(&fx.pool).execute(fx.migration_id.clone()).await.expect("lock");
    assert_eq!(locked.0.status, MigrationStatus::Locked);
}

// ---------------------------------------------------------------------------
// 3. GL — Customer Ammar's receivable is exactly ONE opening movement (80,
//    never 80+80); `opening_entries` is the empty carrier.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gl_customer_ammar_is_exactly_one_opening_movement() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    let ledger = queries.get_ledger(&[fx.accounts.ar]).await.expect("AR ledger");

    assert_eq!(ledger.lines.len(), 1, "Ammar's AR must be exactly one GL opening movement");
    assert!(ledger.opening_entries.is_empty(), "no synthetic opening rows");
    assert_eq!(ledger.lines[0].debit_base, Decimal::from(80));
    assert_eq!(ledger.lines[0].credit_base, Decimal::ZERO);
    assert_eq!(ledger.lines[0].balance_base, Decimal::from(80));
    assert_eq!(ledger.closing_balance_base, Decimal::from(80));
    assert_eq!(ledger.total_debit_base, Decimal::from(80));

    // The whole scenario is ONE posted AccountOpeningBalance journal (globally).
    let opening_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'AccountOpeningBalance' AND status = 'Posted'",
    )
    .fetch_one(&*fx.pool)
    .await
    .unwrap();
    assert_eq!(opening_count, 1, "exactly one posted AccountOpeningBalance journal");
}

// ---------------------------------------------------------------------------
// 4. SUBLEDGER — Ammar 80 reconciles to the GL 80 (difference zero), plus the
//    other sub-ledgers, from the real reconciliation DTO.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn subledger_ammar_reconciles_to_gl_with_zero_difference() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    let recon = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon");
    let ar = recon.rows.iter().find(|r| r.key == "AR").expect("AR row");
    assert_eq!(ar.subledger, dec!(80), "Ammar's sub-ledger");
    assert_eq!(ar.general_ledger, dec!(80), "GL receivable");
    assert_eq!(ar.subledger - ar.general_ledger, dec!(0), "difference must be zero");
    assert!(ar.reconciled);
    assert!(recon.all_reconciled, "all sub-ledgers reconcile: {recon:?}");
}

// ---------------------------------------------------------------------------
// 5. DATE — the opening transaction uses the accounting date (cutover
//    2026-01-01) even though the journal `created_at` is later. Reports must
//    run on `entry_date`, never `created_at`.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn date_opening_uses_cutover_not_creation_timestamp() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    let ledger = queries.get_ledger(&[fx.accounts.ar]).await.expect("AR ledger");
    let line_date = ledger.lines[0].date;
    let cutover = DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    assert_eq!(line_date, cutover, "GL line must be dated by the accounting date");

    // The stored journal carries the accounting date while `created_at` is later.
    let (entry_date, created_at): (String, String) = sqlx::query_as(
        "SELECT entry_date, created_at FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("opening_balance:{}", fx.migration_id))
    .fetch_one(&*fx.pool)
    .await
    .unwrap();
    assert!(entry_date.starts_with("2026-01-01"), "entry_date = accounting date: {entry_date}");
    assert!(
        !created_at.starts_with("2026-01"),
        "created_at must be the actual creation moment, not the cutover date: {created_at}"
    );
    assert!(created_at > entry_date, "created_at must follow the backdated entry_date");
}

// ---------------------------------------------------------------------------
// 6. REPORT — a range starting 2026-01-01 surfaces ONE opening movement;
//    a range starting 2026-02-01 must NOT show it as a second movement. The
//    date arithmetic is pinned here on real posted data; the frontend
//    `getOpeningTotals`/`computeOpeningBalance` unit tests cover the exact
//    range seconds (see `openingLines.test.ts`).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn report_date_ranges_surface_one_movement_and_keep_beginning_only() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    // The ONLY in-range movement for AR when starting the period at the
    // cutover is the single opening line (>= 2026-01-01).
    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    let ledger = queries.get_ledger(&[fx.accounts.ar]).await.expect("AR ledger");
    let in_range: Vec<_> = ledger
        .lines
        .iter()
        .filter(|l| l.date >= DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z").unwrap().with_timezone(&Utc))
        .collect();
    assert_eq!(in_range.len(), 1, "from 2026-01-01 there is exactly one opening movement");

    // The opening (dated 2026-01-01) lands BEFORE a 2026-02-01 report start,
    // so it only contributes the beginning balance — never a second movement.
    let in_february_range: Vec<_> = ledger
        .lines
        .iter()
        .filter(|l| l.date >= DateTime::parse_from_rfc3339("2026-02-01T00:00:00Z").unwrap().with_timezone(&Utc))
        .collect();
    assert!(in_february_range.is_empty(), "no second opening movement in 2026-02-01+ range");
}

// ---------------------------------------------------------------------------
// 7. IDEMPOTENCY — posting the same opening migration twice produces exactly
//    one GL journal; the second post is rejected and the schema-level
//    UNIQUE(source_type, source_id) index is the backstop.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn idempotency_posting_same_migration_twice_creates_single_journal() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    let source = format!("opening_balance:{}", fx.migration_id);
    let count_before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
        .bind(&source)
        .fetch_one(&*fx.pool)
        .await
        .unwrap();
    assert_eq!(count_before, 1);

    // A second post of the same (now Posted) migration must be rejected.
    let err = poster(&fx.pool).execute(fx.migration_id.clone()).await;
    assert!(err.is_err(), "re-posting a Posted migration must fail");

    let count_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
        .bind(&source)
        .fetch_one(&*fx.pool)
        .await
        .unwrap();
    assert_eq!(count_after, 1, "no duplicate GL journal may ever exist");
}

// ---------------------------------------------------------------------------
// 8. FINAL CHECKS — Trial Balance stays balanced (A = L + E), GL line counts
//    equal journal lines, sub-ledgers reconcile, and report reads never mutate
//    accounting rows.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn final_trial_balance_balanced_gl_equals_journal_and_reports_read_only() {
    let fx = fixture("2026-01-01T00:00:00Z").await;
    post_fixture(&fx).await;

    // Snapshot accounting rows before any report read.
    let entries_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*fx.pool).await.unwrap();
    let lines_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*fx.pool).await.unwrap();

    // Trial balance: A = L + E from the position control (read-only).
    let pos = positioner(&fx.pool).execute(fx.migration_id.clone()).await.expect("position");
    assert_eq!(pos.total_assets, dec!(465));
    assert_eq!(pos.total_liabilities, dec!(120));
    assert_eq!(pos.total_equity, dec!(345));
    assert_eq!(pos.net_assets, dec!(345));
    assert_eq!(pos.total_assets, pos.total_liabilities + pos.total_equity);
    assert!(pos.is_balanced, "final trial balance must be balanced");
    assert!(pos.validation_errors.is_empty(), "no readiness blockers after lock");

    // GL == journal lines: one posted AccountOpeningBalance with the 8
    // lines; the AR account's ledger exposes exactly its line.
    let gl_lines: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.journal_type = 'AccountOpeningBalance' AND je.status = 'Posted'",
    )
    .fetch_one(&*fx.pool)
    .await
    .unwrap();
    assert_eq!(gl_lines, 8, "the posted opening journal carries exactly the scenario lines");

    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    let ar_ledger = queries.get_ledger(&[fx.accounts.ar]).await.expect("AR ledger");
    assert_eq!(ar_ledger.lines.len() as i64, 1);

    // Sub-ledgers reconcile to the GL after posting.
    let recon = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon");
    assert!(recon.all_reconciled, "sub-ledgers must reconcile with GL post-lock");

    // Reports are pure reads: no accounting row count may change.
    let entries_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*fx.pool).await.unwrap();
    let lines_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*fx.pool).await.unwrap();
    assert_eq!(entries_after, entries_before, "reports must not alter journal_entries");
    assert_eq!(lines_after, lines_before, "reports must not alter journal_lines");
}

// Keep `AppError` reachable in case a future test needs to match error kinds.
#[allow(dead_code)]
fn _app_error_type(_: &AppError) {}