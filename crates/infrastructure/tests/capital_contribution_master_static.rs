use std::str::FromStr;
use std::sync::Arc;

use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use application::ports::partner_repository::PartnerRepository;
use application::use_cases::equity::GetPartnerEquityStatementUseCase;
use application::use_cases::partner::CreateCapitalContributionUseCase;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqliteOpeningMigrationRepository,
    SqlitePartnerRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_contrib_static_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Seed a partner with registered capital 1000 in master data and an EMPTY
/// ledger (no contribution journal yet), exactly like CreatePartnerUseCase.
async fn seed_partner_uncontributed(pool: &Arc<sqlx::SqlitePool>) -> (String, String) {
    let repo = SqlitePartnerRepository::new(pool.clone());
    let (capital_parent, drawings_parent) = {
        let capital = sqlx::query_scalar::<_, String>(
            "SELECT id FROM accounts WHERE code = '51' AND account_type = 'Equity' LIMIT 1",
        )
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        let drawings = sqlx::query_scalar::<_, String>(
            "SELECT id FROM accounts WHERE code = '44' AND account_type = 'Equity' LIMIT 1",
        )
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        (
            AccountId::from_str(&capital).unwrap(),
            AccountId::from_str(&drawings).unwrap(),
        )
    };

    let mut partner = Partner::new(
        "P3".to_string(),
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
        "519999".to_string(),
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
        "449999".to_string(),
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
    (partner.id.to_string(), capital.id.0.to_string())
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

/// Audit contract (finding F6, user-approved): master-data capital is
/// the OFFICIAL REGISTERED amount and stays static; the ledger is the truth for
/// equity. A capital contribution only posts a journal — it never mutates
/// partner.amount_local, and the equity statement reads the ledger balance.
#[tokio::test]
async fn contribution_keeps_master_static_and_ledger_is_truth() {
    let pool = build_pool().await;
    let (partner_id, capital_account_id) = seed_partner_uncontributed(&pool).await;
    let funding = funding_account_id(&pool).await;

    let case = CreateCapitalContributionUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    );
    case.execute(
        partner_id.clone(),
        funding.to_string(),
        Decimal::from(500),
        false,
        Some("legacy-contrib-1".into()),
    )
    .await
    .expect("contribution must post");

    let stored_amount: String = sqlx::query_scalar(
        "SELECT amount_local FROM partners WHERE id = ?",
    )
    .bind(&partner_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(
        stored_amount, "1000",
        "master-data registered capital must stay static after a contribution"
    );

    let statement = GetPartnerEquityStatementUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(None, None)
    .await
    .unwrap();
    let row = statement.rows.iter().find(|r| r.partner_id == partner_id).expect("row");
    assert_eq!(row.capital_registered, "1000", "registered capital = master data");
    assert_eq!(row.ledger_balance, "500", "ledger is the truth: contribution moves it");
    assert_eq!(row.total_equity, "500", "equity = ledger capital (no drawings, no current)");
    assert_eq!(row.current_balance, "0");
    assert_eq!(row.drawings, "0");

    // No journal may have touched master data: still exactly one contribution entry.
    let entries: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM journal_entries WHERE source_id LIKE 'capital_contribution:%'",
    )
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(entries, 1);

    let _ = capital_account_id;
}
