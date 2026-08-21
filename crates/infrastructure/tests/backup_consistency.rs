//! Attestation: a `VACUUM INTO` snapshot taken WHILE writes are active is a
//! consistent, standalone SQLite file (spec: consistent snapshot + full
//! verification). The live pool is WAL-mode; the snapshot must reflect exactly
//! one committed state and must be readable on its own with no `-wal`/`-shm`.

use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use infrastructure::db::backup::{create_snapshot, missing_tables, verify_backup, REQUIRED_TABLES};
use infrastructure::{create_pool, run_migrations};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

/// Insert a balanced posted entry titled `number` into `pool`, atomically —
/// exactly how the application persists journal entries (single transaction), so
/// a concurrent snapshot either sees the whole entry or none of it.
async fn insert_posted_entry(pool: &infrastructure::sqlx::SqlitePool, number: &str) {
    let mut tx = pool.begin().await.unwrap();

    let entry_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, updated_at) VALUES (?1, ?2, 'ManualJournal', ?3, 'test', datetime('now'), 'snapshot-consistency test', 'Posted', datetime('now'), datetime('now'))",
    )
    .bind(&entry_id)
    .bind(number)
    .bind(&entry_id)
    .execute(&mut *tx)
    .await
    .unwrap();

    let cash: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = '122' LIMIT 1")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    let capital: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = '51' LIMIT 1")
        .fetch_one(&mut *tx)
        .await
        .unwrap();

    sqlx::query(
        "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?1, ?2, ?3, NULL, 'S', '1', '100.00', '100.00', '0', '0', 'test', datetime('now'))",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&entry_id)
    .bind(&cash)
    .execute(&mut *tx)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?1, ?2, ?3, NULL, 'S', '1', '0', '0', '100.00', '100.00', 'test', datetime('now'))",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&entry_id)
    .bind(&capital)
    .execute(&mut *tx)
    .await
    .unwrap();

    tx.commit().await.unwrap();
}

async fn journal_count(pool: &infrastructure::sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn snapshot_under_active_writes_is_consistent_and_standalone() {
    let dir = std::env::temp_dir().join(format!(
        "aa_consistency_{}",
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let db = dir.join("almowakeb.sqlite");
    let url = format!("sqlite:{}?mode=rwc", db.to_string_lossy());
    let pool = create_pool(&url).await.unwrap();
    run_migrations(&pool).await.unwrap();

    // Baseline committed before any concurrent write (5 entries).
    for i in 0..5 {
        insert_posted_entry(&pool, &format!("JE-base-{i}")).await;
    }

    // Writer keeps inserting after it commits its first batch of 3.
    let pool2 = pool.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let writer = tokio::spawn(async move {
        for i in 0..3 {
            insert_posted_entry(&pool2, &format!("JE-mid-{i}")).await;
        }
        let _ = tx.send(());
        for i in 0..3 {
            insert_posted_entry(&pool2, &format!("JE-late-{i}")).await;
            std::thread::sleep(Duration::from_millis(5));
        }
    });

    // Snapshot at a known barrier: the first 3 concurrent writes are committed.
    rx.await.unwrap();
    let count_at_barrier = journal_count(&pool).await;
    assert!(count_at_barrier >= 5 + 3);

    let snapshot = dir.join("snapshot.sqlite");
    create_snapshot(&pool, &snapshot).await.unwrap();

    // Let the writer finish; the snapshot must reflect no more than the final state.
    writer.await.unwrap();
    let count_final = journal_count(&pool).await;
    assert!(count_final >= count_at_barrier);

    // A WAL-mode snapshot must be a single, self-contained file — no side files.
    assert!(!Path::new(&format!("{}-wal", snapshot.to_string_lossy())).exists());
    assert!(!Path::new(&format!("{}-shm", snapshot.to_string_lossy())).exists());

    // Full verification WITHOUT the live pool.
    let v = verify_backup(&snapshot, true).await.unwrap();
    assert!(v.full_ok(), "snapshot failed verification: {v:?}");
    assert!(v.integrity_ok);
    assert!(v.missing_tables.is_empty());
    assert!(v.posted_balance_ok, "all posted entries must be balanced in the snapshot");
    // The snapshot reflects exactly one committed state: at or after the
    // barrier batch, and never beyond the writer's final committed state.
    assert!(v.journal_entry_count >= count_at_barrier as u64);
    assert!(v.journal_entry_count <= count_final as u64);

    // Truly independent read-only open proves the file is standalone.
    let url_ro = format!("sqlite:{}?mode=ro", snapshot.to_string_lossy());
    let opts = SqliteConnectOptions::from_str(&url_ro).unwrap().busy_timeout(Duration::from_secs(5));
    let ro = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .unwrap();
    assert!(
        missing_tables(&ro, &REQUIRED_TABLES).await.unwrap().is_empty(),
        "standalone snapshot lacks required accounting tables"
    );
    ro.close().await;

    drop(pool);
    let _ = std::fs::remove_dir_all(&dir);
}