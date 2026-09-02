//! Migration 162 normalizes legacy `Reversal` / `OpeningBalanceReversal`
//! journal-type rows into the semantic model where a reversal is a relationship
//! (`reversal_of_entry_id`), never a journal type:
//!   1) linked contras inherit the original's journal_type;
//!   2) unlinked `ob_reversal:` rows get the link back-filled from their
//!      `opening_balance:{id}` aggregate (derived from the source suffix);
//!   3) originals paired with a contra are marked `Reversed` (+ reversed_at).
//!
//!   The migration is forward-only and idempotent (re-runs touch nothing).
//!
//!   The migration body is executed directly so this test can drive the seed →
//!   normalize → re-run → assert cycle against one database.

use std::str::FromStr;
use std::sync::Arc;

use infrastructure::db::pool::run_migrations;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

const MIG_162: &str = include_str!("../src/db/migrations/162_normalize_reversal_semantics.sql");

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_norm_162_{}.sqlite", uuid::Uuid::new_v4()));
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

#[allow(clippy::too_many_arguments)]
async fn seed_row(
    pool: &sqlx::SqlitePool,
    id: &str,
    entry_number: &str,
    journal_type: &str,
    source_id: Option<&str>,
    source_type: Option<&str>,
    reversal_of: Option<&str>,
    status: &str,
) {
    sqlx::query(
        r#"INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type,
             reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'seed', ?, datetime('now'),
             CASE WHEN ? = 'Posted' THEN datetime('now') END,
             CASE WHEN ? = 'Reversed' THEN datetime('now') END,
             datetime('now'))"#,
    )
    .bind(id)
    .bind(entry_number)
    .bind(journal_type)
    .bind(source_id)
    .bind(source_type)
    .bind(reversal_of)
    .bind(status)
    .bind(status)
    .bind(status)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn migration_162_normalizes_reversal_semantics_idempotently() {
    let pool = build_pool().await;

    let original_linked = "11111111-1111-1111-1111-111111111111";
    let contra_linked = "22222222-2222-2222-2222-222222222222";

    // A posted original + its contra. The contra was written under the OLD model
    // as journal_type 'Reversal' with a correct reversal_of_entry_id link.
    seed_row(
        pool.as_ref(),
        original_linked,
        "LEG-1000",
        "PurchaseJournal",
        Some("purchase_invoice:P-1000"),
        Some("purchase_journal"),
        None,
        "Posted",
    )
    .await;
    seed_row(
        pool.as_ref(),
        contra_linked,
        "LEG-1001",
        "Reversal",
        Some("purchase_invoice_reversal:P-1000"),
        Some("purchase_journal"),
        Some(original_linked),
        "Posted",
    )
    .await;

    // A legacy opening-balance cancel: an `ob_reversal:` row with NO link and the
    // legacy type, cancelling an AccountOpeningBalance aggregate.
    let migration_id = "9f1a3e6d-0000-4000-8000-000000000000";
    let original_ob = "33333333-3333-3333-3333-333333333333";
    let contra_ob = "44444444-4444-4444-4444-444444444444";
    seed_row(
        pool.as_ref(),
        original_ob,
        "OB-2000",
        "AccountOpeningBalance",
        Some(&format!("opening_balance:{migration_id}")),
        Some("account_opening_balance"),
        None,
        "Posted",
    )
    .await;
    seed_row(
        pool.as_ref(),
        contra_ob,
        "OB-2001",
        "OpeningBalanceReversal",
        Some(&format!("ob_reversal:{migration_id}")),
        Some("opening_balance_reversal"),
        None,
        "Posted",
    )
    .await;

    sqlx::query(MIG_162).execute(pool.as_ref()).await.unwrap();

    // 1) The linked contra inherits the original's type; there is no semantic
    //    'Reversal' type anymore.
    let (linked_type, linked_link): (String, Option<String>) = sqlx::query_as(
        "SELECT journal_type, reversal_of_entry_id FROM journal_entries WHERE id = ?",
    )
    .bind(contra_linked)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(
        linked_type, "PurchaseJournal",
        "linked contra inherits PurchaseJournal"
    );
    assert_eq!(linked_link.as_deref(), Some(original_linked));

    // 2) The ob_reversal row gets its link back-filled and inherits
    //    AccountOpeningBalance.
    let (ob_type, ob_link): (String, Option<String>) = sqlx::query_as(
        "SELECT journal_type, reversal_of_entry_id FROM journal_entries WHERE id = ?",
    )
    .bind(contra_ob)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(
        ob_type, "AccountOpeningBalance",
        "ob_reversal row inherits AccountOpeningBalance"
    );
    assert_eq!(
        ob_link.as_deref(),
        Some(original_ob),
        "ob_reversal link back-filled via source suffix"
    );

    // 3) The paired original is marked Reversed (with a stamp).
    let (ob_status, ob_reversed_at): (String, Option<String>) =
        sqlx::query_as("SELECT status, reversed_at FROM journal_entries WHERE id = ?")
            .bind(original_ob)
            .fetch_one(pool.as_ref())
            .await
            .unwrap();
    assert_eq!(ob_status, "Reversed", "paired original is marked Reversed");
    assert!(ob_reversed_at.is_some(), "reversed_at is stamped");

    // No legacy reversal journal_type survives anywhere.
    let legacy: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries
          WHERE journal_type IN ('Reversal', 'OpeningBalanceReversal')",
    )
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(legacy, 0, "no legacy reversal journal_type may survive");

    // Idempotent re-run: same row counts, same values.
    let total_before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    sqlx::query(MIG_162).execute(pool.as_ref()).await.unwrap();
    let total_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(total_before, total_after, "162 re-run must be a no-op");

    let (linked_type2, ob_link2, ob_status2, legacy2): (String, Option<String>, String, i64) =
        sqlx::query_as(
            "SELECT (SELECT journal_type FROM journal_entries WHERE id = ?),
                    (SELECT reversal_of_entry_id FROM journal_entries WHERE id = ?),
                    (SELECT status FROM journal_entries WHERE id = ?),
                    (SELECT COUNT(*) FROM journal_entries
                      WHERE journal_type IN ('Reversal', 'OpeningBalanceReversal'))",
        )
        .bind(contra_linked)
        .bind(contra_ob)
        .bind(original_ob)
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(linked_type2, "PurchaseJournal");
    assert_eq!(ob_link2.as_deref(), Some(original_ob));
    assert_eq!(ob_status2, "Reversed");
    assert_eq!(legacy2, 0);
}
