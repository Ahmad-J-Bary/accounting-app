use infrastructure::db::pool::run_migrations;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;

fn sqlite_url(path: &str) -> String {
    format!("sqlite://{path}?mode=rwc")
}

async fn build_pool() -> sqlx::SqlitePool {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_fk_cleanup_{}.sqlite", uuid::Uuid::new_v4()));
    let url = sqlite_url(path.to_str().unwrap());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    run_migrations(&pool).await.unwrap();
    pool
}

/// The migration 145 cleanup body — applied a second time in the test on top of
/// injected orphans to prove it is idempotent and actually purges.
const CLEANUP: &str = r#"
DELETE FROM journal_lines
 WHERE NOT EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_lines.journal_entry_id)
    OR NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = journal_lines.account_id);
DELETE FROM stock_movements
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = stock_movements.material_id);
DELETE FROM unified_invoice_lines
 WHERE NOT EXISTS (SELECT 1 FROM unified_invoices WHERE unified_invoices.id = unified_invoice_lines.invoice_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = unified_invoice_lines.material_id);
DELETE FROM sales_returns
 WHERE customer_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = sales_returns.customer_id);
DELETE FROM material_units
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = material_units.material_id);
DELETE FROM stock_adjustments
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = stock_adjustments.material_id);
DELETE FROM damaged_items
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = damaged_items.material_id);
DELETE FROM inventory_lots
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = inventory_lots.material_id)
    OR NOT EXISTS (SELECT 1 FROM stock_movements WHERE stock_movements.id = inventory_lots.movement_id);
DELETE FROM fixed_assets
 WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE asset_categories.id = fixed_assets.category_id);
UPDATE accounts
   SET parent_id = NULL, level = 1
 WHERE parent_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounts parent WHERE parent.id = accounts.parent_id);
"#;

async fn run_cleanup(pool: &sqlx::SqlitePool) {
    for stmt in CLEANUP.split(';').map(str::trim).filter(|s| !s.is_empty()) {
        sqlx::query(stmt).execute(pool).await.unwrap();
    }
}

/// Orphans are injected with FK enforcement OFF (that's the pre-145 world),
/// then the cleanup body must remove every one of them.
#[tokio::test]
async fn cleanup_purges_injected_orphans_across_child_tables() {
    let pool = build_pool().await;

    // Turn FK off for this connection so orphaned rows can be inserted.
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&pool)
        .await
        .unwrap();

    let ghost_id = "00000000-0000-0000-0000-000000000099";

    // journal_lines: dangling account + dangling header.
    sqlx::query(
        "INSERT INTO journal_lines (id, journal_entry_id, account_id, currency, debit, credit, description, created_at)
         VALUES ('00000000-0000-0000-0000-000000000011', ?, ?, 'BASE', '5', '0', 'orphan', datetime('now'))",
    )
    .bind(ghost_id)
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    // unified_invoice_line: dangling material.
    sqlx::query(
        "INSERT INTO unified_invoice_lines (id, invoice_id, material_id, quantity, unit_price)
         VALUES ('00000000-0000-0000-0000-000000000012', ?, ?, '1', '7')",
    )
    .bind(ghost_id)
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    // stock_movement: dangling material.
    sqlx::query(
        "INSERT INTO stock_movements (id, material_id, quantity, movement_type, movement_date, created_at)
         VALUES ('00000000-0000-0000-0000-000000000013', ?, '2', 'Purchase', datetime('now'), datetime('now'))",
    )
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    // inventory_lot: dangling material (and movement).
    sqlx::query(
        "INSERT INTO inventory_lots (id, material_id, movement_id, quantity_original, quantity_remaining, purchase_date)
         VALUES ('00000000-0000-0000-0000-000000000014', ?, ?, '3', '3', datetime('now'))",
    )
    .bind(ghost_id)
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    // fixed asset: dangling category.
    sqlx::query(
        "INSERT INTO fixed_assets (id, code, name, category_id, purchase_date, purchase_cost, currency, fx_rate, useful_life_months, status, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id, created_at, updated_at)
         VALUES ('00000000-0000-0000-0000-000000000015', 'FA-ORPHAN', 'orphan', ?, datetime('now'), '100', 'SAR', '1', 12, 'Active', ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(ghost_id)
    .bind(ghost_id)
    .bind(ghost_id)
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    // account with a dangling parent must be re-rooted, not deleted.
    let account_id = "00000000-0000-0000-0000-000000000016";
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, level, balance, is_active, created_at, updated_at)
         VALUES (?, 'AC-ORPHAN', 'طفل يتيم', 'orphan child', 'Asset', ?, 2, '0', 1, datetime('now'), datetime('now'))",
    )
    .bind(account_id)
    .bind(ghost_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .unwrap();

    // Sanity: every orphan was inserted.
    let pre: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines WHERE account_id = ?")
        .bind(ghost_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(pre, 1, "orphan journal line present");

    run_cleanup(&pool).await;

    let lines: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines WHERE account_id = ?")
        .bind(ghost_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(lines, 0, "orphan journal line purged");

    let inv: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM unified_invoice_lines WHERE material_id = ?")
            .bind(ghost_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(inv, 0, "orphan invoice line purged");

    let stock: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM stock_movements WHERE material_id = ?")
            .bind(ghost_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stock, 0, "orphan stock movement purged");

    let lots: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_lots WHERE material_id = ?")
        .bind(ghost_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(lots, 0, "orphan inventory lot purged");

    let assets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fixed_assets WHERE id = ?")
        .bind("00000000-0000-0000-0000-000000000015")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(assets, 0, "orphan fixed asset purged");

    // Re-rooted account survives with NULL parent and level reset.
    let re_rooted: (Option<String>, Option<i64>) =
        sqlx::query_as("SELECT parent_id, level FROM accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(re_rooted.0, None, "account parent must be detached");
    assert_eq!(re_rooted.1, Some(1), "re-rooted account resets level to 1");
}
