use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::CreateOpeningBalanceUseCase;
use chrono::Utc;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteOpeningMigrationRepository, SqliteSettingsRepository,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_obpl_test_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn account_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

async fn make_case(pool: Arc<sqlx::SqlitePool>) -> CreateOpeningBalanceUseCase {
    let repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    // A migration only exists in ExistingCompanyMigration mode.
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode =
        application::use_cases::opening_balance::create::START_MODE_EXISTING.into();
    settings_repo.save(&settings).await.unwrap();
    CreateOpeningBalanceUseCase::new(repo, account_repo, settings_repo)
}

fn cmd(
    lines: Vec<(String, String)>,
) -> application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
    application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
        cutover_date: Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: lines
            .into_iter()
            .map(|(account_id, amount)| OpeningLineInput {
                account_id,
                amount,
                description: None,
            })
            .collect(),
    }
}

#[tokio::test]
async fn create_opening_rejects_revenue_accounts() {
    let pool = build_pool().await;
    let case = make_case(pool.clone()).await;

    let cash = account_id_by_code(pool.as_ref(), "122").await;
    let revenue = account_id_by_code(pool.as_ref(), "311").await;

    let err = case
        .execute(cmd(vec![
            (cash.to_string(), "100".to_string()),
            (revenue.to_string(), "100".to_string()),
        ]))
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("قائمة الدخل"),
        "unexpected err: {err}"
    );
}

#[tokio::test]
async fn create_opening_rejects_expense_accounts() {
    let pool = build_pool().await;
    let case = make_case(pool.clone()).await;

    let cash = account_id_by_code(pool.as_ref(), "122").await;
    let expense = account_id_by_code(pool.as_ref(), "431").await;

    let err = case
        .execute(cmd(vec![
            (cash.to_string(), "100".to_string()),
            (expense.to_string(), "100".to_string()),
        ]))
        .await
        .unwrap_err();
    assert!(
        err.to_string().contains("قائمة الدخل"),
        "unexpected err: {err}"
    );
}

#[tokio::test]
async fn create_opening_allows_balance_sheet_accounts() {
    let pool = build_pool().await;
    let case = make_case(pool.clone()).await;

    let cash = account_id_by_code(pool.as_ref(), "122").await;
    let equity = account_id_by_code(pool.as_ref(), "52").await;

    let result = case
        .execute(cmd(vec![
            (cash.to_string(), "100".to_string()),
            (equity.to_string(), "100".to_string()),
        ]))
        .await
        .expect("balance-sheet opening lines must be accepted");
    assert!(!result.0.id.is_empty());
}
