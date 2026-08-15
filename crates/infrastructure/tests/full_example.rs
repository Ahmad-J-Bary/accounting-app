use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::use_cases::opening_balance::{
    GetOpeningPositionControlUseCase, SetResidualClassificationCommand,
    SetResidualClassificationUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::account::SqliteAccountRepository;
use infrastructure::repositories::opening_balance::SqliteOpeningMigrationRepository;
use infrastructure::repositories::partner::SqlitePartnerRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

// ── Spec §23 H: the exact full example ─────────────────────────────────────
//   Cash 25,000 + Bank 40,000 + Receivables 80,000 + Inventory 120,000 +
//   Fixed Assets 200,000                       = Total Assets 465,000
//   Suppliers 70,000 + Loan 50,000             = Total Liabilities 120,000
//                        Net Assets            = 345,000
//   Partner Capital (Ahmad 180,000 + Mohammad 120,000) = 300,000
//   Residual (Net Assets − Recognized Equity)  = 45,000
//   After the residual is explicitly classified → Difference = 0.

fn test_currency() -> domain::shared::currency::Currency {
    domain::shared::currency::Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_full_example_test_{}.sqlite", uuid::Uuid::new_v4()));
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
    pool
}

fn account(code: &str, account_type: AccountType, purpose: AccountPurpose) -> Account {
    Account::new(
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
    .with_purpose(purpose)
}

async fn journal_counts(pool: &sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(pool)
        .await
        .unwrap()
}

fn position_use_case(
    pool: &Arc<sqlx::SqlitePool>,
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
) -> GetOpeningPositionControlUseCase {
    GetOpeningPositionControlUseCase::new(
        migration_repo,
        account_repo,
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(infrastructure::repositories::opening_balance::SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(infrastructure::repositories::journal_entry::SqliteJournalEntryRepository::new(pool.clone())),
    )
}

fn full_example_lines(accounts: &FullAccounts) -> Vec<OpeningBalanceLine> {
    vec![
        OpeningBalanceLine { account_id: accounts.cash.id, amount: dec!(25000), description: None },
        OpeningBalanceLine { account_id: accounts.bank.id, amount: dec!(40000), description: None },
        OpeningBalanceLine { account_id: accounts.receivable.id, amount: dec!(80000), description: None },
        OpeningBalanceLine { account_id: accounts.inventory.id, amount: dec!(120000), description: None },
        OpeningBalanceLine { account_id: accounts.fixed.id, amount: dec!(200000), description: None },
        OpeningBalanceLine { account_id: accounts.payable.id, amount: dec!(70000), description: None },
        OpeningBalanceLine { account_id: accounts.loan.id, amount: dec!(50000), description: None },
        OpeningBalanceLine { account_id: accounts.capital.id, amount: dec!(300000), description: None },
    ]
}

struct FullAccounts {
    cash: Account,
    bank: Account,
    receivable: Account,
    inventory: Account,
    fixed: Account,
    payable: Account,
    loan: Account,
    capital: Account,
}

async fn seed_full_example_accounts(account_repo: &dyn AccountRepository) -> FullAccounts {
    let a = FullAccounts {
        cash: account("1901", AccountType::Assets, AccountPurpose::General),
        bank: account("1902", AccountType::Assets, AccountPurpose::General),
        receivable: account("1903", AccountType::Assets, AccountPurpose::Receivable),
        inventory: account("1904", AccountType::Assets, AccountPurpose::Inventory),
        fixed: account("1905", AccountType::Assets, AccountPurpose::FixedAsset),
        payable: account("2901", AccountType::Liabilities, AccountPurpose::Payable),
        loan: account("2902", AccountType::Liabilities, AccountPurpose::General),
        capital: account("3101", AccountType::Equity, AccountPurpose::PartnerCapital),
    };
    for acc in [
        &a.cash, &a.bank, &a.receivable, &a.inventory, &a.fixed, &a.payable, &a.loan, &a.capital,
    ] {
        account_repo.save(acc).await.unwrap();
    }
    a
}

/// The exact §23 H totals must be surfaced with the precise 45,000 residual and
/// a difference message — read-only, no journal entries, never silently hidden.
#[tokio::test]
async fn full_example_shows_exact_difference_read_only() {
    let pool = build_pool().await;

    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let a = seed_full_example_accounts(account_repo.as_ref()).await;

    let migration = OpeningBalanceMigration::new(
        "mig-full-example".into(),
        chrono::Utc::now(),
        None,
        full_example_lines(&a),
    )
    .expect("valid migration");

    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    migration_repo.create(&migration).await.unwrap();

    let before = journal_counts(&pool).await;
    let dto = position_use_case(&pool, migration_repo.clone(), account_repo.clone())
        .execute(migration.id.clone())
        .await
        .expect("position computed");

    assert_eq!(dto.total_assets, dec!(465000), "Total Assets = 465,000");
    assert_eq!(dto.total_liabilities, dec!(120000), "Total Liabilities = 120,000");
    assert_eq!(dto.net_assets, dec!(345000), "Net Assets = 345,000");
    assert_eq!(dto.partner_capital, dec!(300000), "Partner Capital = 300,000");
    assert_eq!(dto.total_equity, dec!(300000), "Recognized Equity = 300,000");
    assert_eq!(dto.equity_difference, dec!(45000), "Residual = 45,000");
    assert!(!dto.is_balanced, "before classification the position must not be balanced");
    assert!(
        dto.difference_message.is_some(),
        "the exact difference must be surfaced, never silently plugged",
    );

    // Read-only invariant: reporting never writes journal entries.
    assert_eq!(
        journal_counts(&pool).await,
        before,
        "reporting the position must not create journal entries",
    );
}

/// After the residual is EXPLICITLY classified the position reports Difference =
/// 0, and the recorded classification is a real residual class (never an
/// auto-forced current-period "Net Profit").
#[tokio::test]
async fn full_example_explicit_classification_balances_and_never_forces_profit() {
    let pool = build_pool().await;

    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let a = seed_full_example_accounts(account_repo.as_ref()).await;
    let obe = account("3102", AccountType::Equity, AccountPurpose::OpeningBalanceEquity);
    let retained = account("3103", AccountType::Equity, AccountPurpose::RetainedEarnings);
    for acc in [&obe, &retained] {
        account_repo.save(acc).await.unwrap();
    }

    // The same full example PLUS the explicitly classified residual plug on the
    // Opening Balance Equity (53) control — the accountant's declared decision.
    let mut lines = full_example_lines(&a);
    lines.push(OpeningBalanceLine { account_id: obe.id, amount: dec!(45000), description: None });

    let migration = OpeningBalanceMigration::new(
        "mig-full-example-classified".into(),
        chrono::Utc::now(),
        None,
        lines,
    )
    .expect("valid migration");

    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    migration_repo.create(&migration).await.unwrap();

    let dto = position_use_case(&pool, migration_repo.clone(), account_repo.clone())
        .execute(migration.id.clone())
        .await
        .expect("position computed");

    assert_eq!(dto.net_assets, dec!(345000));
    assert_eq!(dto.opening_equity_adjustment, dec!(45000), "the 53 plug carries the residual");
    assert_eq!(dto.total_equity, dec!(345000), "classified equity = 300,000 + 45,000");
    assert_eq!(dto.equity_difference, dec!(0), "Difference = 0 after explicit classification");
    assert!(dto.is_balanced, "classified residual must balance the position");
    assert!(dto.difference_message.is_none());

    // Record an explicit classification on the migration and verify it persists
    // as a real residual class — RetainedEarnings, never "NetProfit".
    SetResidualClassificationUseCase::new(migration_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration.id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(retained.id.0.to_string()),
        })
        .await
        .unwrap();

    let stored: Option<String> = sqlx::query_scalar(
        "SELECT residual_classification FROM opening_balance_migrations WHERE id = ?",
    )
    .bind(&migration.id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(stored.as_deref(), Some("RetainedEarnings"));
    assert_ne!(
        stored.as_deref(),
        Some("NetProfit"),
        "the residual is never silently classified as current-period profit",
    );

    // The position snapshot now reports the chosen classification.
    let classified_dto = position_use_case(&pool, migration_repo.clone(), account_repo.clone())
        .execute(migration.id.clone())
        .await
        .unwrap();
    assert_eq!(classified_dto.classification.as_deref(), Some("RetainedEarnings"));
    assert_eq!(classified_dto.equity_difference, dec!(0));
}