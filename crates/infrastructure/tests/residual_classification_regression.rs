//! Full-stack EXISTING-company opening regression in the RESIDUAL
//! variant. The unbalanced position is posted exactly once, its residual is
//! classified to Retained Earnings through exactly one more journal, and the
//! company locks with a consistent Trial Balance and Balance Sheet:
//!
//!   OPENING (the 10 canonical lines, Dr = Cr at the line level):
//!     Cash 25 / Bank 40 / AR 80 / Inventory 120 / FA 200            (Dr 465)
//!     AP 70 / Loans 50 / Partner Ahmad 180 / Partner Mohammad 120   (Cr 420)
//!     Opening Balance Equity 53                                     (Cr 45)
//!   RESIDUAL (one GeneralJournal, source `residual_classification:{id}`):
//!     Dr 53 45 / Cr Retained Earnings 45  → 53 nets zero, RE holds 45.
//!   LOCK    — only after 53 nets zero.
//!
//!   VERDICT  — Assets 465 = Liabilities 120 + Equity 345 (300 partner capital
//!              + 45 Retained Earnings via the residual); Trial Balance stays
//!              Debit = Credit; the Daily Journal contains EXACTLY two official
//!              entries (Opening Migration `AccountOpeningBalance` + Residual
//!              `GeneralJournal`) with no blank Entry Number / Entry Type on any
//!              GL row; every account holds exactly one GL opening effect; and
//!              re-running Post / Residual / App restart never duplicates.
//!
//! Partner equity is split Ahmad 180 + Mohammad 120 across two
//! Partner-Capital accounts (the wizard's `derivePartnerEquity` shape), so the
//! per-partner slice is asserted too.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::use_cases::account::AccountQueries;
use application::use_cases::journal::ListJournalEntriesUseCase;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput,
    SaveOpeningItemsCommand, SetResidualClassificationCommand,
};
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase,
    GetOpeningPositionControlUseCase, GetOpeningReconciliationUseCase, KIND_AR, KIND_AP,
    KIND_BANK, KIND_FIXED_ASSET, KIND_INVENTORY, KIND_LOAN, LockOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, SaveOpeningItemsUseCase, SetResidualClassificationUseCase,
    ValidateOpeningBalanceUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::partner::{Partner, ProfitSharingType};
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

fn fresh_db_path(tag: &str) -> String {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_residual_classification_{}_{}.sqlite", tag, uuid::Uuid::new_v4()));
    path.to_str().unwrap().to_string()
}

/// Builds a fresh, migrated pool with the base currency and EXISTING-company
/// start mode over a brand-new SQLite file.
async fn build_pool_at(path: &str) -> Arc<sqlx::SqlitePool> {
    let options = SqliteConnectOptions::from_str(path)
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

/// Reopens an EXISTING SQLite file (a fresh application session). Migrations
/// already ran; the base currency and start mode were persisted.
async fn restart_pool_at(path: &str) -> Arc<sqlx::SqlitePool> {
    let options = SqliteConnectOptions::from_str(path)
        .unwrap()
        .create_if_missing(false);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    Arc::new(pool)
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

/// Net base-currency GL position of an account across ALL journal lines (live
/// ledger truth, ignoring report-surface filters).
async fn gl_net(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let balance: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::try_from(balance).unwrap()
}

async fn entry_count_by_source(pool: &sqlx::SqlitePool, source_id: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
        .bind(source_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

struct Accounts {
    cash: AccountId,
    bank: AccountId,
    ar: AccountId,
    inventory: AccountId,
    fa: AccountId,
    ap: AccountId,
    loan: AccountId,
    ahmad: AccountId,
    mohammad: AccountId,
    obe: AccountId,
    retained: AccountId,
}

/// Seeds the chart-family accounts. Loan uses the canonical chart code
/// 224; OBE is the real 53 control account from the seeded chart.
async fn seed_accounts(pool: &Arc<sqlx::SqlitePool>) -> Accounts {
    Accounts {
        cash: save_account(pool, "1910", AccountPurpose::General, AccountType::Assets).await,
        bank: save_account(pool, "1911", AccountPurpose::Bank, AccountType::Assets).await,
        ar: save_account(pool, "1912", AccountPurpose::Receivable, AccountType::Assets).await,
        inventory: save_account(pool, "1913", AccountPurpose::Inventory, AccountType::Assets).await,
        fa: save_account(pool, "1914", AccountPurpose::FixedAsset, AccountType::Assets).await,
        ap: save_account(pool, "2910", AccountPurpose::Payable, AccountType::Liabilities).await,
        loan: account_id_by_code(pool, "224").await,
        ahmad: save_account(pool, "3911", AccountPurpose::PartnerCapital, AccountType::Equity).await,
        mohammad: save_account(pool, "3912", AccountPurpose::PartnerCapital, AccountType::Equity).await,
        obe: account_id_by_code(pool, "53").await,
        retained: save_account(pool, "3913", AccountPurpose::RetainedEarnings, AccountType::Equity).await,
    }
}

struct Entities {
    customer: String,
    supplier: String,
    material: String,
    asset: String,
}

/// Sub-ledger entities: customer receivable 80, supplier payable 70, material
/// 120, and a single fixed asset of 200 (the FA sub-ledger detail).
async fn seed_entities(pool: &Arc<sqlx::SqlitePool>) -> Entities {
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
        "S-P7".into(),
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
        "M-P7".into(),
        "M-P7".into(),
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
        "FA-P7".into(),
        "أصل أول المدة".into(),
        category.id,
        None,
        chrono::Utc::now(),
        Money::new(Decimal::from(200), test_currency()),
        Decimal::ONE,
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

/// The exact lines: Cash 25 / Bank 40 / AR 80 / Inventory 120 / FA 200
/// (Dr 465) vs AP 70 / Loans 50 / Ahmad 180 / Mohammad 120 (Cr 420) + OBE 53 45
/// (Cr 45) — line-balanced with the residual parked on the control account.
fn full_lines(a: &Accounts) -> Vec<OpeningLineInput> {
    vec![
        line(a.cash, "25"),
        line(a.bank, "40"),
        line(a.ar, "80"),
        line(a.inventory, "120"),
        line(a.fa, "200"),
        line(a.ap, "70"),
        line(a.loan, "50"),
        line(a.ahmad, "180"),
        line(a.mohammad, "120"),
        line(a.obe, "45"),
    ]
}

fn subledger_items(a: &Accounts, e: &Entities) -> Vec<OpeningItemInput> {
    vec![
        OpeningItemInput { kind: KIND_AR.into(), entity_id: e.customer.clone(), reference: None, amount: "80".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_AP.into(), entity_id: e.supplier.clone(), reference: None, amount: "70".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_INVENTORY.into(), entity_id: e.material.clone(), reference: None, amount: "120".into(), qty: "10".into() },
        OpeningItemInput { kind: KIND_FIXED_ASSET.into(), entity_id: e.asset.clone(), reference: None, amount: "200".into(), qty: "1".into() },
        OpeningItemInput { kind: KIND_BANK.into(), entity_id: a.bank.to_string(), reference: Some("حساب البنوك".into()), amount: "40".into(), qty: "0".into() },
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

fn splitter(pool: &Arc<sqlx::SqlitePool>) -> SetResidualClassificationUseCase {
    SetResidualClassificationUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
    )
}

fn residual_applier(pool: &Arc<sqlx::SqlitePool>) -> ApplyResidualToLedgerUseCase {
    ApplyResidualToLedgerUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
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

/// Registers the two real partners of the scenario against their capital
/// accounts so the per-partner equity slice (Ahmad 180 / Mohammad 120) is
/// surfaced by the position control.
async fn seed_partners(pool: &Arc<sqlx::SqlitePool>, accounts: &Accounts) {
    for (code, name, amount, account_id) in [
        ("P-AHMAD", "أحمد", 180, accounts.ahmad),
        ("P-MOHD", "محمد", 120, accounts.mohammad),
    ] {
        let mut partner = Partner::new(
            code.to_string(),
            name.to_string(),
            test_currency(),
            Decimal::ONE,
            Decimal::from(amount),
            false,
            ProfitSharingType::BasedOnCapitalLocal,
            None,
            None,
        )
        .unwrap();
        partner.link_account(account_id);
        SqlitePartnerRepository::new(pool.clone()).save(&partner).await.unwrap();
    }
}

struct Fixture {
    pool: Arc<sqlx::SqlitePool>,
    db_path: String,
    accounts: Accounts,
    migration_id: String,
}

/// A fully prepared fixture: accounts, partners, entities, a draft
/// migration carrying the canonical residual lines and the reconciled
/// sub-ledger items.
async fn fixture(tag: &str, cutover: &str) -> Fixture {
    let db_path = fresh_db_path(tag);
    let pool = build_pool_at(&db_path).await;
    let accounts = seed_accounts(&pool).await;
    seed_partners(&pool, &accounts).await;

    let draft = create_uc(&pool)
        .execute(CreateOpeningBalanceMigrationCommand {
            cutover_date: cutover.to_string(),
            notes: None,
            lines: full_lines(&accounts),
            source_system: Some("residual_classification".into()),
            source_reference: Some("P7-2025".into()),
        })
        .await
        .expect("create draft migration");
    let migration_id = draft.0.id.clone();
    let entities = seed_entities(&pool).await;
    save_items(&pool, &migration_id, subledger_items(&accounts, &entities)).await;

    Fixture { pool, db_path, accounts, migration_id }
}

/// Runs Validate -> Approve -> Post -> Classify residual (RetainedEarnings) ->
/// Apply residual -> Lock, returning the residual source id.
async fn run_full_flow(fx: &Fixture) -> String {
    validator(&fx.pool)
        .execute(fx.migration_id.clone(), "tester".into())
        .await
        .expect("balanced reconciled residual draft must validate");
    ApproveOpeningBalanceUseCase::new(Arc::new(SqliteOpeningMigrationRepository::new(fx.pool.clone())))
        .execute(fx.migration_id.clone(), "approver".into())
        .await
        .expect("validated migration must approve");
    poster(&fx.pool).execute(fx.migration_id.clone()).await.expect("approved reconciliation must post");

    splitter(&fx.pool)
        .execute(SetResidualClassificationCommand {
            migration_id: fx.migration_id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(fx.accounts.retained.to_string()),
        })
        .await
        .expect("residual must classify to retained earnings");
    residual_applier(&fx.pool).execute(fx.migration_id.clone()).await.expect("residual must apply");

    let locked = locker(&fx.pool).execute(fx.migration_id.clone()).await.expect("lock requires clear 53");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    format!("residual_classification:{}", fx.migration_id)
}

fn monetary(amount: Decimal) -> domain::shared::monetary_amount::MonetaryAmount {
    domain::shared::monetary_amount::MonetaryAmount::from_base(amount, test_currency())
}

// ---------------------------------------------------------------------------
// 1. THE VERDICT GATE — the balanced Debit/Credit feed, exactly two official
//    daily-journal entries, no blank Entry Number / Entry Type on any GL row,
//    all amounts exactly once, and the final TB/BS (465 = 120 + 345).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn canonical_residual_lifecycle_two_official_entries_and_verdict_gate() {
    let fx = fixture("lifecycle", "2026-01-01T00:00:00Z").await;

    // Posting precondition: every sub-ledger reconciles and the opening lines
    // are in equilibrium.
    let recon = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon");
    assert!(recon.all_reconciled, "every sub-ledger must reconcile: {recon:?}");
    assert_eq!(recon.debit_total, dec!(465));
    assert_eq!(recon.credit_total, dec!(465));
    assert!(recon.debit_equals_credit);

    let residual_source = run_full_flow(&fx).await;
    let aggregate_source = format!("opening_balance:{}", fx.migration_id);

    // -- The two official entries exist exactly once each -----------------
    assert_eq!(entry_count_by_source(&fx.pool, &aggregate_source).await, 1,
        "exactly one canonical opening GL posting");
    assert_eq!(entry_count_by_source(&fx.pool, &residual_source).await, 1,
        "exactly one residual classification journal");

    // -- Daily Journal: EXACTLY the two official entries, nothing else -----
    let feed = ListJournalEntriesUseCase::new(
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
    )
    .execute_posted(None, None, None, None)
    .await
    .unwrap();
    assert_eq!(feed.len(), 2, "feed = opening migration + residual classification only");

    let mut sources: Vec<Option<String>> = feed.iter().map(|e| e.source_id.clone()).collect();
    sources.sort();
    let mut expected: Vec<Option<String>> = vec![Some(aggregate_source.clone()), Some(residual_source.clone())];
    expected.sort();
    assert_eq!(sources, expected, "no temporary/preparation journal may reach the feed");

    let mut types: Vec<String> = feed.iter().map(|e| e.journal_type.source_type().to_string()).collect();
    types.sort();
    let mut expected_types: Vec<String> =
        vec![JournalType::AccountOpeningBalance.source_type().to_string(), JournalType::GeneralJournal.source_type().to_string()];
    expected_types.sort();
    assert_eq!(types, expected_types, "one AccountOpeningBalance + one GeneralJournal");

    // -- No blank / duplicated Entry metadata on any GL row ----------------
    assert!(feed.iter().all(|e| !e.entry_number.trim().is_empty()),
        "every official journal carries a non-blank Entry Number");
    assert!(feed.iter().all(|e| e.status == "Posted"));
    assert!(feed.iter().all(|e| e.reversal_of_entry_id.is_none()),
        "no reversal contra may reach the operational feed");
    let numbers: Vec<&str> = feed.iter().map(|e| e.entry_number.as_str()).collect();
    assert_eq!(numbers.len(), numbers.iter().collect::<std::collections::HashSet<_>>().len(),
        "Entry Numbers must be distinct");

    // -- Phase 6 integrity: each logical entry is exactly ONE register entry --
    // The opening migration must surface as a SINGLE daily-journal entry
    // carrying EVERY opening line; the residual journal as a SINGLE entry with
    // its Dr/Cr pair. A per-line split (entries multiplied by lines) is a
    // regression that would show the migration as N separate numbered rows.
    let opening = feed
        .iter()
        .find(|e| e.source_id.as_deref() == Some(aggregate_source.as_str()))
        .expect("the opening migration reaches the feed exactly once");
    assert_eq!(feed.iter().filter(|e| e.source_id.as_deref() == Some(aggregate_source.as_str())).count(), 1,
        "the opening migration must NEVER unnest into per-line journal entries");
    assert_eq!(opening.journal_type, JournalType::AccountOpeningBalance,
        "entry 9 stays an AccountOpeningBalance (Opening Migration)");
    assert_eq!(opening.lines.len(), full_lines(&fx.accounts).len(),
        "the migration is ONE entry holding every opening line");
    assert!(opening.lines.iter().all(|l| l.debit != "0" || l.credit != "0"),
        "every migration line carries a real amount");
    assert_eq!(opening.total_base_debit, dec!(465).to_string());
    assert_eq!(opening.total_base_credit, dec!(465).to_string());

    let residual = feed
        .iter()
        .find(|e| e.source_id.as_deref() == Some(residual_source.as_str()))
        .expect("the residual classification reaches the feed exactly once");
    assert_eq!(feed.iter().filter(|e| e.source_id.as_deref() == Some(residual_source.as_str())).count(), 1,
        "the residual pair must NEVER unnest into two separate entries");
    assert_eq!(residual.journal_type, JournalType::GeneralJournal,
        "entry 10 stays a GeneralJournal (Residual Classification)");
    assert_eq!(residual.lines.len(), 2,
        "the residual classification is ONE entry with exactly its Dr 45 / Cr 45 pair");
    assert_eq!(residual.total_base_debit, dec!(45).to_string());
    assert_eq!(residual.total_base_credit, dec!(45).to_string());

    // Schema-wide backstop: no journal (of any kind) with blank metadata.
    let blanks: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries
         WHERE TRIM(COALESCE(entry_number, '')) = '' OR TRIM(COALESCE(journal_type, '')) = ''",
    )
    .fetch_one(&*fx.pool)
    .await
    .unwrap();
    assert_eq!(blanks, 0, "no journal row may carry a blank entry_number/journal_type");

    // Every GL line surfaced by a ledger carries its parent entry metadata.
    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    for acc in [fx.accounts.ar, fx.accounts.bank, fx.accounts.fa] {
        let ledger = queries.get_ledger(&[acc]).await.expect("ledger");
        assert!(ledger.lines.iter().all(|l| !l.entry_number.trim().is_empty()
            && matches!(l.journal_type, JournalType::AccountOpeningBalance | JournalType::GeneralJournal)),
            "every GL row carries non-blank Entry Number / an official Entry Type");
        assert!(ledger.lines.iter().all(|l| {
            !l.line_id.trim().is_empty()
                && !l.account_id.0.to_string().trim().is_empty()
                && !l.entry_status.trim().is_empty()
                && !l.entry_type.trim().is_empty()
                && !l.journal_type_display.trim().is_empty()
                && !l.journal_id.0.to_string().trim().is_empty()
        }),
            "every GL row carries canonical parent/line identity metadata");
    }

    // -- GL holds every amount exactly once --------------------------------
    assert_eq!(gl_net(&fx.pool, &fx.accounts.cash).await, Decimal::from(25));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.bank).await, Decimal::from(40));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.ar).await, Decimal::from(80));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.inventory).await, Decimal::from(120));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.fa).await, Decimal::from(200),
        "GL fixed-asset opening = 200 exactly once while the sub-ledger keeps the asset");
    assert_eq!(gl_net(&fx.pool, &fx.accounts.ap).await, Decimal::from(-70));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.loan).await, Decimal::from(-50));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.ahmad).await, Decimal::from(-180));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.mohammad).await, Decimal::from(-120));
    assert_eq!(gl_net(&fx.pool, &fx.accounts.obe).await, Decimal::ZERO,
        "OBE 53 must net to zero after the residual reclassification");
    assert_eq!(gl_net(&fx.pool, &fx.accounts.retained).await, Decimal::from(-45),
        "retained earnings holds exactly one 45 effect via the residual journal");

    // Report surface: one movement per sub-ledger account.
    let ar_ledger = queries.get_ledger(&[fx.accounts.ar]).await.expect("AR ledger");
    assert_eq!(ar_ledger.lines.len(), 1, "AR GL exactly one opening movement");

    // -- Reconciliation after reclassification: 53 clear, Dr = Cr ----------
    let after = reconciler(&fx.pool).execute(fx.migration_id.clone()).await.expect("recon after");
    assert!(after.all_reconciled, "sub-ledgers reconcile after lock: {after:?}");
    assert_eq!(after.opening_control_balance, Decimal::ZERO, "control 53 nets zero");
    assert_eq!(after.debit_total, Decimal::from(465));
    assert_eq!(after.credit_total, Decimal::from(465));

    // -- Final Trial Balance / Balance Sheet verdict (465 = 120 + 345) ------
    let pos = positioner(&fx.pool).execute(fx.migration_id.clone()).await.expect("position");
    assert_eq!(pos.total_assets, Decimal::from(465));
    assert_eq!(pos.total_liabilities, Decimal::from(120));
    assert_eq!(pos.total_equity, Decimal::from(345), "300 partner capital + 45 retained via residual");
    assert_eq!(pos.net_assets, Decimal::from(345));
    assert_eq!(pos.total_assets, pos.total_liabilities + pos.total_equity);
    assert!(pos.is_balanced, "trial balance must be balanced");
    assert!(pos.residual_applied, "residual must be applied before lock");
    assert!(!pos.obe_pending_reclassification, "53 must not pend after reclassification");
    assert!(pos.validation_errors.is_empty(), "no readiness blockers after lock");

    // Per-partner slice: Ahmad 180 / Mohammad 120 / 60% / 40%.
    let ahmad = pos.partner_rows.iter().find(|r| r.partner_name == "أحمد").expect("Ahmad row");
    let mohammad = pos.partner_rows.iter().find(|r| r.partner_name == "محمد").expect("Mohammad row");
    assert_eq!(ahmad.capital, Decimal::from(180));
    assert_eq!(mohammad.capital, Decimal::from(120));
    assert_eq!(ahmad.ownership_percent, Decimal::from(60));
    assert_eq!(mohammad.ownership_percent, Decimal::from(40));
    assert_eq!(pos.partner_capital, Decimal::from(300));

    // -- Report reads are pure: only the two official entries/lines exist ----
    let entries_total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*fx.pool).await.unwrap();
    let lines_total: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*fx.pool).await.unwrap();
    assert_eq!(entries_total, 2, "only the two official entries exist");
    assert_eq!(lines_total, 12, "10 opening lines + 2 residual lines");
}

// ---------------------------------------------------------------------------
// 2. IDEMPOTENCY + RESTART — re-posting and re-applying are rejected without
//    duplicates, and a fresh application session on the same database file
//    reproduces identical reports (no duplicated opening effects).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn idempotent_rerun_and_restart_produce_identical_accounting() {
    let fx = fixture("idempotency", "2026-01-01T00:00:00Z").await;
    let residual_source = run_full_flow(&fx).await;
    let aggregate_source = format!("opening_balance:{}", fx.migration_id);
    let db_path = fx.db_path.clone();

    // Snapshot the exact accounting rows before the re-run attempts.
    let entries_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*fx.pool).await.unwrap();
    let lines_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*fx.pool).await.unwrap();
    assert_eq!(entries_before, 2);
    assert_eq!(lines_before, 12);

    // Re-posting the (now Locked) migration must be rejected; no second journal.
    assert!(poster(&fx.pool).execute(fx.migration_id.clone()).await.is_err(),
        "re-posting a posted migration must fail");
    assert_eq!(entry_count_by_source(&fx.pool, &aggregate_source).await, 1);

    // Re-applying the residual must conflict; no second residual journal.
    assert!(residual_applier(&fx.pool).execute(fx.migration_id.clone()).await.is_err(),
        "re-applying an already-applied residual must fail");
    assert_eq!(entry_count_by_source(&fx.pool, &residual_source).await, 1);

    // App restart: drop the live pool and reopen the SAME file.
    fx.pool.close().await;
    let pool2 = restart_pool_at(&db_path).await;

    let feed = ListJournalEntriesUseCase::new(
        Arc::new(SqliteJournalEntryRepository::new(pool2.clone())),
        Arc::new(SqliteAccountRepository::new(pool2.clone())),
    )
    .execute_posted(None, None, None, None)
    .await
    .unwrap();
    assert_eq!(feed.len(), 2, "a fresh session still sees exactly two official entries");
    let mut sources: Vec<Option<String>> = feed.iter().map(|e| e.source_id.clone()).collect();
    sources.sort();
    let mut expected: Vec<Option<String>> =
        vec![Some(aggregate_source.clone()), Some(residual_source.clone())];
    expected.sort();
    assert_eq!(sources, expected);

    // GL amounts are untouched by the restart.
    assert_eq!(gl_net(&pool2, &fx.accounts.cash).await, Decimal::from(25));
    assert_eq!(gl_net(&pool2, &fx.accounts.fa).await, Decimal::from(200));
    assert_eq!(gl_net(&pool2, &fx.accounts.retained).await, Decimal::from(-45));
    assert_eq!(gl_net(&pool2, &fx.accounts.obe).await, Decimal::ZERO);

    // The position verdict survives the restart unchanged.
    let pos = positioner(&pool2).execute(fx.migration_id.clone()).await.expect("position after restart");
    assert_eq!(pos.total_assets, Decimal::from(465));
    assert_eq!(pos.total_liabilities, Decimal::from(120));
    assert_eq!(pos.total_equity, Decimal::from(345));
    assert!(pos.is_balanced);

    let entries_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*pool2).await.unwrap();
    let lines_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*pool2).await.unwrap();
    assert_eq!(entries_after, entries_before, "opening effects never duplicate across a restart");
    assert_eq!(lines_after, lines_before, "opening lines never duplicate across a restart");
}

// ---------------------------------------------------------------------------
// 3. PREP-ENTRY LEAKAGE — a temporary standalone opening-prep journal written
//    BEFORE the migration existed is auto-reversed at post time: the Daily
//    Journal still holds exactly the two official entries and AR nets 80 once.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn temporary_prep_entry_never_survives_after_opening_completes() {
    let fx = fixture("prep", "2026-01-01T00:00:00Z").await;
    let accounts = &fx.accounts;
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone()));

    // A legacy standalone opening-prep journal (created BEFORE the migration)
    // books Dr AR 80 / Cr OBE 80 against accounts the migration owns.
    let mut legacy = JournalEntry::new(
        "LEGACY-AR".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(accounts.ar, monetary(dec!(80)), monetary(dec!(0)), "رصيد افتتاحي مدين (قديم)".into()),
            JournalLine::new(accounts.obe, monetary(dec!(0)), monetary(dec!(80)), "رصيد افتتاحي دائن (قديم)".into()),
        ],
        chrono::Utc::now(),
        "قيد افتتاح عميل قديم".to_string(),
        Some("legacy_customer_opening".to_string()),
    )
    .unwrap();
    legacy.post().unwrap();
    journal_repo.save(&legacy).await.unwrap();

    // The migration (with its own canonical AR 80) then runs the full flow;
    // posting AUTO-REVERSES the legacy prep entry on account membership.
    let residual_source = run_full_flow(&fx).await;
    let aggregate_source = format!("opening_balance:{}", fx.migration_id);

    // The legacy original is Reversed and its contra is linked back to it.
    let (legacy_status, contra_link, contra_type): (String, Option<String>, String) = sqlx::query_as(
        "SELECT je.status, r.reversal_of_entry_id, r.journal_type
         FROM journal_entries je
         LEFT JOIN journal_entries r ON r.reversal_of_entry_id = je.id
         WHERE je.source_id = 'legacy_customer_opening'",
    )
    .fetch_one(&*fx.pool)
    .await
    .unwrap();
    assert_eq!(legacy_status, "Reversed", "legacy prep entry must be auto-reversed");
    assert!(contra_link.is_some(), "reversal contra must exist");
    assert_eq!(contra_type, "AccountOpeningBalance", "contra inherits the original's type");

    // AR nets exactly the single canonical effect (80): 80 − 80 + 80 = 80.
    assert_eq!(gl_net(&fx.pool, &accounts.ar).await, Decimal::from(80),
        "AR GL = 80 exactly once after the auto-reversal");
    assert_eq!(gl_net(&fx.pool, &accounts.obe).await, Decimal::ZERO,
        "OBE 53 nets zero (legacy 80 + reversal −80 + migration 45 − residual 45)");

    // Exactly the two OFFICIAL posted entries remain (the Reversed original is
    // no longer Posted; the contra is a reversal relationship, not an entry).
    let official: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT source_id, entry_number, journal_type FROM journal_entries
         WHERE status = 'Posted' AND reversal_of_entry_id IS NULL
         ORDER BY entry_number",
    )
    .fetch_all(&*fx.pool)
    .await
    .unwrap();
    assert_eq!(official.len(), 2, "only the opening migration + residual classification are official");
    assert_eq!(official[0].0, aggregate_source, "first official entry is the opening migration");
    assert_eq!(official[1].0, residual_source, "second official entry is the residual journal");
    assert!(official.iter().all(|e| !e.1.trim().is_empty() && !e.2.trim().is_empty()),
        "every official entry carries non-blank metadata");

    // The posted feed applies the POSTED-LEDGER policy (ReversalScope): the
    // reversal contra is excluded SERVER-SIDE — only the two official entries
    // reach it, while the audit archive (the full register) keeps the contra.
    let feed = ListJournalEntriesUseCase::new(
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
    )
    .execute_posted(None, None, None, None)
    .await
    .unwrap();
    assert_eq!(feed.len(), 2, "only the two official entries reach the posted feed");
    assert!(feed.iter().all(|e| e.reversal_of_entry_id.is_none()),
        "the reversal contra is excluded from the posted feed (the audit archive keeps it)");

    // Report surface: the AR ledger shows ONLY the aggregate movement.
    let queries = AccountQueries::new(
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
    );
    let ar_ledger = queries.get_ledger(&[accounts.ar]).await.expect("AR ledger");
    assert_eq!(ar_ledger.lines.len(), 1, "report surface hides the reversal pair");

    // The FULL register (the source the Audit archive reads —
    // `execute` with ReversalScope::All): it carries the COMPLETE
    // non-operational history — the Reversed legacy original AND its Posted
    // contra, records never deleted — while the operational surface stays
    // exactly the two official entries.
    let full = ListJournalEntriesUseCase::new(
        Arc::new(SqliteJournalEntryRepository::new(fx.pool.clone())),
        Arc::new(SqliteAccountRepository::new(fx.pool.clone())),
    )
    .execute(None, None, None, None, None, None)
    .await
    .unwrap();
    assert_eq!(full.len(), 4, "full register = 2 official + legacy original + its contra");
    assert_eq!(full.iter().filter(|e| e.reversal_of_entry_id.is_some()).count(), 1,
        "exactly the contra carries the reversal link");
    assert_eq!(full.iter().filter(|e| e.status == "Reversed").count(), 1,
        "the Reversed legacy original stays in the archive (records never deleted)");
    assert_eq!(full.iter().filter(|e| e.status == "Posted").count(), 3,
        "2 official + the Posted contra");
    assert_eq!(full.iter().filter(|e| e.reversal_of_entry_id.is_none() && e.status == "Posted").count(), 2,
        "the two official entries are the only operational rows");
    let ata_contra = full.iter().find(|e| e.reversal_of_entry_id.is_some()).expect("contra present");
    let legacy_id = legacy.id.0.to_string();
    assert_eq!(ata_contra.reversal_of_entry_id.as_deref(), Some(legacy_id.as_str()),
        "the contra points back at the legacy original — the audit archive keeps the pair linked");
}