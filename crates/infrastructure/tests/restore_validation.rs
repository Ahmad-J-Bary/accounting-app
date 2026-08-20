use std::path::PathBuf;
use std::str::FromStr;

use infrastructure::db::backup::validate_import_candidate;
use infrastructure::db::pool::run_migrations;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

/// Build a fully migrated live DB, insert the given posted entry lines, then
/// VACUUM INTO a standalone candidate file (exactly how exports are produced).
async fn build_candidate(
    name: &str,
    lines: &[(bool, &str, &str)],
) -> (PathBuf, sqlx::SqlitePool) {
    let mut path = std::env::temp_dir();
    path.push(format!("{name}_{}.sqlite", uuid::Uuid::new_v4()));

    let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    run_migrations(&pool).await.unwrap();

    // Two accounts: an asset (122 = cash, renamed from 1202 in migration 015)
    // and an equity (51 = capital, ensured at runtime by pool::run_migrations).
    let cash: String =
        sqlx::query_scalar("SELECT id FROM accounts WHERE code = '122' LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    let capital: String =
        sqlx::query_scalar("SELECT id FROM accounts WHERE code = '51' LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
    let (debit_account, credit_account) = (cash, capital);

    let entry_id = uuid::Uuid::new_v4().to_string();
    let entry_number = format!("JE-{name}");
    sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, updated_at) VALUES (?1, ?2, 'ManualJournal', 'test', 'test', datetime('now'), 'import-validation test', 'Posted', datetime('now'), datetime('now'))",
    )
    .bind(&entry_id)
    .bind(&entry_number)
    .execute(&pool)
    .await
    .unwrap();

    for (i, (is_debit, amount, account)) in lines.iter().enumerate() {
        let account_id = if *account == "debit" { &debit_account } else { &credit_account };
        let (debit, credit): (&str, &str) =
            if *is_debit { (*amount, "0.00") } else { ("0.00", *amount) };
        sqlx::query(
            "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?1, ?2, ?3, NULL, 'S', '1', ?4, ?4, ?5, ?5, 'test', datetime('now'))",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&entry_id)
        .bind(account_id)
        .bind(debit)
        .bind(credit)
        .execute(&pool)
        .await
        .unwrap();
        let _ = i;
    }

    // Produce the standalone snapshot file (like an export / backup).
    let candidate = path.with_extension("export.sqlite");
    let _ = std::fs::remove_file(&candidate);
    sqlx::query(&format!(
        "VACUUM INTO '{}'",
        candidate.to_string_lossy().replace('\'', "''")
    ))
    .execute(&pool)
    .await
    .unwrap();

    (candidate, pool)
}

fn balanced_lines() -> Vec<(bool, &'static str, &'static str)> {
    vec![(true, "100.00", "debit"), (false, "100.00", "credit")]
}

fn unbalanced_lines() -> Vec<(bool, &'static str, &'static str)> {
    vec![(true, "100.00", "debit"), (false, "0.00", "credit")]
}

#[tokio::test]
async fn balanced_import_candidate_passes() {
    let (candidate, pool) = build_candidate("imp_pass", &balanced_lines()).await;
    let report = validate_import_candidate(&candidate).await.unwrap();
    pool.close().await;
    let _ = std::fs::remove_file(&candidate);
    assert!(report.ok, "expected OK, got: {:?}", report.errors);
    assert!(report.errors.is_empty(), "expected no errors, got {:?}", report.errors);
}

#[tokio::test]
async fn unbalanced_posted_entry_is_rejected() {
    let (candidate, pool) = build_candidate("imp_bad", &unbalanced_lines()).await;
    let report = validate_import_candidate(&candidate).await.unwrap();
    pool.close().await;
    let _ = std::fs::remove_file(&candidate);
    assert!(!report.ok, "unbalanced posted entry must be rejected");
    assert!(
        report.errors.iter().any(|e| e.contains("غير متوازنة")),
        "expected balance error, got: {:?}",
        report.errors
    );
}

#[tokio::test]
async fn foreign_key_violation_is_rejected() {
    let (candidate, pool) = build_candidate("imp_fk", &balanced_lines()).await;
    // Orphaned journal line (no header, no account). Migration 145 only purges
    // orphans at first-apply, so a candidate carrying an orphan must be REJECTED
    // by the foreign-key gate — the same gate a tampered/foreign DB trips.
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?1, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NULL, 'S', '1', '5.00', '5.00', '0', '0', 'orphan', datetime('now'))",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await.unwrap();

    let _ = std::fs::remove_file(&candidate);
    sqlx::query(&format!(
        "VACUUM INTO '{}'",
        candidate.to_string_lossy().replace('\'', "''")
    ))
    .execute(&pool)
    .await
    .unwrap();

    let report = validate_import_candidate(&candidate).await.unwrap();
    pool.close().await;
    let _ = std::fs::remove_file(&candidate);
    assert!(!report.ok, "FK violation must be rejected, got: {:?}", report.errors);
    assert!(
        report.errors.iter().any(|e| e.contains("Foreign Key")),
        "expected FK error, got: {:?}",
        report.errors
    );
}