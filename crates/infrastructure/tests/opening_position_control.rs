use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::use_cases::opening_balance::GetOpeningPositionControlUseCase;
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::account::SqliteAccountRepository;
use infrastructure::repositories::opening_balance::SqliteOpeningMigrationRepository;
use infrastructure::repositories::partner::SqlitePartnerRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> domain::shared::currency::Currency {
    domain::shared::currency::Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_oposition_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// A balanced opening position (100k assets, 40k liabilities, 60k equity) must
/// be reported as balanced AND must not create a single journal entry: viewing
/// the position is strictly READ ONLY.
#[tokio::test]
async fn position_is_balanced_and_read_only() {
    let pool = build_pool().await;

    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let cash = account("1901", AccountType::Assets, AccountPurpose::General);
    let suppliers = account("2901", AccountType::Liabilities, AccountPurpose::Payable);
    let capital = account("3101", AccountType::Equity, AccountPurpose::PartnerCapital);
    for a in [&cash, &suppliers, &capital] {
        account_repo.save(a).await.unwrap();
    }

    let migration = OpeningBalanceMigration::new(
        "mig-position-balanced".into(),
        chrono::Utc::now(),
        None,
        vec![
            OpeningBalanceLine {
                account_id: cash.id,
                amount: dec!(100000),
                description: None,
            },
            OpeningBalanceLine {
                account_id: suppliers.id,
                amount: dec!(40000),
                description: None,
            },
            OpeningBalanceLine {
                account_id: capital.id,
                amount: dec!(60000),
                description: None,
            },
        ],
    )
    .expect("valid migration");

    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    migration_repo.create(&migration).await.unwrap();
    let partner_repo = Arc::new(SqlitePartnerRepository::new(pool.clone()));

    let before = journal_counts(&pool).await;

    let dto = GetOpeningPositionControlUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        partner_repo.clone(),
        Arc::new(infrastructure::repositories::opening_balance::SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(infrastructure::repositories::journal_entry::SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(migration.id.clone())
    .await
    .expect("position computed");

    assert_eq!(dto.total_assets, dec!(100000));
    assert_eq!(dto.total_liabilities, dec!(40000));
    assert_eq!(dto.net_assets, dec!(60000));
    assert_eq!(dto.partner_capital, dec!(60000));
    assert_eq!(dto.total_equity, dec!(60000));
    assert_eq!(dto.equity_difference, dec!(0));
    assert!(dto.is_balanced, "balanced migration must report balanced");
    assert!(dto.difference_message.is_none());

    // The liability and asset lines are classified by purpose semantics.
    assert!(dto.liability_detail.iter().any(|l| l.group_key == "Payable"));

    // READ-ONLY invariant: the report never writes journal entries.
    assert_eq!(journal_counts(&pool).await, before, "position view must not create journal entries");
}

/// An unbalanced migration reports the exact difference and never fabricates a
/// journal entry to hide it.
#[tokio::test]
async fn position_reports_unbalanced_difference_read_only() {
    let pool = build_pool().await;

    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let cash = account("1902", AccountType::Assets, AccountPurpose::General);
    let suppliers = account("2902", AccountType::Liabilities, AccountPurpose::Payable);
    let capital = account("3102", AccountType::Equity, AccountPurpose::PartnerCapital);
    let retained = account("3103", AccountType::Equity, AccountPurpose::RetainedEarnings);
    for a in [&cash, &suppliers, &capital, &retained] {
        account_repo.save(a).await.unwrap();
    }

    let migration = OpeningBalanceMigration::new(
        "mig-position-unbalanced".into(),
        chrono::Utc::now(),
        None,
        vec![
            OpeningBalanceLine {
                account_id: cash.id,
                amount: dec!(100000),
                description: None,
            },
            OpeningBalanceLine {
                account_id: suppliers.id,
                amount: dec!(40000),
                description: None,
            },
            OpeningBalanceLine {
                account_id: capital.id,
                amount: dec!(50000),
                description: None,
            },
            OpeningBalanceLine {
                account_id: retained.id,
                amount: dec!(5000),
                description: None,
            },
        ],
    )
    .expect("valid migration");

    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    migration_repo.create(&migration).await.unwrap();
    let partner_repo = Arc::new(SqlitePartnerRepository::new(pool.clone()));

    let before = journal_counts(&pool).await;

    let dto = GetOpeningPositionControlUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        partner_repo.clone(),
        Arc::new(infrastructure::repositories::opening_balance::SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(infrastructure::repositories::journal_entry::SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(migration.id)
    .await
    .unwrap();

    assert_eq!(dto.net_assets, dec!(60000));
    assert_eq!(dto.total_equity, dec!(55000));
    assert_eq!(dto.equity_difference, dec!(5000));
    assert!(!dto.is_balanced);
    assert!(dto.difference_message.is_some(), "difference must be surfaced, never hidden");

    assert_eq!(journal_counts(&pool).await, before, "reporting must not create journal entries");
}