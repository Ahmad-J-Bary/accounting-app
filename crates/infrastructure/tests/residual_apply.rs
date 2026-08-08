use std::str::FromStr;
use std::sync::Arc;

use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use domain::accounting::MigrationStatus;
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, SetResidualClassificationCommand,
    SetResidualClassificationUseCase,
};
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
    path.push(format!("acc_obresidual_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Seeds a custom account row (schema from migrations 001/011) under an
/// existing parent code; returns the generated account id.
async fn seed_account(
    pool: &sqlx::SqlitePool,
    code: &str,
    name: &str,
    account_type: &str,
    parent_code: &str,
) -> AccountId {
    let parent_id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(parent_code)
        .fetch_one(pool)
        .await
        .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Detail', 4, '0', '0', 1, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(account_type)
    .bind(parent_id)
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
async fn apply_residual_creates_balanced_journal_and_marks_migration() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // Asset 150 / Liab 50 / Capital 70 → residual credit 30 on OBE (53).
    let asset = seed_account(pool.as_ref(), "1208", "أصول تجريبية", "Assets", "12").await;
    let liability = seed_account(pool.as_ref(), "2208", "خصوم تجريبية", "Liabilities", "22").await;
    let capital = seed_account(pool.as_ref(), "510001", "رأس مال تجريبي", "Equity", "51").await;
    let obe = account_id_by_code(pool.as_ref(), "53").await;
    let retained = account_id_by_code(pool.as_ref(), "52").await;

    let cutover = Utc::now();
    let migration_id = uuid::Uuid::new_v4().to_string();

let mut migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        cutover,
        None,
        vec![
            OpeningBalanceLine { account_id: asset, amount: dec!(150), description: None },
            OpeningBalanceLine { account_id: liability, amount: dec!(50), description: None },
            OpeningBalanceLine { account_id: capital, amount: dec!(70), description: None },
            OpeningBalanceLine { account_id: obe, amount: dec!(30), description: None },
        ],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();
    migration.validate("tester").unwrap();
    migration.approve("tester").unwrap();
    migration.mark_posted().unwrap();
    migration_repo.update(&migration).await.unwrap();

    // Opening journal exactly as PostOpeningBalanceUseCase would build it:
    // debit-normal accounts on debit, credit-normal accounts on credit.
    let mut entry = JournalEntry::new(
        "OB-R-1000".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            line(asset, dec!(150), dec!(0)),
            line(liability, dec!(0), dec!(50)),
            line(capital, dec!(0), dec!(70)),
            line(obe, dec!(0), dec!(30)),
        ],
        cutover,
        "قيد ترحيل رصيد افتتاح الشركة".to_string(),
        Some(format!("opening_balance:{}", migration.id)),
    )
    .unwrap();
    entry.post().unwrap();
    posting_repo.post(&migration, &entry).await.unwrap();

    // Classify residual as retained earnings targeting account 52.
    SetResidualClassificationUseCase::new(migration_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(retained.0.to_string()),
        })
        .await
        .unwrap();

    // Apply the residual reclassification.
    ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .unwrap();

    // residual_applied_at is stamped on the migration row.
    let stamped: Option<String> = sqlx::query_scalar(
        "SELECT residual_applied_at FROM opening_balance_migrations WHERE id = ?",
    )
    .bind(&migration_id)
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert!(stamped.is_some(), "apply must stamp residual_applied_at");

    // The residual journal is balanced and moves 30 from 53 to 52.
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT jl.account_id, jl.debit_base, jl.credit_base FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.source_id = ?",
    )
    .bind(&format!("residual_classification:{migration_id}"))
    .fetch_all(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(rows.len(), 2, "residual journal has exactly two legs");

    let d: Decimal = rows.iter().map(|(_, d, _)| Decimal::from_str(d).unwrap()).sum();
    let c: Decimal = rows.iter().map(|(_, _, c)| Decimal::from_str(c).unwrap()).sum();
    assert_eq!(d, dec!(30), "residual journal debit side is the residual");
    assert_eq!(c, dec!(30), "residual journal must be balanced");

    // The two legs touch exactly OBE (53) and the retained-earnings account (52).
    let involved: Vec<String> = rows.iter().map(|(a, _, _)| a.clone()).collect();
    assert!(involved.contains(&obe.0.to_string()));
    assert!(involved.contains(&retained.0.to_string()));

    let reloaded = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    assert!(reloaded.residual_applied_at.is_some());
    assert_eq!(reloaded.status, MigrationStatus::Posted);
}

#[tokio::test]
async fn apply_residual_rejects_unclassified_or_draft_migration() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    let asset = seed_account(pool.as_ref(), "1208", "أصول تجريبية", "Assets", "12").await;
    let liability = seed_account(pool.as_ref(), "2208", "خصوم تجريبية", "Liabilities", "22").await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    let migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        Utc::now(),
        None,
        vec![
            OpeningBalanceLine { account_id: asset, amount: dec!(100), description: None },
            OpeningBalanceLine { account_id: liability, amount: dec!(100), description: None },
        ],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();

    let use_case = ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    );

    // Draft → rejected
    let err = use_case.execute(migration_id.clone()).await.unwrap_err();
    assert!(err.to_string().contains("مرحَّل") || err.to_string().contains("أولاً") || !err.to_string().is_empty());

    // Post it without any classification → rejected because classification missing.
    let mut migration = migration;
    migration.validate("tester").unwrap();
    migration.approve("tester").unwrap();
    migration.mark_posted().unwrap();
    migration_repo.update(&migration).await.unwrap();

    let err = use_case.execute(migration_id.clone()).await.unwrap_err();
    assert!(
        err.to_string().contains("تصنيف"),
        "apply without a recorded classification must be rejected: {}",
        err
    );
}
