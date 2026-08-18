//! Unified Company Accounting Model: New vs Existing companies
//! differ ONLY by lifecycle context (an open opening-balance migration window).
//!
//! Covered here:
//! - NewCompany:  partner + explicit capital contribution -> cash AND capital
//!   ledger balances increase (a real cash event).
//! - ExistingCompany: partner registered with historical capital -> NO cash
//!   increase, NO journal: the balance is a static opening balance owned by the
//!   migration (Sec 5).
//! - The capital-contribution guard blocks a cash injection while an opening
//!   window is open (Draft..Approved).
//! - The migration-create guard blocks a migration for a NewCompany.
//! - The SAME CreateCustomerUseCase builds a real linked entity in both
//!   lifecycles; only the ledger treatment of the opening amount differs.

use std::str::FromStr;
use std::sync::Arc;

use application::dto::customer_dto::CreateCustomerRequest;
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::customer::CreateCustomerUseCase;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::CreateOpeningBalanceUseCase;
use application::use_cases::partner::CreateCapitalContributionUseCase;
use application::use_cases::partner::CreatePartnerUseCase;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteCustomerRepository,
    SqliteJournalEntryRepository, SqliteOpeningMigrationRepository, SqlitePartnerRepository,
    SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_company_lifecycle_{}.sqlite", uuid::Uuid::new_v4()));
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
    // Seed the base currency the app bootstrap normally provides.
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let base = domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    currency_repo.save(&base).await.unwrap();
    currency_repo.set_base_currency("S").await.unwrap();
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

/// Sum of posted journal lines touching an account (base units). A positive
/// result means a net debit increase; credit-normal accounts (capital) yield a
/// negative value for credits.
async fn ledger_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> f64 {
    sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit AS REAL) - CAST(credit AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn journal_lines_for_account_count(pool: &sqlx::SqlitePool, account_id: &AccountId) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap()
}

async fn account_opening_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> f64 {
    sqlx::query_scalar::<_, f64>("SELECT CAST(opening_balance AS REAL) FROM accounts WHERE id = ?")
        .bind(account_id.0.to_string())
        .fetch_one(pool)
        .await
        .unwrap()
}

fn close_enough(actual: f64, expected: f64) -> bool {
    (actual - expected).abs() < 0.01
}

async fn create_partner(
    pool: &Arc<sqlx::SqlitePool>,
    mode: &str,
    registered_capital: Decimal,
) -> String {
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    CreatePartnerUseCase::new(partner_repo, account_repo, currency_repo)
        .execute(
            "شريك".into(),
            "S".into(),
            Decimal::ONE,
            registered_capital,
            false,
            "BasedOnCapitalLocal".into(),
            None,
            mode.into(),
        )
        .await
        .expect("create partner")
}

async fn capital_account_id(pool: &Arc<sqlx::SqlitePool>, partner_id: &str) -> AccountId {
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let partner = partner_repo
        .find_by_id(&domain::shared::ids::PartnerId::from_str(partner_id).unwrap())
        .await
        .unwrap()
        .expect("partner exists");
    partner.linked_account_id.expect("partner has capital account")
}

async fn create_draft_migration(pool: &Arc<sqlx::SqlitePool>) -> String {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let case = CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo);
    let result = case
        .execute(application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: vec![
                OpeningLineInput { account_id: cash.to_string(), amount: "1000".into(), description: None },
                OpeningLineInput { account_id: equity.to_string(), amount: "1000".into(), description: None },
            ],
        })
        .await
        .expect("create migration");
    result.0.id
}

// ---------------------------------------------------------------------------
// Test 1 — NewCompany: a real cash capital contribution increases BOTH cash and
// the partner's capital ledger. Master-data capital stays static.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn new_company_contribution_increases_cash_and_capital() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let partner_id = create_partner(&pool, "NewCompany", Decimal::from(1000)).await;
    let cap_id = capital_account_id(&pool, &partner_id).await;
    let cash_id = account_id_by_code(&pool, "122").await;

    // No migration exists -> window closed -> the contribution is a real event.
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    CreateCapitalContributionUseCase::new(
        partner_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo,
    )
    .execute(partner_id.clone(), cash_id.to_string(), Decimal::from(500), false, Some("n1".into()))
    .await
    .expect("contribution posts");

    // Cash increased by exactly the contribution.
    assert!(close_enough(ledger_balance(&pool, &cash_id).await, 500.0), "cash must increase by 500");
    // Capital ledger balance increased by exactly the contribution (credit side).
    assert!(close_enough(ledger_balance(&pool, &cap_id).await, -500.0), "capital ledger must increase by 500 (credit)");
    // Master data is NOT mutated by the event (ledger is the truth).
    let master: String = sqlx::query_scalar("SELECT amount_local FROM partners WHERE id = ?")
        .bind(&partner_id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(master, "1000", "master capital must stay static");
}

// ---------------------------------------------------------------------------
// Test 2 — ExistingCompany: registering historical partner capital posts NO
// journal and does NOT increase cash. The balance is a static opening balance
// that the migration owns.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn existing_company_opening_capital_does_not_increase_cash() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let partner_id = create_partner(&pool, START_MODE_EXISTING, Decimal::from(1000)).await;
    let cap_id = capital_account_id(&pool, &partner_id).await;
    let cash_id = account_id_by_code(&pool, "122").await;

    // No journal may have been posted by partner master-data registration.
    let journal_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(journal_count, 0, "partner registration must post no journal");

    assert!(close_enough(ledger_balance(&pool, &cash_id).await, 0.0), "cash must NOT increase");
    // Historical capital is carried as the capital account's static opening.
    assert!(
        close_enough(account_opening_balance(&pool, &cap_id).await, 1000.0),
        "capital account must carry static opening balance"
    );
    assert!(close_enough(ledger_balance(&pool, &cap_id).await, 0.0), "no capital journal yet");
}

// ---------------------------------------------------------------------------
// Test 3 — The guard blocks a new-company-style cash contribution while an
// opening window is open (Draft..Approved).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn capital_contribution_blocked_while_migration_window_open() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    // An active window: a Draft migration exists.
    create_draft_migration(&pool).await;

    let partner_id = create_partner(&pool, START_MODE_EXISTING, Decimal::from(1000)).await;
    let cash_id = account_id_by_code(&pool, "122").await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    let err = CreateCapitalContributionUseCase::new(
        partner_repo,
        account_repo,
        journal_repo,
        migration_repo,
    )
    .execute(partner_id, cash_id.to_string(), Decimal::from(500), false, Some("blocked".into()))
    .await
    .expect_err("contribution must be rejected while the window is open");
    assert!(
        err.to_string().contains("رأس مال"),
        "expected an actionable Arabic rejection, got: {err}"
    );
}

// ---------------------------------------------------------------------------
// Test 4 — A NewCompany cannot create an opening-balance migration at all.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn migration_create_blocked_for_new_company() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));

    let err = CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo)
        .execute(application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: vec![
                OpeningLineInput { account_id: cash.to_string(), amount: "100".into(), description: None },
                OpeningLineInput { account_id: equity.to_string(), amount: "100".into(), description: None },
            ],
        })
        .await
        .expect_err("NewCompany must not create a migration");
    assert!(
        err.to_string().contains("شركة جديدة"),
        "expected a NewCompany rejection, got: {err}"
    );
}

// ---------------------------------------------------------------------------
// Test 5 — The SAME CreateCustomerUseCase builds a real linked customer in both
// lifecycles. The lifecycle context only changes the ledger treatment of the
// opening amount: deferred to the migration during the window, none in
// NewCompany normal operation.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn same_create_customer_use_case_in_both_lifecycles() {
    // --- Existing company, active window: the per-entity opening journal is
    //     deferred to the migration (static zero) and NO journal is posted.
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    create_draft_migration(&pool).await;

    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    let customer = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "".into(),
        name: "عميل افتتاحي".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: None,
        opening_balance: Some("500".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer during window");

    let customer_account_id_str = customer.account_id.as_ref().expect("customer must be linked to an account");
    let customer_account_id = AccountId(uuid::Uuid::parse_str(customer_account_id_str).unwrap());
    // Real linked entity: the account is a receivable detail account linked to
    // the customer (not a free-text "Opening Customer" store).
    assert!(
        close_enough(account_opening_balance(&pool, &customer_account_id).await, 0.0),
        "during the window the linked account must carry a static zero opening"
    );
    assert_eq!(
        journal_lines_for_account_count(&pool, &customer_account_id).await,
        0,
        "the per-entity opening journal must be deferred to the migration"
    );

    // --- New company: the same use case builds a normal operational customer
    //     with no opening journal (no opening balance to carry).
    let pool2 = build_pool().await;
    set_start_mode(&pool2, "NewCompany").await;

    let customer_repo2 = Arc::new(SqliteCustomerRepository::new(pool2.clone()));
    let account_repo2: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool2.clone()));
    let journal_repo2 = Arc::new(SqliteJournalEntryRepository::new(pool2.clone()));
    let migration_repo2 = Arc::new(SqliteOpeningMigrationRepository::new(pool2.clone()));

    let customer2 = CreateCustomerUseCase::new(
        customer_repo2.clone(),
        account_repo2.clone(),
        journal_repo2.clone(),
        migration_repo2.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "".into(),
        name: "عميل جديد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: None,
        opening_balance: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer in new company");

    let customer_account_id2_str = customer2.account_id.as_ref().expect("customer must be linked to an account");
    let customer_account_id2 = AccountId(uuid::Uuid::parse_str(customer_account_id2_str).unwrap());
    assert_eq!(
        journal_lines_for_account_count(&pool2, &customer_account_id2).await,
        0,
        "new-company operational customer posts no journal"
    );
}
