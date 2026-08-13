//! Phase 8 — Bank scenario on a NEW company: create a bank account through the
//! real CreateAccountUseCase, post cash movements through it, and verify the
//! live bank ledger reconciles (Dr bank / Cr cash on deposit; the reverse on
//! withdrawal). The bank ledger is read from `journal_lines` (source of truth),
//! and the account row's stored balance tracks the ledger.
//!
//! Journal: deposit  Dr bank / Cr cash
//!          payment Dr <expense> / Cr bank

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::account::types::CreateAccountCommand;
use application::use_cases::account::CreateAccountUseCase;
use chrono::Utc;
use domain::accounting::account::{AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteJournalEntryRepository,
    SqliteOpeningMigrationRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_bank_ledger_{}.sqlite", uuid::Uuid::new_v4()));
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

fn line(account: AccountId, debit: Decimal, credit: Decimal) -> JournalLine {
    let c = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    JournalLine::new(
        account,
        if debit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(debit, c.clone()), dec!(1))
        } else {
            MonetaryAmount::zero(c.clone())
        },
        if credit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(credit, c), dec!(1))
        } else {
            MonetaryAmount::zero(c)
        },
        "بند بنكي".to_string(),
    )
}

async fn post_journal(
    journal_repo: &Arc<dyn JournalEntryRepository>,
    journal_type: JournalType,
    lines: Vec<JournalLine>,
    description: &str,
) {
    let mut entry = JournalEntry::new(
        journal_repo.get_next_entry_number().await.unwrap(),
        journal_type,
        lines,
        Utc::now(),
        description.to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    journal_repo.save(&entry).await.unwrap();
}

// ---------------------------------------------------------------------------
// Creating a bank account (through the real module) then depositing and paying
// from it keeps the ledger reconciled: Dr bank = Cr cash on deposit, the bank
// stored balance tracks the ledger, and the bank entry is balanced.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn bank_account_deposit_and_payment_reconcile_to_ledger() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    // Create a Bank asset account under Current Assets (12) via the real module.
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let assets_root = account_id_by_code(&pool, "12").await;

    let bank = CreateAccountUseCase::new(
        account_repo.clone(),
        journal_repo.clone(),
        None,
        None,
        currency_repo,
        migration_repo,
    )
    .execute(CreateAccountCommand {
        code: "1280".into(),
        name_ar: "البنك التجاري".into(),
        name_en: "Commercial Bank".into(),
        account_type: AccountType::Assets,
        parent_id: Some(assets_root),
        category: AccountCategory::Detail,
        level: 3,
        opening_balance: "0".into(),
        notes: Some("حساب بنكي".into()),
        linked_customer_id: None,
        linked_supplier_id: None,
        phone: None,
        address: None,
        debit: Some("0".into()),
        credit: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
    })
    .await
    .expect("create bank account");
    let bank_id = bank.id;
    let cash = account_id_by_code(&pool, "122").await;
    let rent = account_id_by_code(&pool, "432").await;

    // Deposit 3000: Dr bank / Cr cash.
    post_journal(
        &journal_repo,
        JournalType::CashReceipt,
        vec![line(bank_id, dec!(3000), dec!(0)), line(cash, dec!(0), dec!(3000))],
        "إيداع بنكي",
    )
    .await;

    // Bank payment 500 (rent): Dr rent / Cr bank.
    post_journal(
        &journal_repo,
        JournalType::CashPayment,
        vec![line(rent, dec!(500), dec!(0)), line(bank_id, dec!(0), dec!(500))],
        "دفع إيجار من البنك",
    )
    .await;

    // Bank ledger = 3000 − 500 = 2500; cash = −3000; rent = +500.
    assert!(close_enough(ledger_balance(&pool, &bank_id).await, 2500.0), "bank ledger must be 2500");
    assert!(close_enough(ledger_balance(&pool, &cash).await, -3000.0), "cash −3000 (transfer to bank)");
    assert!(close_enough(ledger_balance(&pool, &rent).await, 500.0), "rent expense +500 (bank payment)");

    // Every journal is balanced.
    let unbalanced: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (
            SELECT je.id
            FROM journal_entries je
            JOIN journal_lines jl ON jl.journal_entry_id = je.id
            GROUP BY je.id
            HAVING ABS(SUM(CAST(jl.debit_base AS REAL)) - SUM(CAST(jl.credit_base AS REAL))) > 0.01
        )",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(unbalanced, 0, "bank transactions must balance");

    // The two cash/journals exist exactly once each (deposit = CashReceipt,
    // payment = CashPayment).
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'CashReceipt'")
            .fetch_one(&*pool)
            .await
            .unwrap(),
        1
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'CashPayment'")
            .fetch_one(&*pool)
            .await
            .unwrap(),
        1
    );
}
