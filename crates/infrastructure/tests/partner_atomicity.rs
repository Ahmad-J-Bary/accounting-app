use std::str::FromStr;
use std::sync::Arc;

use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use application::ports::partner_repository::PartnerRepository;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqlitePartnerRepository;
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_partner_test_{}.sqlite", uuid::Uuid::new_v4()));
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

fn sample_account(code: &str, parent_id: Option<AccountId>, level: i32) -> Account {
    Account::new(
        code.to_string(),
        format!("حساب {code}"),
        format!("Account {code}"),
        AccountType::Equity,
        parent_id,
        AccountCategory::Detail,
        level,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap()
}

fn sample_partner(name: &str) -> Partner {
    Partner::new(
        format!("P-{name}"),
        name.to_string(),
        test_currency(),
        Decimal::ONE,
        Decimal::from(1000),
        false,
        ProfitSharingType::BasedOnCapitalLocal,
        None,
    )
    .unwrap()
}

/// Real parent accounts from the seeded chart: "51" capital and "44" drawings
/// (both Equity after migration 143).
async fn fetch_parent_ids(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let capital = sqlx::query_scalar::<_, String>(
        "SELECT id FROM accounts WHERE code = '51' AND account_type = 'Equity' LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    let drawings = sqlx::query_scalar::<_, String>(
        "SELECT id FROM accounts WHERE code = '44' AND account_type = 'Equity' LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    (
        AccountId::from_str(&capital).unwrap(),
        AccountId::from_str(&drawings).unwrap(),
    )
}

#[tokio::test]
async fn save_with_accounts_persists_partner_and_accounts_atomically() {
    let pool = build_pool().await;
    let repo = SqlitePartnerRepository::new(pool.clone());

    let (capital_parent, drawings_parent) = fetch_parent_ids(&pool).await;

    let mut partner = sample_partner("One");
    let capital = sample_account("CA199910", Some(capital_parent), 4);
    let drawings = sample_account("449991", Some(drawings_parent), 3);
    partner.link_account(capital.id);
    partner.link_drawings_account(drawings.id);

    repo.save_with_accounts(&partner, &capital, &drawings, None)
        .await
        .unwrap();

    let stored = repo.find_by_id(&partner.id).await.unwrap().expect("partner persisted");
    assert_eq!(stored.name, "One");
    let cap_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(capital.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let draw_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(drawings.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(cap_rows, 1);
    assert_eq!(draw_rows, 1);
}

#[tokio::test]
async fn save_with_accounts_rolls_back_everything_when_account_code_duplicates() {
    let pool = build_pool().await;
    let repo = SqlitePartnerRepository::new(pool.clone());

    let (capital_parent, drawings_parent) = fetch_parent_ids(&pool).await;

    let mut partner = sample_partner("Two");
    let capital = sample_account("CA2991", Some(capital_parent), 4);
    // Second account intentionally duplicates the first account's code so the
    // second INSERT fails and the shared transaction must roll back the partner
    // as well (no partial write).
    let drawings = Account::new(
        capital.code.clone(),
        "مسحوبات".to_string(),
        "Drawings".to_string(),
        AccountType::Equity,
        Some(drawings_parent),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();

    partner.link_account(capital.id);
    partner.link_drawings_account(drawings.id);

    let err = repo.save_with_accounts(&partner, &capital, &drawings, None).await;
    assert!(err.is_err(), "المعاملة يجب أن تفشل عند تضارب كود الحساب");

    let partner_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM partners WHERE id = ?")
        .bind(partner.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    let cap_rows: i64 = sqlx::query_scalar("SELECT count(*) FROM accounts WHERE id = ?")
        .bind(capital.id.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(partner_rows, 0, "الشريك يجب أن يُسحب مع فشل المعاملة");
    assert_eq!(cap_rows, 0, "حساب رأس المال يجب ألا يبقى جزئياً");
}