//! Partner reporting after the existing-company opening LOCK — regression
//! tests for the «لا يوجد شركاء لعرض كشف الحساب» empty-state bug.
//!
//! The bug: for an EXISTING company, partner capital is booked as the capital
//! account's static `opening_balance` (no creation journal). The migration
//! journal surfaced by `get_ledger` for such accounts is exposed as
//! `opening_entries`, NOT `lines`. The old report filters dropped any partner
//! whose capital ledger had zero `lines`, collapsing the statement/profit-share
//! rows to empty even though real partners exist in the DB.
//!
//! These tests pin the DATA contract the reports depend on: after POST + LOCK
//!   - `list_all` returns the registered partners;
//!   - the capital ledger has an empty `lines` array but populated
//!     `opening_entries` (the exact shape that used to drop the partners);
//!
//! and that editing a partner's registered capital re-syncs the capital
//! account's static opening balance so partner.amount_local == account balance.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::account::AccountQueries;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, LockOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, ValidateOpeningBalanceUseCase,
};
use application::use_cases::partner::{
    CreatePartnerUseCase, UpdatePartnerRequest, UpdatePartnerUseCase,
};
use domain::accounting::MigrationStatus;
use domain::shared::ids::{AccountId, PartnerId};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteJournalEntryRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqlitePartnerRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_partner_reporting_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Runs the opening lifecycle (Draft → Validated → Approved → Posted → Locked)
/// with the provided GL lines and returns the migration id.
async fn run_opening_lifecycle(pool: &Arc<sqlx::SqlitePool>, lines: Vec<OpeningLineInput>) -> String {
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: Some("Legacy".into()),
        source_reference: Some("PARTNERS-2025".into()),
        lines,
    })
    .await
    .expect("create draft migration");
    let id = draft.0.id.clone();
    assert_eq!(draft.0.status, MigrationStatus::Draft);

    let validated = ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone(), "tester".into())
    .await
    .expect("balanced reconciled draft must validate");
    assert_eq!(validated.0.status, MigrationStatus::Validated);

    let approved = ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(id.clone(), "approver".into())
        .await
        .expect("validated migration must approve");
    assert_eq!(approved.0.status, MigrationStatus::Approved);

    let posted = PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("approved reconciled migration must post");
    assert_eq!(posted.migration.0.status, MigrationStatus::Posted);

    let locked = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("posted migration with zero control must lock");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    id
}

async fn register_partner(
    pool: &Arc<sqlx::SqlitePool>,
    name: &str,
    amount: i64,
) -> String {
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    CreatePartnerUseCase::new(partner_repo, account_repo, currency_repo)
        .execute(
            name.into(),
            "S".into(),
            Decimal::ONE,
            Decimal::from(amount),
            false,
            "BasedOnCapitalLocal".into(),
            None,
            START_MODE_EXISTING.into(),
        )
        .await
        .expect("create partner")
}

// ---------------------------------------------------------------------------
// After POST + LOCK the two partners are real, listable records, and their
// capital ledgers expose the registered capital via `opening_entries` with an
// EMPTY `lines` array — the exact ledger shape the old report filter used to
// misread as "partner does not exist".
// ---------------------------------------------------------------------------
#[tokio::test]
async fn existing_company_partners_survive_post_lock_and_ledger_exposes_opening_entries() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let ahmad_id = register_partner(&pool, "أحمد", 180).await;
    let mohammad_id = register_partner(&pool, "محمد", 120).await;

    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let ahmad = partner_repo
        .find_by_id(&PartnerId::from_str(&ahmad_id).unwrap())
        .await
        .unwrap()
        .expect("أحمد exists");
    let mohammad = partner_repo
        .find_by_id(&PartnerId::from_str(&mohammad_id).unwrap())
        .await
        .unwrap()
        .expect("محمد exists");
    let ahmad_cap = ahmad.linked_account_id.expect("أحمد capital account");
    let mohammad_cap = mohammad.linked_account_id.expect("محمد capital account");

    // POST + LOCK the existing-company opening: cash 300 (Dr) against the two
    // partner capital accounts (Cr 180 + 120), exactly like the wizard posts
    // the derived partner-equity lines.
    let cash = account_id_by_code(&pool, "122").await;
    run_opening_lifecycle(&pool, vec![
        OpeningLineInput { account_id: cash.to_string(), amount: "300".into(), description: None },
        OpeningLineInput { account_id: ahmad_cap.to_string(), amount: "180".into(), description: None },
        OpeningLineInput { account_id: mohammad_cap.to_string(), amount: "120".into(), description: None },
    ])
    .await;

    // The reports' partner source (list_partners → list_all) returns both.
    let listed = partner_repo.list_all(false).await.expect("list partners");
    assert_eq!(listed.len(), 2, "both partners must be listed after POST+LOCK");
    let names: Vec<&str> = listed.iter().map(|p| p.name.as_str()).collect();
    assert!(names.contains(&"أحمد"), "أحمد must be listed");
    assert!(names.contains(&"محمد"), "محمد must be listed");

    // The ledger shape the reports consume: capital ledger has an EMPTY `lines`
    // array (the static opening balance is not journal lines) but NON-EMPTY
    // `opening_entries` carrying the registered capital.
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());

    let ledger_ahmad = queries.get_ledger(&[ahmad_cap]).await.expect("أحمد ledger");
    assert_eq!(ledger_ahmad.lines.len(), 0, "static capital is not surfaced as journal lines");
    assert!(!ledger_ahmad.opening_entries.is_empty(), "أحمد opening entries must carry the capital");
    assert!(ledger_ahmad.opening_entry.is_some());
    assert_eq!(ledger_ahmad.opening_balance_base, Decimal::from(180));

    let ledger_mohammad = queries.get_ledger(&[mohammad_cap]).await.expect("محمد ledger");
    assert_eq!(ledger_mohammad.lines.len(), 0, "static capital is not surfaced as journal lines");
    assert!(!ledger_mohammad.opening_entries.is_empty(), "محمد opening entries must carry the capital");
    assert_eq!(ledger_mohammad.opening_balance_base, Decimal::from(120));

    // The opening journal is persisted exactly once (no duplicate partner lines).
    let opening_type_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'AccountOpeningBalance'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(opening_type_count, 1, "exactly one AccountOpeningBalance journal");
}

// ---------------------------------------------------------------------------
// The wizard's inline "تعديل رأس مال الشريك" (savePartnerCapital → update_partner)
// re-syncs the capital account's static opening balance in existing mode so the
// ledger and the statement (which reads partner.amount_local) never diverge.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn update_partner_re_syncs_capital_opening_balance_in_existing_mode() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let ahmad_id = register_partner(&pool, "أحمد", 180).await;

    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));

    let ahmad = partner_repo
        .find_by_id(&PartnerId::from_str(&ahmad_id).unwrap())
        .await
        .unwrap()
        .expect("أحمد exists");
    let cap_id = ahmad.linked_account_id.expect("capital account");

    // Wizard edit: registered capital 180 → 220.
    UpdatePartnerUseCase::new(partner_repo.clone(), account_repo.clone(), currency_repo)
        .execute(
            UpdatePartnerRequest {
                id: ahmad_id.clone(),
                name: "أحمد".into(),
                currency_code: "S".into(),
                exchange_rate: Decimal::ONE,
                amount: Decimal::from(220),
                is_amount_in_original: false,
                sharing_type: "BasedOnCapitalLocal".into(),
                manual_ratio: None,
            },
            START_MODE_EXISTING.into(),
        )
        .await
        .expect("update partner");

    let partner = partner_repo
        .find_by_id(&PartnerId::from_str(&ahmad_id).unwrap())
        .await
        .unwrap()
        .expect("أحمد still exists");
    assert_eq!(partner.amount_local, Decimal::from(220));
    assert_eq!(partner.amount_local, partner.amount_original);

    let cap = account_repo.find_by_id(&cap_id).await.unwrap().expect("capital account exists");
    assert_eq!(cap.opening_balance, Decimal::from(220), "capital opening balance must follow the registered amount");
    assert_eq!(cap.balance, Decimal::from(220), "capital balance must follow the registered amount");
}