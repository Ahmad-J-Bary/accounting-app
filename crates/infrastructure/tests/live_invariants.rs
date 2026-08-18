//! Live accounting invariants after a realistic sequence of normal
//! postings on a NEW company (window closed, real ledger events everywhere).
//!
//! The ledger is always the source of truth: we drive the customer/supplier/
//! partner use cases (which post their own journals) and two direct balanced
//! journals (a cash sale and a rent expense), then assert from `journal_lines`:
//!
//!   1. Debit == Credit  (every journal, and the whole ledger);
//!   2. A == L + E       (the accounting equation holds live);
//!   3. Sub-ledger ↔ GL: the AR customer account and AP supplier account each
//!      reconcile to the ledger buckets that carry them.
//!
//! Expected final ledger (base units):
//!   Assets   cash 1000 +400 −100 = 1300 ; AR 700          → 2000
//!   Liab     AP 500                                       →  500
//!   Equity   capital 1000 ; OBE 200 ; revenue 400 − rent 100 → 1500
//!   A (2000) == L (500) + E (1500) ✓

use std::str::FromStr;
use std::sync::Arc;

use application::dto::customer_dto::CreateCustomerRequest;
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::customer::CreateCustomerUseCase;
use application::use_cases::partner::{CreateCapitalContributionUseCase, CreatePartnerUseCase};
use chrono::Utc;
use domain::accounting::account::AccountPurpose;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteCustomerRepository,
    SqliteJournalEntryRepository, SqliteOpeningMigrationRepository, SqlitePartnerRepository,
    SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_live_invariants_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Net of posted journal lines touching an account (base units). Positive = net
/// debit; credit-normal accounts yield negative for credits.
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
        "بند تجريبي".to_string(),
    )
}

async fn post_journal(
    journal_repo: &Arc<dyn JournalEntryRepository>,
    journal_type: JournalType,
    lines: Vec<JournalLine>,
    description: &str,
) -> String {
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
    entry.id.to_string()
}

// ---------------------------------------------------------------------------
// The full mixed sequence reaches a ledger that satisfies Debit=Credit and
// A == L + E, with AR/AP sub-ledgers reconciling to their ledger buckets.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn live_ledger_satisfies_debit_credit_and_accounting_equation() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let cash = account_id_by_code(&pool, "122").await;
    let obe = account_id_by_code(&pool, "53").await;
    let revenue = account_id_by_code(&pool, "311").await;
    let rent = account_id_by_code(&pool, "432").await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    // 1) Partner + real capital contribution: Dr cash 1000 / Cr capital 1000.
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let partner_id = CreatePartnerUseCase::new(
        partner_repo.clone(),
        account_repo.clone(),
        currency_repo.clone(),
    )
    .execute(
        "شريك".into(),
        "S".into(),
        Decimal::ONE,
        Decimal::ZERO,
        false,
        "BasedOnCapitalLocal".into(),
        None,
        "NewCompany".into(),
    )
    .await
    .expect("create partner");
    let partner = partner_repo
        .find_by_id(&domain::shared::ids::PartnerId::from_str(&partner_id).unwrap())
        .await
        .unwrap()
        .expect("partner exists");
    let _capital = partner.linked_account_id.expect("partner capital account");
    CreateCapitalContributionUseCase::new(
        partner_repo,
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(partner_id, cash.to_string(), Decimal::from(1000), false, Some("li-c1".into()))
    .await
    .expect("contribution");

    // 2) Customer with 700 opening AR (posts its partner opening journal).
    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let customer = CreateCustomerUseCase::new(
        customer_repo,
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "".into(),
        name: "عميل".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: Some("700".into()),
        credit: None,
        opening_balance: Some("700".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer");
    let ar_account = AccountId(uuid::Uuid::parse_str(&customer.account_id.unwrap()).unwrap());

    // 3) Supplier with 500 opening AP (posts its partner opening journal).
    let supplier_repo = Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let supplier_dto = application::use_cases::supplier::CreateSupplierUseCase::new(
        supplier_repo,
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(application::dto::supplier_dto::CreateSupplierRequest {
        code: "".into(),
        name: "مورد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: Some("500".into()),
        opening_balance: Some("500".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create supplier");
    let ap_account = AccountId(uuid::Uuid::parse_str(&supplier_dto.account_id.unwrap()).unwrap());

    // 4) Cash sale: Dr cash 400 / Cr revenue 400.
    post_journal(
        &journal_repo,
        JournalType::CashSalesJournal,
        vec![line(cash, dec!(400), dec!(0)), line(revenue, dec!(0), dec!(400))],
        "بيع نقدي",
    )
    .await;

    // 5) Rent expense: Dr rent 100 / Cr cash 100.
    post_journal(
        &journal_repo,
        JournalType::GeneralJournal,
        vec![line(rent, dec!(100), dec!(0)), line(cash, dec!(0), dec!(100))],
        "إيجار",
    )
    .await;

    // ---- Invariant 1: every journal and the whole ledger balance.
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
    assert_eq!(unbalanced, 0, "no unbalanced journal may exist (found {unbalanced})");

    let (total_d, total_c): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(
        (total_d - total_c).abs() < 0.01,
        "whole ledger must balance (debit {total_d} vs credit {total_c})"
    );

    // ---- Invariant 2: A == L + E from the live ledger.
    async fn bucket(pool: &sqlx::SqlitePool, account_type: &str) -> f64 {
        sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL) - CAST(jl.credit_base AS REAL)), 0.0)
             FROM journal_lines jl
             JOIN accounts a ON a.id = jl.account_id
             WHERE a.account_type = ?",
        )
        .bind(account_type)
        .fetch_one(pool)
        .await
        .unwrap()
    }
    // Assets carry their value on the debit side → net debit is the asset value.
    // Liabilities/Equity/Revenue carry value on the credit side → net credit
    // (−net debit) is the value; Expenses (debit-normal) reduce equity.
    let assets = bucket(&pool, "Assets").await;
    let liabilities = -bucket(&pool, "Liabilities").await;
    let equity = -bucket(&pool, "Equity").await
        - bucket(&pool, "Revenue").await
        - bucket(&pool, "Expenses").await;

    assert!((assets - 2000.0).abs() < 0.01, "assets expected 2000, got {assets}");
    assert!((liabilities - 500.0).abs() < 0.01, "liabilities expected 500, got {liabilities}");
    assert!((equity - 1500.0).abs() < 0.01, "equity expected 1500, got {equity}");
    assert!(
        (assets - (liabilities + equity)).abs() < 0.01,
        "A == L + E must hold (A {assets}, L {liabilities}, E {equity})"
    );

    // ---- Invariant 3: sub-ledgers reconcile to the GL buckets that carry them.
    // The AR customer account (Receivable purpose) reconciles to the 700 AR
    // opening; the AP supplier account (Payable purpose) to the 500 AP opening.
    assert!((ledger_balance(&pool, &ar_account).await - 700.0).abs() < 0.01, "AR sub-ledger must be 700");
    assert!((ledger_balance(&pool, &ap_account).await - (-500.0)).abs() < 0.01, "AP sub-ledger must be 500 (credit)");

    let ar_purpose: String = sqlx::query_scalar("SELECT purpose FROM accounts WHERE id = ?")
        .bind(ar_account.0.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(ar_purpose, AccountPurpose::Receivable.to_str(), "AR account purpose is Receivable");

    let ap_purpose: String = sqlx::query_scalar("SELECT purpose FROM accounts WHERE id = ?")
        .bind(ap_account.0.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(ap_purpose, AccountPurpose::Payable.to_str(), "AP account purpose is Payable");

    let ar_type: String = sqlx::query_scalar("SELECT account_type FROM accounts WHERE id = ?")
        .bind(ar_account.0.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(ar_type, "Assets", "AR account is an asset");

    let ap_type: String = sqlx::query_scalar("SELECT account_type FROM accounts WHERE id = ?")
        .bind(ap_account.0.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(ap_type, "Liabilities", "AP account is a liability");

    // OBE 53 nets to the customer/supplier opening difference (700 − 500 = 200).
    assert!((ledger_balance(&pool, &obe).await - (-200.0)).abs() < 0.01, "OBE nets to 200 (credit)");
}
