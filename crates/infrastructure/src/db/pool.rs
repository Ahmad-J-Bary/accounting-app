use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .busy_timeout(Duration::from_secs(10))
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        // Referential integrity is enforced so the ledger's FK constraints
        // (journal_lines→journal_entries/accounts, document lines→parents, …)
        // actually protect data. Migration 145 purges pre-existing orphans so
        // this flip is safe on databases created before enforcement.
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    Ok(Arc::new(pool))
}

/// Highest migration version this build can apply (the schema the app supports).
pub fn latest_schema_version() -> u32 {
    let migrator = sqlx::migrate!("./src/db/migrations");
    migrator
        .migrations
        .iter()
        .map(|m| m.version)
        .max()
        .unwrap_or(0) as u32
}

/// Refuse to operate on a database whose migration ledger is ahead of this
/// build (a schema created by a NEWER app version). Returns an error instead of
/// allowing the migration/healing loop to mutate the newer DB's ledger.
/// A fresh database (no ledger table yet) is permitted.
pub async fn ensure_schema_supported(pool: &SqlitePool) -> Result<(), String> {
    let has_ledger: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to inspect migration ledger: {e}"))?;
    if !has_ledger {
        return Ok(());
    }
    let max: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to read migration ledger: {e}"))?;
    let supported = latest_schema_version() as i64;
    if max > supported {
        return Err(format!(
            "قاعدة البيانات من إصدار أحدث ({max}) — الحد الأقصى المدعوم ({supported}). يُرجى تحديث التطبيق."
        ));
    }
    Ok(())
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
    add_column_if_missing(pool, "payments", "invoice_id", "TEXT", "NULL").await;
    // accounts
    add_column_if_missing(pool, "accounts", "currency_code", "TEXT", "'USD'").await;
    add_column_if_missing(pool, "accounts", "exchange_rate", "TEXT", "'1'").await;
    // settings
    add_column_if_missing(pool, "settings", "base_currency_code", "TEXT", "''").await;
    add_column_if_missing(pool, "settings", "numeral_system", "TEXT", "'western'").await;
    // partners
    add_column_if_missing(pool, "partners", "currency", "TEXT", "''").await;
    // material_purchase_prices
    add_column_if_missing(pool, "material_purchase_prices", "currency", "TEXT", "''").await;
    // material_sale_prices
    add_column_if_missing(pool, "material_sale_prices", "currency", "TEXT", "''").await;
    // fixed_assets
    add_column_if_missing(
        pool,
        "fixed_assets",
        "depreciation_method",
        "TEXT",
        "'StraightLine'",
    )
    .await;
    // inventory_lots (for lot-level sale prices)
    add_column_if_missing(pool, "inventory_lots", "retail_price_base", "TEXT", "NULL").await;
    add_column_if_missing(
        pool,
        "inventory_lots",
        "semi_wholesale_price_base",
        "TEXT",
        "NULL",
    )
    .await;
    add_column_if_missing(
        pool,
        "inventory_lots",
        "wholesale_price_base",
        "TEXT",
        "NULL",
    )
    .await;
    // unified_invoice_lines (for line-level discount)
    add_column_if_missing(
        pool,
        "unified_invoice_lines",
        "discount_percent",
        "TEXT",
        "'0'",
    )
    .await;
    // stock_movements (for shared sequential reference)
    add_column_if_missing(pool, "stock_movements", "document_number", "TEXT", "NULL").await;
}

/// Backfill canonical monetary fields for damaged items after the schema is
/// fully available. This intentionally runs outside SQL migrations because
/// older databases may not have stock_movements.document_number until the
/// healing path adds it.
async fn ensure_damaged_item_financial_snapshot(pool: &SqlitePool) {
    if !column_exists(pool, "damaged_items", "currency_code").await
        || !column_exists(pool, "damaged_items", "fx_rate").await
        || !column_exists(pool, "damaged_items", "cost_impact_base").await
        || !column_exists(pool, "damaged_items", "loss").await
        || !column_exists(pool, "damaged_items", "loss_base").await
    {
        return;
    }

    let has_document_number = column_exists(pool, "stock_movements", "document_number").await;
    let damaged_link_filter = if has_document_number {
        "sm.movement_type = 'Damaged' AND (sm.document_number = damaged_items.reference OR (sm.reference = damaged_items.reference AND sm.document_number IS NULL))"
    } else {
        "sm.movement_type = 'Damaged' AND sm.reference = damaged_items.reference"
    };

    let sql = format!(
        "UPDATE damaged_items
         SET
             currency_code = COALESCE(
                 (
                     SELECT sm.original_currency
                     FROM stock_movements sm
                     WHERE {damaged_link_filter}
                     ORDER BY sm.created_at DESC
                     LIMIT 1
                 ),
                 (
                     SELECT COALESCE(NULLIF(base_currency_code, ''), NULLIF(currency, ''), 'USD')
                     FROM settings
                     LIMIT 1
                 )
             ),
             fx_rate = COALESCE(
                 (
                     SELECT sm.fx_rate
                     FROM stock_movements sm
                     WHERE {damaged_link_filter}
                     ORDER BY sm.created_at DESC
                     LIMIT 1
                 ),
                 '1'
             ),
             cost_impact_base = COALESCE(
                 (
                     SELECT sm.total_cost_base
                     FROM stock_movements sm
                     WHERE {damaged_link_filter}
                     ORDER BY sm.created_at DESC
                     LIMIT 1
                 ),
                 cost_impact
             ),
             loss = COALESCE(loss, cost_impact),
             loss_base = COALESCE(
                 (
                     SELECT sm.total_cost_base
                     FROM stock_movements sm
                     WHERE {damaged_link_filter}
                     ORDER BY sm.created_at DESC
                     LIMIT 1
                 ),
                 cost_impact
             )
         WHERE currency_code IS NULL
            OR fx_rate IS NULL
            OR cost_impact_base IS NULL
            OR loss IS NULL
            OR loss_base IS NULL"
    );

    let _ = sqlx::query(&sql).execute(pool).await;
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
    let _ = sqlx::query("UPDATE accounts SET code = '332', name_ar = 'الخصوم المكتسبة', name_en = 'Discount Earned', updated_at = datetime('now') WHERE code = '3301'")
        .execute(pool).await;
    let exists_now: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '332'")
            .fetch_one(pool)
            .await
            .unwrap_or(false);
    if !exists_now {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000332', '332', 'الخصوم المكتسبة', 'Discount Earned', 'Revenue', COALESCE((SELECT id FROM accounts WHERE code = '33'), (SELECT id FROM accounts WHERE code = '3')), 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '332')"
        ).execute(pool).await;
    }
}

/// Ensure the Discount Granted account (47) exists under "المصروفات" (4)
async fn ensure_discount_granted_account(pool: &SqlitePool) {
    let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '47'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if exists {
        return;
    }
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000047', '47', 'الخصوم الممنوحة', 'Discount Granted', 'Expenses', COALESCE((SELECT id FROM accounts WHERE code = '4'), (SELECT id FROM accounts WHERE code = '0')), 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '47')"
    ).execute(pool).await;
}

/// Ensure the Equity section (5) and its sub-accounts (51 Capital, 52 Retained Earnings, 53 OBE) exist.
/// Migration 128 deletes 224, and there is no proper root-level Equity section, so we create them here.
async fn ensure_opening_balance_equity_account(pool: &SqlitePool) {
    // 1. Ensure root-level "حقوق الملكية" (Equity) account (5) exists under root (0)
    let root_equity: bool =
        sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '5'")
            .fetch_one(pool)
            .await
            .unwrap_or(false);
    if !root_equity {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000005', '5', 'حقوق الملكية', 'Equity', 'Equity', (SELECT id FROM accounts WHERE code = '0'), 'Summary', 1, '0', '0', 'general', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '5')"
        ).execute(pool).await;
    }

    // Cleanup: Remove old temporary "حقوق الملكية" (24) that was previously created under الخصوم
    let _ = sqlx::query("DELETE FROM accounts WHERE code = '24'")
        .execute(pool)
        .await;

    // 2. Rename existing "رأس المال" (Capital) account from code '222' → '51' under '5'
    //    (the old 222 was created by migration 011 under الخصوم المتداولة 22)
    let cap_51: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '51'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if !cap_51 {
        // First try to rename existing 222 → 51
        let _ = sqlx::query(
            "UPDATE accounts SET code = '51', name_ar = 'رأس المال', name_en = 'Capital', parent_id = (SELECT id FROM accounts WHERE code = '5'), category = 'Summary', level = 2, purpose = 'partner_capital', updated_at = datetime('now') WHERE code = '222'"
        ).execute(pool).await;
        // If 222 didn't exist either, create 51 fresh
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000051', '51', 'رأس المال', 'Capital', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Summary', 2, '0', '0', 'partner_capital', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '51')"
        ).execute(pool).await;
    }

    // 3. Ensure "الأرباح المبقاة" (Retained Earnings) account (52) exists under '5'
    let ret_earn: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '52'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if !ret_earn {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000052', '52', 'الأرباح المبقاة', 'Retained Earnings', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 2, '0', '0', 'retained_earnings', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '52')"
        ).execute(pool).await;
    }

    // 4. Rename existing "رصيد افتتاحي" (OBE) account from code '224' → '53' under '5'
    //    (the old 224 was created by migration 036 and may have been deleted by 128)
    let obe_53: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM accounts WHERE code = '53'")
        .fetch_one(pool)
        .await
        .unwrap_or(false);
    if !obe_53 {
        // First try to rename existing 224 → 53
        let _ = sqlx::query(
            "UPDATE accounts SET code = '53', name_ar = 'رصيد افتتاحي', name_en = 'Opening Balance Equity', parent_id = (SELECT id FROM accounts WHERE code = '5'), account_type = 'Equity', category = 'Detail', level = 2, purpose = 'opening_balance_equity', updated_at = datetime('now') WHERE code = '224'"
        ).execute(pool).await;
        // 4. If 224 didn't exist either (e.g. deleted by migration 128), create 53 fresh
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at) SELECT '00000000-0000-0000-0000-000000000053', '53', 'رصيد افتتاحي', 'Opening Balance Equity', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 2, '0', '0', 'opening_balance_equity', 1, datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '53')"
        ).execute(pool).await;
    }
}

/// Ensure fixed asset accounts (111 أبنية وأراضي, 112 آليات ومركبات, 113 معدات وتجهيزات, 114 أثاث ومفروشات)
/// and asset_categories ("آليات ومركبات") are correctly initialized and numbered in the database.
async fn ensure_fixed_asset_accounts(pool: &SqlitePool) {
    // 0) Ensure parent "11 - الأصول الثابتة" exists (under 1 = الأصول)
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts
         (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, purpose, created_at, updated_at)
         VALUES
         ('00000000-0000-0000-0000-000000000011', '11', 'الأصول الثابتة', 'Fixed Assets', 'Assets',
          (SELECT id FROM accounts WHERE code = '1'), 'Summary', 2, '0', '0', 1, 'fixed_asset', datetime('now'), datetime('now'))"
    ).execute(pool).await;

    // 1) Renumbering legacy/misplaced codes:
    let _ = sqlx::query(
        "UPDATE accounts SET code = '114', updated_at = datetime('now') WHERE code IN ('1103', '113') AND name_ar LIKE '%أثاث%' AND code != '114'"
    ).execute(pool).await;

    let _ = sqlx::query(
        "UPDATE accounts SET code = '112_tmp', updated_at = datetime('now') WHERE code IN ('1102', '112') AND name_ar LIKE '%معدات%' AND code != '112_tmp'"
    ).execute(pool).await;

    // 2) Ensure "112 - آليات ومركبات" exists and has correct name and code
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts
         (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, purpose, created_at, updated_at)
         VALUES
         ('00000000-0000-0000-0000-000000000112', '112', 'آليات ومركبات', 'Automotive & Machinery', 'Assets',
          (SELECT id FROM accounts WHERE code = '11'), 'Detail', 3, '0', '0', 1, 'fixed_asset', datetime('now'), datetime('now'))"
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE accounts SET name_ar = 'آليات ومركبات', name_en = 'Automotive & Machinery', updated_at = datetime('now') WHERE code = '112' AND name_ar != 'آليات ومركبات'"
    ).execute(pool).await;

    // 3) Move temporary '112_tmp' to '113' (معدات وتجهيزات) or insert 113 if missing
    let _ = sqlx::query(
        "UPDATE accounts SET code = '113', name_ar = 'معدات وتجهيزات', name_en = 'Equipment', updated_at = datetime('now') WHERE code = '112_tmp'"
    ).execute(pool).await;
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts
         (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, purpose, created_at, updated_at)
         VALUES
         ('00000000-0000-0000-0000-000000001102', '113', 'معدات وتجهيزات', 'Equipment', 'Assets',
          (SELECT id FROM accounts WHERE code = '11'), 'Detail', 3, '0', '0', 1, 'fixed_asset', datetime('now'), datetime('now'))"
    ).execute(pool).await;

    // 4) Ensure "111 - أبنية وأراضي" exists
    let _ = sqlx::query(
        "UPDATE accounts SET code = '111', updated_at = datetime('now') WHERE code = '1101' AND code != '111'"
    ).execute(pool).await;
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts
         (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, purpose, created_at, updated_at)
         VALUES
         ('00000000-0000-0000-0000-000000001101', '111', 'أبنية وأراضي', 'Buildings & Land', 'Assets',
          (SELECT id FROM accounts WHERE code = '11'), 'Detail', 3, '0', '0', 1, 'fixed_asset', datetime('now'), datetime('now'))"
    ).execute(pool).await;

    // 5) Ensure "114 - أثاث ومفروشات" exists
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO accounts
         (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, purpose, created_at, updated_at)
         VALUES
         ('00000000-0000-0000-0000-000000001103', '114', 'أثاث ومفروشات', 'Furniture', 'Assets',
          (SELECT id FROM accounts WHERE code = '11'), 'Detail', 3, '0', '0', 1, 'fixed_asset', datetime('now'), datetime('now'))"
    ).execute(pool).await;

    // 6) Re-parent 111, 112, 113, 114 under account 11 ("الأصول الثابتة")
    let _ = sqlx::query(
        "UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '11'), level = 3, updated_at = datetime('now')
         WHERE code IN ('111', '112', '113', '114')"
    ).execute(pool).await;

    // 7) Backfill purpose for any fixed-asset-range accounts that were inserted
    //    without it (e.g. by migration 164 or earlier healing loops).
    let _ = sqlx::query(
        "UPDATE accounts SET purpose = 'fixed_asset', updated_at = datetime('now')
         WHERE code LIKE '11%' AND account_type = 'Assets'
         AND (purpose IS NULL OR purpose = 'general')",
    )
    .execute(pool)
    .await;

    // 8) Ensure "آليات ومركبات" exists in asset_categories
    let _ = sqlx::query(
        "INSERT INTO asset_categories (id, name, asset_type)
         SELECT '00000000-0000-0000-0000-00000000c101', 'آليات ومركبات', 'Fixed'
         WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'آليات ومركبات')",
    )
    .execute(pool)
    .await;
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    // Defensive gate: never run the healing loop against a schema that is newer
    // than this build supports — the heal path DELETEs unknown migration-ledger
    // rows (VersionMissing), which would corrupt the ledger of a future-version
    // database instead of protecting it.
    if let Err(msg) = ensure_schema_supported(pool).await {
        return Err(sqlx::migrate::MigrateError::Source(
            std::io::Error::other(msg).into(),
        ));
    }

    let migrator = sqlx::migrate!("./src/db/migrations");

    loop {
        match migrator.run(pool).await {
            Ok(()) => {
                ensure_currency_columns(pool).await;
                ensure_damaged_item_financial_snapshot(pool).await;
                ensure_discount_earned_account(pool).await;
                ensure_discount_granted_account(pool).await;
                ensure_opening_balance_equity_account(pool).await;
                ensure_fixed_asset_accounts(pool).await;
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
                    ensure_damaged_item_financial_snapshot(pool).await;
                    ensure_discount_earned_account(pool).await;
                    ensure_discount_granted_account(pool).await;
                    ensure_opening_balance_equity_account(pool).await;
                    ensure_fixed_asset_accounts(pool).await;

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
