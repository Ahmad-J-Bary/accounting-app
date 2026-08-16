//! Phase 2 — Chart of Accounts hierarchy regression suite.
//!
//! After migration 157 the canonical chart must satisfy:
//!   - القروض is code "224" (never "225"), a Detail Liability under
//!     22 الخصوم المتداولة under 2 الخصوم — same account id (posted journal
//!     lines reference the id, so nothing is ever deleted).
//!   - "54 حسابات جارية للشركاء" hangs under the equity root "5" with
//!     Equity / Summary / level 2 / purpose partner_current.
//!   - "44 مسحوبات الشركاء" hangs under the equity root "5", not under the
//!     Expenses group (4).
//!   - level equals the numeric code length (one digit per level, migration 015).
//!   - account codes are unique (enforced by idx_accounts_code_unique).
//!   - every parent_id references an existing account and the tree is acyclic.
//!   - partners created through the real use case get 51x (capital) / 54x
//!     (current) / 44x (drawings) accounts under the correct parents.
//!
//! Exercises the whole flow: migrations → pool ensures → partner creation
//! (EXISTING mode) → descendant closure of the equity and liability roots.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::partner::CreatePartnerUseCase;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqlitePartnerRepository,
    SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_chart_hierarchy_{}.sqlite", uuid::Uuid::new_v4()));
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
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let base = domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    currency_repo.save(&base).await.unwrap();
    currency_repo.set_base_currency("S").await.unwrap();

    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = START_MODE_EXISTING.into();
    settings_repo.save(&settings).await.unwrap();
    pool
}

/// Accounts row for a code: (id, name_ar, account_type, category, purpose, level, parent_id).
type AccountRow = (String, String, String, String, String, i32, Option<String>);

async fn row_by_code(pool: &sqlx::SqlitePool, code: &str) -> Option<AccountRow> {
    sqlx::query_as::<_, AccountRow>(
        "SELECT id, name_ar, account_type, category, purpose, level, parent_id
         FROM accounts WHERE code = ?",
    )
    .bind(code)
    .fetch_optional(pool)
    .await
    .unwrap()
}

async fn id_by_code(pool: &sqlx::SqlitePool, code: &str) -> String {
    row_by_code(pool, code).await.expect("account exists").0
}

async fn codes_with_count(pool: &sqlx::SqlitePool, select: &str) -> Vec<(String, i64)> {
    sqlx::query_as::<_, (String, i64)>(select)
        .fetch_all(pool)
        .await
        .unwrap()
}

/// All descendant codes of an account (recursive closure over parent_id).
async fn descendant_codes(pool: &sqlx::SqlitePool, root_code: &str) -> Vec<String> {
    sqlx::query_scalar::<_, String>(
        "WITH RECURSIVE desc_of(root) AS (
            SELECT id FROM accounts WHERE code = ?1
            UNION ALL
            SELECT a.id FROM accounts a JOIN desc_of d ON a.parent_id = d.root
         )
         SELECT a.code FROM accounts a
         WHERE a.id IN (SELECT root FROM desc_of) AND a.code <> ?1",
    )
    .bind(root_code)
    .fetch_all(pool)
    .await
    .unwrap()
}

async fn assert_no_cycles_and_valid_parents(pool: &sqlx::SqlitePool) {
    // Rows: (parent_id, id) — parent_id may be NULL for roots.
    let rows: Vec<(Option<String>, String)> =
        sqlx::query_as("SELECT parent_id, id FROM accounts")
            .fetch_all(pool)
            .await
            .unwrap();
    let ids: std::collections::HashSet<String> =
        rows.iter().map(|(_, id)| id.clone()).collect();
    for (parent, id) in &rows {
        if let Some(p) = parent {
            assert!(
                ids.contains(p),
                "account {id} parent {p} does not reference an existing account"
            );
        }
        // No cycles: walking up must terminate within the account count.
        let mut cursor: Option<String> = Some(id.clone());
        let mut hops = 0;
        while let Some(c) = cursor {
            let next = rows
                .iter()
                .find(|(_, i)| i == &c)
                .and_then(|(p, _)| p.clone());
            match next {
                Some(up) => cursor = Some(up),
                None => break,
            }
            hops += 1;
            assert!(hops <= rows.len(), "cycle detected at account {id}");
        }
    }
}

#[tokio::test]
async fn loans_use_code_224_under_current_liabilities() {
    let pool = build_pool().await;

    assert!(
        row_by_code(&pool, "225").await.is_none(),
        "loan must no longer use code 225"
    );
    let loan = row_by_code(&pool, "224").await.expect("code 224 exists");
    assert_eq!(loan.1, "القروض", "224 is the Loans detail account");
    assert_eq!(loan.2, "Liabilities");
    assert_eq!(loan.3, "Detail");
    assert_eq!(loan.4, "loan");
    assert_eq!(loan.5, 3);

    let parent_22 = loan.6.expect("224 has a parent");
    let liab_22 = row_by_code(&pool, "22").await.expect("22 exists");
    assert_eq!(parent_22, liab_22.0, "224 under 22 الخصوم المتداولة");
    assert_eq!(
        liab_22.6.as_deref(),
        Some(id_by_code(&pool, "2").await.as_str()),
        "22 تحت 2 الخصوم"
    );

    // The wizard's default-account resolution is purpose-driven; the loan
    // purpose must still resolve to the (renamed) loan account.
    let by_purpose: Option<(String, String)> =
        sqlx::query_as("SELECT code, purpose FROM accounts WHERE purpose = 'loan'")
            .fetch_optional(&*pool)
            .await
            .unwrap();
    assert_eq!(by_purpose.as_ref().map(|r| r.0.as_str()), Some("224"), "one loan account, code 224");
}

#[tokio::test]
async fn partner_current_under_equity() {
    let pool = build_pool().await;

    let cur = row_by_code(&pool, "54").await.expect("54 exists");
    assert_eq!(cur.1, "حسابات جارية للشركاء");
    assert_eq!(cur.2, "Equity");
    assert_eq!(cur.3, "Summary");
    assert_eq!(cur.4, "partner_current");
    assert_eq!(cur.5, 2);
    assert_eq!(
        cur.6.as_deref(),
        Some(id_by_code(&pool, "5").await.as_str()),
        "54 must hang under the equity root 5"
    );

    let equity_root = row_by_code(&pool, "5").await.expect("equity root 5 exists");
    assert_eq!(equity_root.2, "Equity");
    assert_eq!(equity_root.5, 1);
}

#[tokio::test]
async fn drawings_under_equity_not_expenses() {
    let pool = build_pool().await;

    let drawings = row_by_code(&pool, "44").await.expect("44 exists");
    assert_eq!(drawings.1, "مسحوبات الشركاء");
    assert_eq!(drawings.2, "Equity");
    assert_eq!(drawings.3, "Summary");
    assert_eq!(drawings.4, "partner_drawings");
    assert_eq!(drawings.5, 2);
    let parent = drawings.6.expect("44 has a parent");
    assert_eq!(parent, id_by_code(&pool, "5").await, "44 under equity root 5");
    assert_ne!(
        parent,
        id_by_code(&pool, "4").await,
        "44 must NOT live under the Expenses group"
    );
}

#[tokio::test]
async fn levels_match_code_length() {
    let pool = build_pool().await;
    let rows: Vec<(String, i32)> =
        sqlx::query_as("SELECT code, level FROM accounts WHERE code GLOB '[0-9]*'")
            .fetch_all(&*pool)
            .await
            .unwrap();
    assert!(!rows.is_empty(), "seeded numeric accounts exist");
    for (code, level) in rows {
        assert_eq!(
            level as usize,
            code.len(),
            "account {code} level {level} must equal its code length"
        );
    }
}

#[tokio::test]
async fn codes_are_unique_and_indexed() {
    let pool = build_pool().await;

    let dups = codes_with_count(
        &pool,
        "SELECT code, COUNT(*) FROM accounts GROUP BY code HAVING COUNT(*) > 1",
    )
    .await;
    assert!(dups.is_empty(), "duplicate account codes: {dups:?}");

    let idx: Option<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_accounts_code_unique'",
    )
    .fetch_optional(&*pool)
    .await
    .unwrap();
    assert!(idx.is_some(), "unique index idx_accounts_code_unique exists");
}

#[tokio::test]
async fn parent_links_are_valid_and_acyclic() {
    let pool = build_pool().await;
    assert_no_cycles_and_valid_parents(&pool).await;
}

#[tokio::test]
async fn partner_subtree_built_under_canonical_parents() {
    let pool = build_pool().await;

    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));

    CreatePartnerUseCase::new(partner_repo.clone(), account_repo.clone(), currency_repo)
        .execute(
            "أحمد".into(),
            "S".into(),
            Decimal::ONE,
            Decimal::from(180),
            false,
            "BasedOnCapitalLocal".into(),
            None,
            START_MODE_EXISTING.into(),
        )
        .await
        .expect("create partner");

    let capital = row_by_code(&pool, "511").await.expect("capital 511");
    assert_eq!(capital.1, "أحمد");
    assert_eq!(capital.2, "Equity");
    assert_eq!(capital.3, "Detail");
    assert_eq!(capital.4, "partner_capital");
    assert_eq!(capital.5, 3, "511 level==code length");
    assert_eq!(
        capital.6.as_deref(),
        Some(id_by_code(&pool, "51").await.as_str()),
        "511 under 51 رأس المال"
    );

    let current = row_by_code(&pool, "541").await.expect("current 541");
    assert_eq!(current.5, 3);
    assert_eq!(
        current.6.as_deref(),
        Some(id_by_code(&pool, "54").await.as_str()),
        "541 under 54 جارية"
    );

    let drawings = row_by_code(&pool, "441").await.expect("drawings 441");
    assert_eq!(drawings.5, 3);
    assert_eq!(
        drawings.6.as_deref(),
        Some(id_by_code(&pool, "44").await.as_str()),
        "441 under 44 مسحوبات"
    );

    assert_no_cycles_and_valid_parents(&pool).await;
}

#[tokio::test]
async fn descendant_closures_of_liabilities_and_equity() {
    let pool = build_pool().await;

    let liability_desc = descendant_codes(&pool, "2").await;
    for expected in ["22", "221", "223", "224"] {
        assert!(
            liability_desc.iter().any(|c| c == expected),
            "liability root 2 must contain {expected}"
        );
    }
    assert!(
        !liability_desc.iter().any(|c| c == "51"),
        "equity capital must not appear under liabilities"
    );

    let equity_desc = descendant_codes(&pool, "5").await;
    for expected in ["51", "52", "53", "54"] {
        assert!(
            equity_desc.iter().any(|c| c == expected),
            "equity root 5 must contain {expected}"
        );
    }
    assert!(
        !equity_desc.iter().any(|c| c == "4"),
        "expenses root 4 must not appear under equity"
    );
}