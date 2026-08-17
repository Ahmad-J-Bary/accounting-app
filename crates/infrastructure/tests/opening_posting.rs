use std::str::FromStr;
use std::sync::Arc;

use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteOpeningPostingRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn balanced_lines(amount: Decimal, account_a: AccountId, account_b: AccountId) -> Vec<JournalLine> {
    let c = test_currency();
    vec![
        JournalLine::new(
            account_a,
            MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
            MonetaryAmount::zero(c.clone()),
            "مدين".to_string(),
        ),
        JournalLine::new(
            account_b,
            MonetaryAmount::zero(c.clone()),
            MonetaryAmount::new(Money::new(amount, c), dec!(1)),
            "دائن".to_string(),
        ),
    ]
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_obposting_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Two real account ids from the seeded chart of accounts (FK-safe for journal_lines).
async fn real_accounts(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let ids: Vec<String> =
        sqlx::query_scalar("SELECT id FROM accounts ORDER BY code LIMIT 2")
            .fetch_all(pool)
            .await
            .unwrap();
    assert!(ids.len() >= 2, "chart of accounts must be seeded");
    (
        AccountId(uuid::Uuid::parse_str(&ids[0]).unwrap()),
        AccountId(uuid::Uuid::parse_str(&ids[1]).unwrap()),
    )
}

/// Inserts a migration header row (schema from migrations 139/140).
async fn insert_migration(pool: &sqlx::SqlitePool, id: &str, cutover: chrono::DateTime<Utc>) {
    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at)
         VALUES (?, ?, 'Draft', NULL, NULL, datetime('now'), datetime('now'))",
    )
    .bind(id)
    .bind(cutover.to_rfc3339())
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn opening_posting_persists_canonical_source_type() {
    let pool = build_pool().await;
    let repo = SqliteOpeningPostingRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_migration(pool.as_ref(), &migration_id, Utc::now()).await;

    let mut migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        Utc::now(),
        None,
        vec![OpeningBalanceLine { account_id: acc_a, amount: dec!(500), description: None }],
    )
    .unwrap();
    migration.validate("tester").unwrap();
    migration.approve("tester").unwrap();
    migration.mark_posted().unwrap();

    let mut entry = JournalEntry::new(
        "OB-1000".to_string(),
        JournalType::AccountOpeningBalance,
        balanced_lines(dec!(500), acc_a, acc_b),
        migration.cutover_date,
        "قيد ترحيل رصيد افتتاح الشركة".to_string(),
        Some(format!("opening_balance:{}", migration.id)),
    )
    .unwrap();
    entry.post().unwrap();

    repo.post(&migration, &entry).await.unwrap();

    let stored: (String, Option<String>) = sqlx::query_as(
        "SELECT journal_type, source_type FROM journal_entries WHERE id = ?",
    )
    .bind(entry.id.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(stored.0, "AccountOpeningBalance");
    assert_eq!(
        stored.1.as_deref(),
        Some("account_opening_balance"),
        "opening journal must persist its canonical source_type"
    );

    let status: String = sqlx::query_scalar(
        "SELECT status FROM opening_balance_migrations WHERE id = ?",
    )
    .bind(&migration_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(status, "Posted", "posting must mark the migration Posted");
}

#[tokio::test]
async fn opening_cancel_persists_canonical_source_type() {
    let pool = build_pool().await;
    let repo = SqliteOpeningPostingRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_migration(pool.as_ref(), &migration_id, Utc::now()).await;

    let migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        Utc::now(),
        None,
        vec![OpeningBalanceLine { account_id: acc_a, amount: dec!(300), description: None }],
    )
    .unwrap();

    // The posted opening journal the migration produced (AccountOpeningBalance).
    let c = test_currency();
    let mut original = JournalEntry::new(
        "OB-1000".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(
                acc_a,
                MonetaryAmount::new(Money::new(dec!(300), c.clone()), dec!(1)),
                MonetaryAmount::zero(c.clone()),
                "رصيد افتتاح".to_string(),
            ),
            JournalLine::new(
                acc_b,
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::new(Money::new(dec!(300), c), dec!(1)),
                "رصيد افتتاح".to_string(),
            ),
        ],
        Utc::now(),
        "ترحيل رصيد الافتتاح".to_string(),
        Some(format!("opening_balance:{migration_id}")),
    )
    .unwrap();
    original.post().unwrap();

    // The cancellational contra inherits the original's type and links back.
    let mut reversal = JournalEntry::create_reversal(
        &original,
        "OB-1001".to_string(),
        Utc::now(),
        "عكس ترحيل رصيد الافتتاح".to_string(),
    )
    .unwrap();
    reversal = reversal.with_source_type("opening_balance_reversal".to_string());
    assert_eq!(reversal.journal_type, JournalType::AccountOpeningBalance);
    reversal.post().unwrap();

    repo.cancel(&migration, &reversal, &original).await.unwrap();

    let stored: (String, Option<String>) = sqlx::query_as(
        "SELECT journal_type, source_type FROM journal_entries WHERE id = ?",
    )
    .bind(reversal.id.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(stored.0, "AccountOpeningBalance", "a reversal is a relationship, not a type");
    assert_eq!(
        stored.1.as_deref(),
        Some("opening_balance_reversal"),
        "opening reversal journal must persist its canonical source_type"
    );

    let status: String = sqlx::query_scalar(
        "SELECT status FROM opening_balance_migrations WHERE id = ?",
    )
    .bind(&migration_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(status, "Cancelled");
}
