use application::errors::AppError;
use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteJournalEntryRepository;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use std::sync::Arc;

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn balanced_lines(
    amount: rust_decimal::Decimal,
    account_a: AccountId,
    account_b: AccountId,
) -> Vec<JournalLine> {
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
    path.push(format!("acc_immut_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn real_accounts(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM accounts ORDER BY code LIMIT 2")
        .fetch_all(pool)
        .await
        .unwrap();
    (
        AccountId(uuid::Uuid::parse_str(&ids[0]).unwrap()),
        AccountId(uuid::Uuid::parse_str(&ids[1]).unwrap()),
    )
}

/// A posted entry can never be deleted through the repository: the delete path
/// is the last line of defense for ledger immutability.
#[tokio::test]
async fn posted_entry_cannot_be_deleted() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let mut entry = JournalEntry::new(
        "CR-5000".to_string(),
        JournalType::CashReceipt,
        balanced_lines(dec!(100), acc_a, acc_b),
        Utc::now(),
        "سند قبض".to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();

    let err = repo.delete(&entry.id).await;
    assert!(matches!(err, Err(AppError::Forbidden(_))), "got {:?}", err);
}

/// A draft entry is still fully removable — the guard only protects posted history.
#[tokio::test]
async fn draft_entry_can_be_deleted() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let entry = JournalEntry::new(
        "JE-5001".to_string(),
        JournalType::GeneralJournal,
        balanced_lines(dec!(50), acc_a, acc_b),
        Utc::now(),
        "قيد مسودة".to_string(),
        None,
    )
    .unwrap();
    repo.save(&entry).await.unwrap();

    repo.delete(&entry.id).await.unwrap();
    let stored = repo.find_by_id(&entry.id).await.unwrap();
    assert!(stored.is_none());
}

/// Rewriting a posted entry via plain save must be rejected; only
/// `save_reversal_pair` is authorized to mutate posted history.
#[tokio::test]
async fn posted_entry_cannot_be_overwritten_by_save() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let mut entry = JournalEntry::new(
        "JE-5002".to_string(),
        JournalType::CashReceipt,
        balanced_lines(dec!(200), acc_a, acc_b),
        Utc::now(),
        "سند قبض".to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();

    // Attempt a second save (simulating a rewrite of the same posted entry).
    let mut rewritten = entry.clone();
    rewritten.description = "نسخة معدلة".to_string();
    let err = repo.save(&rewritten).await;
    assert!(matches!(err, Err(AppError::Forbidden(_))), "got {:?}", err);
}

/// The pool flips `PRAGMA foreign_keys = ON` (migration 145 purged orphan
/// rows first), so the database must now reject a journal line whose account
/// or header no longer exists — enforcement proven at the lowest layer.
#[tokio::test]
async fn foreign_keys_are_enforced_on_the_pool() {
    let pool = build_pool().await;

    let err = sqlx::query(
        "INSERT INTO journal_lines (id, journal_entry_id, account_id, currency, debit, credit, created_at)
         VALUES ('00000000-0000-0000-0000-000000000001',
                 '00000000-0000-0000-0000-000000000002',
                 '00000000-0000-0000-0000-000000000003',
                 'BASE', '10', '0', datetime('now'))",
    )
    .execute(pool.as_ref())
    .await;
    assert!(
        err.is_err(),
        "dangling journal_line must violate the FK constraint"
    );

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines")
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(count, 0, "rejected write must not leave a row behind");
}
