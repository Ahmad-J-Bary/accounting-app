use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::sync::Arc;
use std::str::FromStr;
use std::time::Duration;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .busy_timeout(Duration::from_secs(10))
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(false);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    Ok(Arc::new(pool))
}

/// Check if a column exists in a table
async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> bool {
    sqlx::query_scalar::<_, i64>(&format!(
        "SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = ?1",
        table.replace('\'', "''")
    ))
    .bind(column)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
        > 0
}

/// Safely add a column if it doesn't exist
async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    col_type: &str,
    default: &str,
) {
    if !column_exists(pool, table, column).await {
        let sql = format!(
            "ALTER TABLE {} ADD COLUMN {} {} DEFAULT {}",
            table, column, col_type, default
        );
        let _ = sqlx::query(&sql).execute(pool).await;
    }
}

/// Fix known missing currency columns. Safe to call repeatedly.
async fn ensure_currency_columns(pool: &SqlitePool) {
    // unified_invoices (may have been created by 101 after 033 failed)
    add_column_if_missing(pool, "unified_invoices", "currency_code", "TEXT", "''").await;
    add_column_if_missing(pool, "unified_invoices", "exchange_rate", "TEXT", "'1.0'").await;
    add_column_if_missing(pool, "unified_invoices", "extra_costs", "TEXT", "'0'").await;
    add_column_if_missing(pool, "unified_invoices", "extra_costs_base", "TEXT", "'0'").await;
    // journal_entries
    add_column_if_missing(pool, "journal_entries", "currency_code", "TEXT", "''").await;
    add_column_if_missing(pool, "journal_entries", "exchange_rate", "TEXT", "'1.0'").await;
    // payments
    add_column_if_missing(pool, "payments", "currency_code", "TEXT", "''").await;
    add_column_if_missing(pool, "payments", "exchange_rate", "TEXT", "'1'").await;
    add_column_if_missing(pool, "payments", "voucher_number", "TEXT", "NULL").await;
    add_column_if_missing(pool, "payments", "debit_account_id", "TEXT", "NULL").await;
    add_column_if_missing(pool, "payments", "credit_account_id", "TEXT", "NULL").await;
    add_column_if_missing(pool, "payments", "journal_entry_number", "TEXT", "NULL").await;
    // accounts
    add_column_if_missing(pool, "accounts", "currency_code", "TEXT", "'USD'").await;
    add_column_if_missing(pool, "accounts", "exchange_rate", "TEXT", "'1'").await;
    // settings
    add_column_if_missing(pool, "settings", "base_currency_code", "TEXT", "''").await;
    // partners
    add_column_if_missing(pool, "partners", "currency", "TEXT", "''").await;
    // material_purchase_prices
    add_column_if_missing(pool, "material_purchase_prices", "currency", "TEXT", "''").await;
    // material_sale_prices
    add_column_if_missing(pool, "material_sale_prices", "currency", "TEXT", "''").await;
    // fixed_assets
    add_column_if_missing(pool, "fixed_assets", "depreciation_method", "TEXT", "'StraightLine'").await;
    // inventory_lots (for lot-level sale prices)
    add_column_if_missing(pool, "inventory_lots", "retail_price_base", "TEXT", "NULL").await;
    add_column_if_missing(pool, "inventory_lots", "semi_wholesale_price_base", "TEXT", "NULL").await;
    add_column_if_missing(pool, "inventory_lots", "wholesale_price_base", "TEXT", "NULL").await;
    // unified_invoice_lines (for line-level discount)
    add_column_if_missing(pool, "unified_invoice_lines", "discount_percent", "TEXT", "'0'").await;
}

/// Ensure the Discount Earned account (332) exists under "إيرادات أخرى" (33)
async fn ensure_discount_earned_account(pool: &SqlitePool) {
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '332'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if exists {
        return;
    }
    // Rename 3301 → 332 if it exists from botched migration 133
    let _ = sqlx::query("UPDATE accounts SET code = '332', name_ar = 'حسم مكتسب', name_en = 'Discount Earned', updated_at = datetime('now') WHERE code = '3301'")
        .execute(pool).await;
    let exists_now: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '332'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if !exists_now {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000332', '332', 'حسم مكتسب', 'Discount Earned', 'Revenue', COALESCE((SELECT id FROM accounts WHERE code = '33'), (SELECT id FROM accounts WHERE code = '3')), 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '332')"
        ).execute(pool).await;
    }
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = sqlx::migrate!("./src/db/migrations");

    loop {
        match migrator.run(pool).await {
            Ok(()) => {
                ensure_currency_columns(pool).await;
                ensure_discount_earned_account(pool).await;
                return Ok(());
            }
            Err(sqlx::migrate::MigrateError::VersionMismatch(version)) => {
                if let Some(migration) = migrator.migrations.iter().find(|m| m.version == version) {
                    sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
                        .bind(migration.checksum.as_ref())
                        .bind(version)
                        .execute(pool)
                        .await
                        .map_err(|e| sqlx::migrate::MigrateError::Source(e.into()))?;
                } else {
                    sqlx::query("DELETE FROM _sqlx_migrations WHERE version = ?")
                        .bind(version)
                        .execute(pool)
                        .await
                        .map_err(|e| sqlx::migrate::MigrateError::Source(e.into()))?;
                }
                continue;
            }
            Err(sqlx::migrate::MigrateError::VersionMissing(version)) => {
                sqlx::query("DELETE FROM _sqlx_migrations WHERE version = ?")
                    .bind(version)
                    .execute(pool)
                    .await
                    .map_err(|e| sqlx::migrate::MigrateError::Source(e.into()))?;
                continue;
            }
            Err(e) => {
                let err_msg = e.to_string();
                // Handle "duplicate column" errors caused by SQLite DDL auto-commit
                // when a migration was partially applied or the DB is out of sync.
                if err_msg.contains("duplicate column name") {
                    // Heal the schema by adding any missing columns
                    ensure_currency_columns(pool).await;
                    ensure_discount_earned_account(pool).await;

                    // Mark all remaining migrations as applied so they won't be retried
                    let applied_versions: Vec<i64> =
                        sqlx::query_scalar("SELECT version FROM _sqlx_migrations ORDER BY version")
                            .fetch_all(pool)
                            .await
                            .unwrap_or_default();

                    let has_execution_time =
                        column_exists(pool, "_sqlx_migrations", "execution_time").await;

                    for migration in migrator.migrations.iter() {
                        let v = migration.version;
                        if !applied_versions.contains(&v) {
                            let query = if has_execution_time {
                                sqlx::query(
                                    "INSERT OR IGNORE INTO _sqlx_migrations (version, description, checksum, success, execution_time) VALUES (?1, ?2, ?3, 1, 0)",
                                )
                            } else {
                                sqlx::query(
                                    "INSERT OR IGNORE INTO _sqlx_migrations (version, description, checksum, success) VALUES (?1, ?2, ?3, 1)",
                                )
                            };
                            query
                                .bind(v)
                                .bind(migration.description.as_ref())
                                .bind(migration.checksum.as_ref())
                                .execute(pool)
                                .await
                                .map_err(|e| sqlx::migrate::MigrateError::Source(e.into()))?;
                        }
                    }
                    continue;
                }
                return Err(e);
            }
        }
    }
}
