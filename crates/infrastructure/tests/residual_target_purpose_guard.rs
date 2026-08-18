//! Residual reclassification target guard (company-lifecycle audit finding B1).
//!
//! The residual Opening Balance Equity (53) is an equity clearing item: its
//! classification target must be an equity-type account with an acceptable
//! passive purpose (Retained Earnings / Opening Balance Equity / General /
//! Partner Current). Routing it to an operating, sub-ledger or registered
//! partner-capital account is rejected both at classification time and (as
//! defense-in-depth) at apply time.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, SetResidualClassificationCommand, SetResidualClassificationUseCase,
};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use domain::accounting::{MigrationStatus, ResidualClassification};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqliteOpeningMigrationRepository,
    SqliteOpeningPostingRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_obresidual_purpose_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Seeds a custom account row under an existing parent code with an explicit
/// purpose; returns the generated account id.
async fn seed_account(
    pool: &sqlx::SqlitePool,
    code: &str,
    name: &str,
    account_type: &str,
    parent_code: &str,
    purpose: &str,
) -> AccountId {
    let parent_id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(parent_code)
        .fetch_one(pool)
        .await
        .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Detail', 4, '0', '0', ?, 1, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(account_type)
    .bind(parent_id)
    .bind(purpose)
    .execute(pool)
    .await
    .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

async fn account_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

fn line(account: AccountId, debit: Decimal, credit: Decimal) -> JournalLine {
    let c = test_currency();
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
        "test".to_string(),
    )
}

#[tokio::test]
async fn classify_rejects_non_equity_target() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));

    let asset = seed_account(pool.as_ref(), "1209", "أصل غير قابلة للتصنيف", "Assets", "12", "receivable")
        .await;
    let migration = OpeningBalanceMigration::new(
        uuid::Uuid::new_v4().to_string(),
        chrono::Utc::now(),
        None,
        vec![OpeningBalanceLine { account_id: asset, amount: dec!(100), description: None }],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();

    let err = SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration.id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(asset.0.to_string()),
        })
        .await
        .expect_err("routing residual to an asset must be rejected");
    assert!(
        err.to_string().contains("حقوق الملكية"),
        "unexpected error: {err}"
    );
}

#[tokio::test]
async fn classify_rejects_partner_capital_target() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));

    let capital = seed_account(pool.as_ref(), "519999", "رأس مال مسجل", "Equity", "51", "partner_capital")
        .await;
    let migration = OpeningBalanceMigration::new(
        uuid::Uuid::new_v4().to_string(),
        chrono::Utc::now(),
        None,
        vec![OpeningBalanceLine { account_id: capital, amount: dec!(100), description: None }],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();

    let err = SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration.id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(capital.0.to_string()),
        })
        .await
        .expect_err("profit/residual must never silently change registered capital");
    assert!(err.to_string().contains("حقوق الملكية"), "unexpected error: {err}");
}

#[tokio::test]
async fn classify_accepts_retained_earnings_target() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));

    let retained = account_id_by_code(pool.as_ref(), "52").await;
    let migration = OpeningBalanceMigration::new(
        uuid::Uuid::new_v4().to_string(),
        chrono::Utc::now(),
        None,
        vec![OpeningBalanceLine { account_id: retained, amount: dec!(100), description: None }],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();

    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration.id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(retained.0.to_string()),
        })
        .await
        .expect("retained earnings is an acceptable residual target");
}

#[tokio::test]
async fn apply_rejects_pre_guard_misclassified_target() {
    // Defense-in-depth: a classification recorded before the guard existed (here
    // simulated by writing the residual_account_id directly onto the aggregate)
    // must still be refused by the apply step.
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    let asset = seed_account(pool.as_ref(), "1210", "أصل خاطئ", "Assets", "12", "receivable").await;
    let liability = seed_account(pool.as_ref(), "2210", "التزام", "Liabilities", "22", "payable").await;
    let capital = seed_account(pool.as_ref(), "519998", "رأس مال", "Equity", "51", "partner_capital")
        .await;
    let obe = account_id_by_code(pool.as_ref(), "53").await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    let mut migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        chrono::Utc::now(),
        None,
        vec![
            OpeningBalanceLine { account_id: asset, amount: dec!(150), description: None },
            OpeningBalanceLine { account_id: liability, amount: dec!(50), description: None },
            OpeningBalanceLine { account_id: capital, amount: dec!(55), description: None },
            OpeningBalanceLine { account_id: obe, amount: dec!(45), description: None },
        ],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();
    migration.validate("t").unwrap();
    migration.approve("t").unwrap();
    migration.mark_posted().unwrap();
    migration_repo.update(&migration).await.unwrap();

    // Posting journal exactly as PostOpeningBalanceUseCase would build it.
    let mut entry = JournalEntry::new(
        "OBP-GUARD-1".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            line(asset, dec!(150), dec!(0)),
            line(liability, dec!(0), dec!(50)),
            line(capital, dec!(0), dec!(55)),
            line(obe, dec!(0), dec!(45)),
        ],
        migration.cutover_date,
        "قيد ترحيل رصيد افتتاح الشركة".to_string(),
        Some(format!("opening_balance:{migration_id}")),
    )
    .unwrap();
    entry.post().unwrap();
    posting_repo.post(&migration, &entry).await.unwrap();

    // Simulate a pre-guard record: residual classified into an ASSET account.
    let mut stored = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    stored.set_residual_classification(Some(ResidualClassification::RetainedEarnings), Some(asset));
    migration_repo.update(&stored).await.unwrap();

    let err = ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect_err("apply must refuse a misclassified residual target");
    assert!(err.to_string().contains("حقوق الملكية"), "unexpected error: {err}");

    // The migration stays Posted and un-applied.
    let after = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    assert_eq!(after.status, MigrationStatus::Posted);
    assert!(after.residual_applied_at.is_none());
}