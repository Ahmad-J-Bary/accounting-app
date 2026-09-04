//! Partner Capitalization. Capitalizing retained earnings (52) into a
//! partner's capital account is a real, auditable journal event through the
//! CapitalizeRetainedEarningsUseCase — it must reduce retained earnings and
//! increase the partner capital ledger while keeping the whole ledger balanced,
//! and a re-submission of the same event id must resolve to the same journal
//! (idempotency) rather than double-posting.
//!
//! Under test (through the real use cases against a real SQLite database):
//!   - partner registration + a cash capital contribution first;
//!   - CapitalizeRetainedEarningsUseCase posts Dr 52 / Cr partner-capital;
//!   - exactly one `Capitalization` journal with source `capitalization:{id}`;
//!   - re-submitting the same event id returns the same journal id;
//!   - the full ledger stays balanced (debit = credit).

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::partner::capitalize::CapitalizeRetainedEarningsUseCase;
use application::use_cases::partner::{CreateCapitalContributionUseCase, CreatePartnerUseCase};
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteFiscalPeriodRepository,
    SqliteFiscalYearRepository, SqliteJournalEntryRepository, SqliteOpeningMigrationRepository,
    SqlitePartnerRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_capitalize_{}.sqlite", uuid::Uuid::new_v4()));
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
    pool
}

async fn set_start_mode(pool: &Arc<sqlx::SqlitePool>, mode: &str) {
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = mode.into();
    settings_repo.save(&settings).await.unwrap();
}

async fn account_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

async fn ledger_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> f64 {
    sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap()
}

fn close_enough(actual: f64, expected: f64) -> bool {
    (actual - expected).abs() < 0.01
}

async fn register_partner_with_capital(pool: &Arc<sqlx::SqlitePool>) -> (String, AccountId) {
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let id = CreatePartnerUseCase::new(partner_repo.clone(), account_repo.clone(), currency_repo)
        .execute(
            "شريك رأس المال".into(),
            "S".into(),
            Decimal::ONE,
            Decimal::from(1000),
            false,
            "BasedOnCapitalLocal".into(),
            None,
            "NewCompany".into(),
            None,
        )
        .await
        .expect("create partner");
    let partner = partner_repo
        .find_by_id(&domain::shared::ids::PartnerId::from_str(&id).unwrap())
        .await
        .unwrap()
        .expect("partner exists");

    // Real capital contribution: cash +1000, capital −1000.
    let cash = account_id_by_code(pool, "122").await;
    let fiscal_year_repo = Arc::new(SqliteFiscalYearRepository::new(pool.clone()));
    let fiscal_period_repo = Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let contribution = CreateCapitalContributionUseCase::new(
        partner_repo.clone(),
        account_repo.clone(),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        fiscal_year_repo,
        fiscal_period_repo,
    );
    contribution
        .execute(
            id.clone(),
            cash.to_string(),
            Decimal::from(1000),
            false,
            Some("cap-evt-1".into()),
        )
        .await
        .expect("contribution posts");

    (
        id,
        partner
            .linked_account_id
            .expect("partner has capital account"),
    )
}

// ---------------------------------------------------------------------------
// Capitalizing retained earnings (52) into a partner capital account posts a
// real, balanced audit journal and is idempotent under the event id.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn capitalization_posts_balanced_auditable_journal_and_is_idempotent() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let (partner_id, cap_id) = register_partner_with_capital(&pool).await;
    let retained = account_id_by_code(&pool, "52").await;

    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let fiscal_year_repo = Arc::new(SqliteFiscalYearRepository::new(pool.clone()));
    let fiscal_period_repo = Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let uc = CapitalizeRetainedEarningsUseCase::new(
        partner_repo,
        account_repo,
        journal_repo.clone(),
        fiscal_year_repo,
        fiscal_period_repo,
    );

    let first = uc
        .execute(
            partner_id.clone(),
            Decimal::from(500),
            None,
            Some("capitalization-1".into()),
        )
        .await
        .expect("capitalization posts");
    let replay = uc
        .execute(
            partner_id,
            Decimal::from(500),
            None,
            Some("capitalization-1".into()),
        )
        .await
        .expect("replay resolves to the same journal");
    assert_eq!(
        first, replay,
        "re-submitting the same event id must not double-post"
    );

    // Exactly one Capitalization journal with the canonical source id.
    let (count, source): (i64, Option<String>) = sqlx::query_as(
        "SELECT COUNT(*), MAX(source_id) FROM journal_entries WHERE journal_type = 'Capitalization'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 1, "exactly one capitalization journal");
    assert_eq!(source.as_deref(), Some("capitalization:capitalization-1"));

    // Ledger: retained earnings reduced by 500 (debited), partner capital credited 500.
    let retained_bal = ledger_balance(&pool, &retained).await;
    let cap_bal = ledger_balance(&pool, &cap_id).await;
    let cash_bal = ledger_balance(&pool, &account_id_by_code(&pool, "122").await).await;
    assert!(
        close_enough(retained_bal, 500.0),
        "retained earnings (52) debited 500 (reducing it), got {retained_bal}"
    );
    assert!(
        close_enough(cap_bal, -1500.0),
        "partner capital credited 500 more (−1500 total), got {cap_bal}"
    );
    assert!(close_enough(cash_bal, 1000.0));

    // The whole ledger stays balanced.
    let (d, c): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(
        close_enough(d, c),
        "full ledger must balance (debit {d} vs credit {c})"
    );
}
