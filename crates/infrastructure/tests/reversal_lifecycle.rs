use std::sync::Arc;
use std::str::FromStr;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus, JournalLine, JournalType};
use domain::shared::{AccountId};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::monetary_amount::MonetaryAmount;
use application::ports::journal_entry_repository::JournalEntryRepository;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteJournalEntryRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

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
    path.push(format!("acc_rev_test_{}.sqlite", uuid::Uuid::new_v4()));
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
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM accounts ORDER BY code LIMIT 2",
    )
    .fetch_all(pool)
    .await
    .unwrap();
    assert!(ids.len() >= 2, "chart of accounts must be seeded");
    (
        AccountId(uuid::Uuid::parse_str(&ids[0]).unwrap()),
        AccountId(uuid::Uuid::parse_str(&ids[1]).unwrap()),
    )
}

#[tokio::test]
async fn full_reversal_lifecycle_persists_metadata() {
let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let mut original = JournalEntry::new(
        "CR-1000".to_string(),
        JournalType::CashReceipt,
        balanced_lines(dec!(500), acc_a, acc_b),
        Utc::now(),
        "سند قبض أصلي".to_string(),
        None,
    )
    .unwrap();
    original.post().unwrap();
    repo.save(&original).await.unwrap();

    let mut reversal = JournalEntry::create_reversal(
        &original,
        "CR-1001".to_string(),
        Utc::now(),
        "عكس سند قبض CR-1000".to_string(),
    )
    .unwrap();
    reversal.post().unwrap();
    repo.save(&reversal).await.unwrap();

    let mut original = original;
    original.reverse().unwrap();
    repo.save(&original).await.unwrap();

    let stored_original = repo
        .find_by_id(&original.id)
        .await
        .unwrap()
        .expect("original must exist");
    assert_eq!(stored_original.status, JournalEntryStatus::Reversed);
    assert!(stored_original.reversed_at.is_some(), "reversed_at must persist");

    let stored_reversal = repo
        .find_by_id(&reversal.id)
        .await
        .unwrap()
        .expect("reversal must exist");
    assert_eq!(stored_reversal.journal_type, JournalType::Reversal);
    assert_eq!(stored_reversal.reversal_of_entry_id, Some(original.id));
    assert_eq!(stored_reversal.source_type.as_deref(), Some("cash_receipt"));
    assert_eq!(stored_reversal.status, JournalEntryStatus::Posted);
    assert!(stored_reversal.is_balanced());
    assert_eq!(
        stored_reversal.total_base_debit().normalize(),
        dec!(500).normalize()
    );

    // Persisted lines are swapped: line 0 (originally debit) is now credit.
    assert_eq!(stored_reversal.lines[0].base_debit(), Decimal::ZERO);
    assert_eq!(stored_reversal.lines[0].base_credit(), dec!(500));
    assert_eq!(stored_reversal.lines[1].base_debit(), dec!(500));
    assert_eq!(stored_reversal.lines[1].base_credit(), Decimal::ZERO);
}

#[tokio::test]
async fn draft_entry_has_no_reversal_metadata() {
let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let entry = JournalEntry::new(
        "JE-2000".to_string(),
        JournalType::GeneralJournal,
        balanced_lines(dec!(100), acc_a, acc_b),
        Utc::now(),
        "قيد مسودة".to_string(),
        None,
    )
    .unwrap();
    repo.save(&entry).await.unwrap();

    let stored = repo
        .find_by_id(&entry.id)
        .await
        .unwrap()
        .expect("entry must exist");
assert_eq!(stored.status, JournalEntryStatus::Draft);
    assert!(stored.reversal_of_entry_id.is_none());
    assert_eq!(stored.source_type.as_deref(), Some("general_journal"));
    assert!(stored.reversed_at.is_none());
    assert!(stored.posted_at.is_none());
}

#[tokio::test]
async fn use_case_rejects_reversing_an_already_reversed_entry() {
    use std::sync::Arc as StdArc;
    use application::use_cases::journal::ReverseJournalEntryUseCase;

let pool = build_pool().await;
    let repo: StdArc<dyn JournalEntryRepository> =
        StdArc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let use_case = ReverseJournalEntryUseCase::new(repo.clone());
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;

    let mut original = JournalEntry::new(
        "CR-3000".to_string(),
        JournalType::CashReceipt,
        balanced_lines(dec!(250), acc_a, acc_b),
        Utc::now(),
        "سند قبض".to_string(),
        None,
    )
    .unwrap();
    original.post().unwrap();
    repo.save(&original).await.unwrap();

    let err = use_case.execute(original.id.0.to_string()).await;
    assert!(err.is_ok(), "first reversal should succeed");

let again = use_case.execute(original.id.0.to_string()).await;
    assert!(again.is_err(), "reversing a Reversed entry must be rejected");
}

#[tokio::test]
async fn migration_schema_is_forward_complete() {
    let pool = build_pool().await;
    let cols: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM pragma_table_info('journal_entries')"
    )
    .fetch_all(pool.as_ref())
    .await
    .unwrap();
    assert!(cols.contains(&"source_type".to_string()), "cols={:?}", cols);
    assert!(cols.contains(&"reversal_of_entry_id".to_string()), "cols={:?}", cols);
    assert!(cols.contains(&"reversed_at".to_string()), "cols={:?}", cols);
}

#[tokio::test]
async fn orphan_cleanup_removes_dangling_reversals_and_resets_reversed_originals() {
    let pool = build_pool().await;

    // A reversal pointing at a non-existent entry (dangling link) — exactly the
    // failure mode the 142 integrity migration repairs.
    let orphan_reversal_id = uuid::Uuid::new_v4().to_string();
    let ghost_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type,
             reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at)
           VALUES (?, 'REV-ORPHAN', 'Reversal', ?, NULL, ?,
             datetime('now'), 'orphan unit', 'Posted', datetime('now'), datetime('now'), NULL, datetime('now'))"#
    )
    .bind(&orphan_reversal_id)
    .bind(Some("CashReceipt".to_string()))
    .bind(Some(&ghost_id))
    .execute(pool.as_ref())
    .await
    .unwrap();

    // An original marked Reversed with no surviving reversal entry must be reset
    // to Posted by the cleanup.
    let ghost_original_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO journal_entries (id, entry_number, journal_type, status, source_id, source_type,
             reversal_of_entry_id, entry_date, description, created_at, posted_at, reversed_at, updated_at)
           VALUES (?, 'PE-REV-STRANDED', 'CashReceipt', 'Reversed', NULL, NULL, NULL,
                 datetime('now'), 'stranded reversed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))"#
    )
    .bind(&ghost_original_id)
    .execute(pool.as_ref())
    .await
    .unwrap();

    // Re-run the 142 migration body (fresh DB already has it applied once, but the
    // logic must be re-runnable/idempotent on top of existing data).
    let mig = r#"
        DELETE FROM journal_entries
         WHERE journal_type = 'Reversal'
           AND (reversal_of_entry_id IS NULL
                OR reversal_of_entry_id NOT IN (SELECT id FROM journal_entries));
        UPDATE journal_entries
           SET status = 'Posted', reversed_at = NULL, updated_at = datetime('now')
         WHERE status = 'Reversed'
           AND NOT EXISTS (
               SELECT 1 FROM journal_entries r
                WHERE r.journal_type = 'Reversal'
                  AND r.reversal_of_entry_id = journal_entries.id
           );
    "#;
    for stmt in mig.split(';').map(str::trim).filter(|s| !s.is_empty()) {
        sqlx::query(stmt).execute(pool.as_ref()).await.unwrap();
    }

    let orphan_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE id = ?")
        .bind(&orphan_reversal_id)
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(orphan_count, 0, "dangling reversal must be removed");

    let stranded: (String, Option<String>) = sqlx::query_as(
        "SELECT status, reversed_at FROM journal_entries WHERE id = ?",
    )
    .bind(&ghost_original_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(stranded.0, "Posted", "stranded 'Reversed' original must be reset");
    assert!(stranded.1.is_none(), "reversed_at must be cleared");

    // No-op on the unchanged ghost row: count still zero.
    let remaining: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'Reversal'")
            .fetch_one(pool.as_ref())
            .await
            .unwrap();
    assert_eq!(remaining, 0);
}
