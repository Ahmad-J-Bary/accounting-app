//! Phase 5 — the posted opening journal is the ONE GL movement.
//!
//! After an EXISTING-company opening is validated → posted → locked, the
//! opening amount must appear in the general ledger exactly once: as the posted
//! `AccountOpeningBalance` journal line in `lines`. `opening_entries` (the
//! metadata carrier) must NOT produce a second, synthetic row, and the running /
//! closing balances follow Beginning (from the journal line) + Dr - Cr — never
//! the static `opening_balance` field again once a posted opening line exists.

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
use application::use_cases::partner::CreatePartnerUseCase;
use chrono::{Duration, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::MigrationStatus;
use domain::shared::ids::{AccountId, PartnerId};
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::Currency;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteJournalEntryRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqlitePartnerRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_gl_movement_{}.sqlite", uuid::Uuid::new_v4()));
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
    let base = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
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

async fn register_partner(pool: &Arc<sqlx::SqlitePool>, name: &str, amount: i64) -> String {
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
        cutover_date: Utc::now().to_rfc3339(),
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

#[tokio::test]
async fn posted_opening_appears_exactly_once_in_gl_with_begin_end_math() {
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

    let cash = account_id_by_code(&pool, "122").await;

    // POST + LOCK: cash 300 (Dr) against partner capitals (Cr 180 + 120).
    run_opening_lifecycle(&pool, vec![
        OpeningLineInput { account_id: cash.to_string(), amount: "300".into(), description: None },
        OpeningLineInput { account_id: ahmad_cap.to_string(), amount: "180".into(), description: None },
        OpeningLineInput { account_id: mohammad_cap.to_string(), amount: "120".into(), description: None },
    ])
    .await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());

    // CASH (Assets, debit-normal): exactly ONE movement — the posted opening
    // journal line Dr 300. No synthetic row, no second appearance of the
    // opening amount.
    let ledger_cash = queries.get_ledger(&[cash]).await.expect("cash ledger");
    assert_eq!(ledger_cash.lines.len(), 1, "cash opening must be exactly one GL line");
    assert!(ledger_cash.opening_entries.is_empty(), "opening_entries must be empty (no synthetic rows)");
    assert_eq!(ledger_cash.lines[0].debit_base, Decimal::from(300));
    assert_eq!(ledger_cash.lines[0].credit_base, Decimal::ZERO);
    assert_eq!(ledger_cash.lines[0].balance_base, Decimal::from(300));
    assert_eq!(ledger_cash.total_debit_base, Decimal::from(300));
    assert_eq!(ledger_cash.closing_balance_base, Decimal::from(300));

    // CAPITAL (Equity, credit-normal): the SAME single movement, Cr 180.
    let ledger_ahmad = queries.get_ledger(&[ahmad_cap]).await.expect("أحمد ledger");
    assert_eq!(ledger_ahmad.lines.len(), 1, "أحمد capital opening must be exactly one GL line");
    assert!(ledger_ahmad.opening_entries.is_empty(), "opening_entries must be empty (no synthetic rows)");
    assert_eq!(ledger_ahmad.lines[0].debit_base, Decimal::ZERO);
    assert_eq!(ledger_ahmad.lines[0].credit_base, Decimal::from(180));
    assert_eq!(ledger_ahmad.lines[0].balance_base, Decimal::from(-180));
    assert_eq!(ledger_ahmad.closing_balance_base, Decimal::from(-180));

    // Exactly one AccountOpeningBalance journal in the DB — the whole migration
    // is ONE posted transaction; nothing is duplicated.
    let opening_type_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'AccountOpeningBalance' AND status = 'Posted'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(opening_type_count, 1, "exactly one posted AccountOpeningBalance journal");
}

#[tokio::test]
async fn gl_running_balances_follow_beginning_plus_period_movements() {
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

    let cash = account_id_by_code(&pool, "122").await;

    run_opening_lifecycle(&pool, vec![
        OpeningLineInput { account_id: cash.to_string(), amount: "300".into(), description: None },
        OpeningLineInput { account_id: ahmad_cap.to_string(), amount: "180".into(), description: None },
        OpeningLineInput { account_id: mohammad_cap.to_string(), amount: "120".into(), description: None },
    ])
    .await;

    // A LATER period movement: capital withdrawal — cash Cr 100 against أحمد's
    // capital Dr 100. entry_date AFTER the opening cutover.
    let currency = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    let mut withdrawal = JournalEntry::new(
        "9100".to_string(),
        JournalType::GeneralJournal,
        vec![
            JournalLine::new(
                cash,
                MonetaryAmount::zero(currency.clone()),
                MonetaryAmount::new(Money::new(dec!(100), currency.clone()), dec!(1)),
                "سحب شريك".into(),
            ),
            JournalLine::new(
                ahmad_cap,
                MonetaryAmount::new(Money::new(dec!(100), currency.clone()), dec!(1)),
                MonetaryAmount::zero(currency),
                "سحب شريك".into(),
            ),
        ],
        Utc::now() + Duration::days(2),
        "سحب رأس المال".into(),
        None,
    )
    .unwrap();
    withdrawal.post().unwrap();
    journal_repo_save(&pool, withdrawal).await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());

    // CASH: opening Dr 300 (balance 300) THEN withdrawal Cr 100 (balance 200).
    let ledger_cash = queries.get_ledger(&[cash]).await.expect("cash ledger");
    assert_eq!(ledger_cash.lines.len(), 2, "cash must have opening + withdrawal");
    assert_eq!(ledger_cash.lines[0].credit_base, Decimal::ZERO);
    assert_eq!(ledger_cash.lines[0].balance_base, Decimal::from(300));
    assert_eq!(ledger_cash.lines[1].credit_base, Decimal::from(100));
    assert_eq!(ledger_cash.lines[1].balance_base, Decimal::from(200));
    assert_eq!(ledger_cash.total_debit_base, Decimal::from(300));
    assert_eq!(ledger_cash.total_credit_base, Decimal::from(100));
    assert_eq!(ledger_cash.closing_balance_base, Decimal::from(200));

    // CAPITAL: opening Cr 180 (-180) THEN withdrawal Dr 100 (-80).
    let ledger_ahmad = queries.get_ledger(&[ahmad_cap]).await.expect("أحمد ledger");
    assert_eq!(ledger_ahmad.lines.len(), 2, "capital must have opening + withdrawal");
    assert_eq!(ledger_ahmad.lines[0].credit_base, Decimal::from(180));
    assert_eq!(ledger_ahmad.lines[0].balance_base, Decimal::from(-180));
    assert_eq!(ledger_ahmad.lines[1].debit_base, Decimal::from(100));
    assert_eq!(ledger_ahmad.lines[1].balance_base, Decimal::from(-80));
    assert_eq!(ledger_ahmad.total_debit_base, Decimal::from(100));
    assert_eq!(ledger_ahmad.total_credit_base, Decimal::from(180));
    assert_eq!(ledger_ahmad.closing_balance_base, Decimal::from(-80));
}

async fn journal_repo_save(pool: &Arc<sqlx::SqlitePool>, entry: JournalEntry) {
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    journal_repo.save(&entry).await.expect("save withdrawal");
}
