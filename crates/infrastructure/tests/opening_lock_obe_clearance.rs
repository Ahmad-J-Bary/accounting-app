//! Company-lifecycle audit findings B4 and D1 regression tests:
//!
//! * A posted migration whose Opening Balance Equity (53) is still non-zero
//!   cannot be locked; the rejected attempt must leave the migration `Posted`
//!   (gate runs before the domain transition).
//! * After the residual reclassification journal is applied the control nets to
//!   zero and the lock succeeds; the account 53 ledger position is then zero
//!   across the whole journal (post-lock presentation shows no residual).

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_item_repository::OpeningItemRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, LockOpeningBalanceUseCase, SetResidualClassificationCommand,
    SetResidualClassificationUseCase,
};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use domain::accounting::MigrationStatus;
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqliteOpeningItemRepository,
    SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_oblock_obe_test_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
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

/// Net debit (`debit − credit`) of an account across every posted journal in the
/// whole ledger — the figure a trial balance / balance sheet would present.
async fn ledger_account_net(
    journal_repo: &Arc<dyn JournalEntryRepository>,
    account_id: AccountId,
) -> Decimal {
    let mut net = Decimal::ZERO;
    for entry in journal_repo.list_all().await.unwrap() {
        if entry.status != domain::accounting::JournalEntryStatus::Posted {
            continue;
        }
        for l in &entry.lines {
            if l.account_id == account_id {
                net += l.debit.base_amount - l.credit.base_amount;
            }
        }
    }
    net
}

async fn setup_migration_with_obe(
    pool: &Arc<sqlx::SqlitePool>,
) -> (
    String,
    Arc<dyn OpeningMigrationRepository>,
    Arc<dyn AccountRepository>,
    Arc<dyn JournalEntryRepository>,
    Arc<dyn OpeningPostingRepository>,
) {
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // Asset 150 / Liab 50 / Capital 55 / OBE 45 (credit residual plug).
    let asset = seed_account(pool.as_ref(), "1211", "أصل", "Assets", "12").await;
    let liability = seed_account(pool.as_ref(), "2211", "التزام", "Liabilities", "22").await;
    let capital = seed_account(pool.as_ref(), "519997", "رأس مال", "Equity", "51").await;
    let obe = account_id_by_code(pool.as_ref(), "53").await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    let mut migration = OpeningBalanceMigration::new(
        migration_id.clone(),
        chrono::Utc::now(),
        None,
        vec![
            OpeningBalanceLine {
                account_id: asset,
                amount: dec!(150),
                description: None,
            },
            OpeningBalanceLine {
                account_id: liability,
                amount: dec!(50),
                description: None,
            },
            OpeningBalanceLine {
                account_id: capital,
                amount: dec!(55),
                description: None,
            },
            OpeningBalanceLine {
                account_id: obe,
                amount: dec!(45),
                description: None,
            },
        ],
    )
    .unwrap();
    migration_repo.create(&migration).await.unwrap();
    migration.validate("t").unwrap();
    migration.approve("t").unwrap();
    migration.mark_posted().unwrap();
    migration_repo.update(&migration).await.unwrap();

    let mut entry = JournalEntry::new(
        "OBP-LOCK-1".to_string(),
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

    (
        migration_id,
        migration_repo,
        account_repo,
        journal_repo,
        posting_repo,
    )
}

#[tokio::test]
async fn lock_rejected_when_obe_nonzero_and_migration_stays_posted() {
    let pool = build_pool().await;
    let (migration_id, migration_repo, account_repo, journal_repo, _posting) =
        setup_migration_with_obe(&pool).await;
    let item_repo: Arc<dyn OpeningItemRepository> =
        Arc::new(SqliteOpeningItemRepository::new(pool.clone()));

    // 53 still carries the un-applied residual (45), so the lock gate must fail…
    let err = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo,
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect_err("locking with non-zero OBE must be rejected");
    assert!(err.to_string().contains("53"), "unexpected error: {err}");

    // …and the rejected attempt must NOT mutate the aggregate (B4 ordering).
    let after = migration_repo
        .find_by_id(&migration_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        after.status,
        MigrationStatus::Posted,
        "failed lock must leave migration Posted"
    );
    assert!(after.locked_at.is_none());
}

#[tokio::test]
async fn lock_succeeds_after_residual_and_obe_nets_zero() {
    let pool = build_pool().await;
    let (migration_id, migration_repo, account_repo, journal_repo, posting_repo) =
        setup_migration_with_obe(&pool).await;
    let item_repo: Arc<dyn OpeningItemRepository> =
        Arc::new(SqliteOpeningItemRepository::new(pool.clone()));

    let retained = account_id_by_code(pool.as_ref(), "52").await;
    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(retained.0.to_string()),
        })
        .await
        .unwrap();
    ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .unwrap();

    let locked = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo,
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("lock succeeds once 53 is cleared");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    // The whole-ledger position of account 53 nets to zero: the residual
    // journal's OBE leg cancels the posting journal's OBE leg (D1).
    let obe = account_id_by_code(pool.as_ref(), "53").await;
    let net = ledger_account_net(&journal_repo, obe).await;
    assert_eq!(net, Decimal::ZERO, "post-lock 53 must present as zero");

    let after = migration_repo
        .find_by_id(&migration_id)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(after.status, MigrationStatus::Locked);
    assert!(after.residual_applied_at.is_some());
}
