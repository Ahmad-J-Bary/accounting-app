//! Opening journals for Chart of Accounts creates/updates.
//!
//! While an opening-migration window is open (ExistingCompany) per-account
//! opening journals are deferred to the migration and a create books nothing.
//! Once the window closes (NewCompany):
//! - Creating a plain CoA account with ONLY `opening_balance` (no debit/credit
//!   direction pair, as the simplified COA form sends) must still book the
//!   opening amount on the account's normal-balance side — otherwise the
//!   ledger-driven tree stays at zero.
//! - Editing `opening_balance` must book a posted delta journal so tree
//!   balances move immediately after the edit.
//! - While the window is still open, the update books nothing (the migration
//!   owns the ledger).

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::account::types::CreateAccountCommand;
use application::use_cases::account::{CreateAccountUseCase, UpdateAccountUseCase};
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::CreateOpeningBalanceUseCase;
use domain::accounting::account::{AccountCategory, AccountType};
use domain::shared::ids::AccountId;
use domain::shared::Currency;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteCustomerRepository,
    SqliteJournalEntryRepository, SqliteOpeningMigrationRepository, SqliteSettingsRepository,
    SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_account_opening_journal_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
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
    let base = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
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

/// Creates a DRAFT opening migration so the opening window is active
/// (ExistingCompany), mirroring the state a mid-wizard company is in.
async fn create_draft_migration(pool: &Arc<sqlx::SqlitePool>) {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let case = CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo);
    case.execute(
        application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: vec![
                OpeningLineInput {
                    account_id: cash.to_string(),
                    amount: "1000".into(),
                    description: None,
                },
                OpeningLineInput {
                    account_id: equity.to_string(),
                    amount: "1000".into(),
                    description: None,
                },
            ],
        },
    )
    .await
    .expect("create draft migration");
}

fn cmd(code: &str, parent: AccountId, opening: &str, debit: Option<&str>) -> CreateAccountCommand {
    CreateAccountCommand {
        code: code.into(),
        name_ar: "حساب اختبار افتتاحي".into(),
        name_en: "Opening Test Account".into(),
        account_type: AccountType::Assets,
        parent_id: Some(parent),
        category: AccountCategory::Detail,
        level: 2,
        opening_balance: opening.into(),
        notes: None,
        linked_customer_id: None,
        linked_supplier_id: None,
        phone: None,
        address: None,
        debit: debit.map(|s| s.into()),
        credit: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
    }
}

async fn net_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let debit: String = sqlx::query_scalar(
        "SELECT CAST(COALESCE(SUM(debit_base),0) AS TEXT) FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    let credit: String = sqlx::query_scalar(
        "SELECT CAST(COALESCE(SUM(credit_base),0) AS TEXT) FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::from_str(&debit).unwrap() - Decimal::from_str(&credit).unwrap()
}

fn create_use_case(pool: &Arc<sqlx::SqlitePool>) -> CreateAccountUseCase {
    CreateAccountUseCase::new(
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Some(Arc::new(SqliteCustomerRepository::new(pool.clone()))),
        Some(Arc::new(SqliteSupplierRepository::new(pool.clone()))),
        Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    )
}

fn update_use_case(pool: &Arc<sqlx::SqlitePool>) -> UpdateAccountUseCase {
    UpdateAccountUseCase::new(
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Some(Arc::new(SqliteCustomerRepository::new(pool.clone()))),
        Some(Arc::new(SqliteSupplierRepository::new(pool.clone()))),
        Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    )
}

#[tokio::test]
async fn create_books_single_sided_opening_post_window() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;
    let assets_root = account_id_by_code(&pool, "1").await;

    let account = create_use_case(&pool)
        .execute(cmd("1102", assets_root, "1000", None))
        .await
        .expect("create single-sided opening account");

    assert_eq!(account.opening_balance, Decimal::from(1000));

    // The single-sided opening (debit/credit absent) must still be booked on
    // the account's normal (debit) side — this is what feeds the tree.
    assert_eq!(
        net_balance(&pool, &account.id).await,
        Decimal::from(1000),
        "account must carry its opening in the ledger"
    );

    // And its counter-part must land on opening balance equity (53).
    assert_eq!(
        net_balance(&pool, &account_id_by_code(&pool, "53").await).await,
        -Decimal::from(1000),
        "opening balance equity must hold the contra"
    );
}

#[tokio::test]
async fn update_books_opening_delta_post_window() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;
    let assets_root = account_id_by_code(&pool, "1").await;

    let created = create_use_case(&pool)
        .execute(cmd("1102", assets_root, "1000", None))
        .await
        .expect("create opening account");

    // Raise the opening: +1000 delta must appear on the natural side.
    let raised = update_use_case(&pool)
        .execute(created.id, cmd("1102", assets_root, "2000", None))
        .await
        .expect("raise opening");
    assert_eq!(raised.opening_balance, Decimal::from(2000));
    assert_eq!(
        net_balance(&pool, &created.id).await,
        Decimal::from(2000),
        "raised opening must move the ledger by +1000"
    );

    // Lower the opening: −1500 delta must reverse onto the contra side.
    let lowered = update_use_case(&pool)
        .execute(created.id, cmd("1102", assets_root, "500", None))
        .await
        .expect("lower opening");
    assert_eq!(lowered.opening_balance, Decimal::from(500));
    assert_eq!(
        net_balance(&pool, &created.id).await,
        Decimal::from(500),
        "lowered opening must move the ledger by -1500"
    );

    // Same value again: no further journal may be created.
    let unchanged: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&*pool)
        .await
        .unwrap();
    update_use_case(&pool)
        .execute(created.id, cmd("1102", assets_root, "500", None))
        .await
        .expect("no-op update");
    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(unchanged, after, "no-delta update must not post a journal");
}

#[tokio::test]
async fn update_skips_delta_while_opening_window_open() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    create_draft_migration(&pool).await;
    let assets_root = account_id_by_code(&pool, "1").await;

    let created = create_use_case(&pool)
        .execute(cmd("1102", assets_root, "1000", Some("1000")))
        .await
        .expect("create during window (opening deferred, static zero)");
    assert_eq!(created.opening_balance, Decimal::ZERO);

    let updated = update_use_case(&pool)
        .execute(created.id, cmd("1102", assets_root, "1500", Some("1500")))
        .await
        .expect("update during window");
    assert_eq!(updated.opening_balance, Decimal::from(1500));

    // The migration owns the ledger while the window is open: the edit changes
    // the static metadata only and must not book anything.
    assert_eq!(
        net_balance(&pool, &created.id).await,
        Decimal::ZERO,
        "no opening journal may post while the migration window is open"
    );
}
