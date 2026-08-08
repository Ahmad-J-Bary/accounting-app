use std::str::FromStr;
use std::sync::Arc;

use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use application::ports::partner_repository::PartnerRepository;
use application::use_cases::partner::CreateCapitalContributionUseCase;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqlitePartnerRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_idem_test_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn seed_partner(pool: &sqlx::SqlitePool) -> String {
    let repo = SqlitePartnerRepository::new(Arc::new(pool.clone()));
    let (capital_parent, drawings_parent) = {
        let capital = sqlx::query_scalar::<_, String>(
            "SELECT id FROM accounts WHERE code = '51' LIMIT 1",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        let drawings = sqlx::query_scalar::<_, String>(
            "SELECT id FROM accounts WHERE code = '44' LIMIT 1",
        )
        .fetch_one(pool)
        .await
        .unwrap();
        (
            AccountId::from_str(&capital).unwrap(),
            AccountId::from_str(&drawings).unwrap(),
        )
    };

    let mut partner = Partner::new(
        "P1".to_string(),
        "شريك".to_string(),
        test_currency(),
        Decimal::ONE,
        Decimal::from(1000),
        false,
        ProfitSharingType::BasedOnCapitalLocal,
        None,
    )
    .unwrap();
    let capital = Account::new(
        "519991".to_string(),
        "رأس مال".to_string(),
        "Capital".to_string(),
        AccountType::Equity,
        Some(capital_parent),
        AccountCategory::Detail,
        4,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();
    let drawings = Account::new(
        "449991".to_string(),
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
    repo.save_with_accounts(&partner, &capital, &drawings, None).await.unwrap();
    partner.id.to_string()
}

async fn funding_account_id(pool: &sqlx::SqlitePool) -> AccountId {
    let id: String = sqlx::query_scalar(
        "SELECT id FROM accounts WHERE code = '122' AND account_type = 'Assets' LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    AccountId::from_str(&id).unwrap()
}

#[tokio::test]
async fn contribution_with_same_event_id_posts_once() {
    let pool = build_pool().await;
    let partner_id = seed_partner(&pool).await;
    let funding = funding_account_id(&pool).await;

    let case = CreateCapitalContributionUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );

    let event = "8f1a2b3c-0000-0000-0000-000000000001".to_string();
    let first = case
        .execute(partner_id.clone(), funding.to_string(), Decimal::from(1000), false, Some(event.clone()))
        .await
        .expect("first contribution should post");

    let second = case
        .execute(partner_id.clone(), funding.to_string(), Decimal::from(1000), false, Some(event.clone()))
        .await
        .expect("re-run must be idempotent");

    assert_eq!(first, second, "same event id must resolve to the same journal");

    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("capital_contribution:{event}"))
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 1, "only one journal may exist for the event");
}

#[tokio::test]
async fn distinct_event_ids_create_distinct_journals() {
    let pool = build_pool().await;
    let partner_id = seed_partner(&pool).await;
    let funding = funding_account_id(&pool).await;

    let case = CreateCapitalContributionUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );

    let a = case
        .execute(partner_id.clone(), funding.to_string(), Decimal::from(100), false, Some("evt-A".into()))
        .await
        .unwrap();
    let b = case
        .execute(partner_id.clone(), funding.to_string(), Decimal::from(200), false, Some("evt-B".into()))
        .await
        .unwrap();
    assert_ne!(a, b);

    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM journal_entries WHERE source_id LIKE 'capital_contribution:%'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 2);
}

#[tokio::test]
async fn database_rejects_duplicate_source_pair() {
    let pool = build_pool().await;
    seed_partner(&pool).await;
    funding_account_id(&pool).await;

    // Manually insert two journals sharing the same (source_type, source_id):
    // the schema-level UNIQUE index must reject the second one.
    let src = "capital_contribution:manual-dup-test";
    sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, updated_at) VALUES (?, ?, 'CapitalContribution', ?, 'capital_contribution', datetime('now'), 'test', 'Posted', datetime('now'), datetime('now'))"
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("9991")
    .bind(src)
    .execute(&*pool)
    .await
    .unwrap();

    let err = sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, updated_at) VALUES (?, ?, 'CapitalContribution', ?, 'capital_contribution', datetime('now'), 'test', 'Posted', datetime('now'), datetime('now'))"
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("9992")
    .bind(src)
    .execute(&*pool)
    .await;
    assert!(err.is_err(), "UNIQUE(source_type, source_id) must reject a duplicate event journal");

    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(src)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
}