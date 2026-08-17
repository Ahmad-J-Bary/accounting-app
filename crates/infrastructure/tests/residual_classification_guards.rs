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
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, GetResidualClassificationSpecUseCase,
    LockOpeningBalanceUseCase, PostOpeningBalanceUseCase, SetResidualClassificationCommand,
    SetResidualClassificationUseCase,
};
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
    path.push(format!("acc_obclassify_test_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Seeds a custom account row under an existing parent code; returns the id.
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

/// Creates + approves + classifies (AUTO-MODE, no account supplied) + posts a
/// migration whose residual is a 30 credit on OBE (53): Asset 150 / Liab 50 /
/// Capital 70 → residual 30. Returns the migration id.
async fn post_migration_with_classification(
    pool: &Arc<sqlx::SqlitePool>,
    migration_repo: &Arc<dyn OpeningMigrationRepository>,
    account_repo: &Arc<dyn AccountRepository>,
    posting_repo: &Arc<dyn OpeningPostingRepository>,
    classification: &str,
) -> String {
    let asset = seed_account(pool.as_ref(), "1208", "أصول تجريبية", "Assets", "12").await;
    let liability = seed_account(pool.as_ref(), "2208", "خصوم تجريبية", "Liabilities", "22").await;
    let capital = seed_account(pool.as_ref(), "510001", "رأس مال تجريبي", "Equity", "51").await;
    let obe = account_id_by_code(pool.as_ref(), "53").await;

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
    migration_repo.update(&migration).await.unwrap();

    // Phase 4 auto-mode: the SYSTEM resolves the designated account for the
    // classification the user chose. Status is Approved (wizard Step 2 order).
    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: classification.into(),
            residual_account_id: None,
        })
        .await
        .unwrap();

    // Status guard then a well-formed opening journal, exactly as the
    // migration aggregate owns it (manual post, mirroring residual_apply.rs).
    let mut posted = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    posted.mark_posted().unwrap();
    migration_repo.update(&posted).await.unwrap();

    let mut entry = JournalEntry::new(
        format!("OB-CLASS-{}", &migration_id[..8]),
        JournalType::AccountOpeningBalance,
        vec![
            line(asset, dec!(150), dec!(0)),
            line(liability, dec!(0), dec!(50)),
            line(capital, dec!(0), dec!(70)),
            line(obe, dec!(0), dec!(30)),
        ],
        cutover,
        "قيد ترحيل رصيد افتتاح الشركة".to_string(),
        Some(format!("opening_balance:{}", migration_id)),
    )
    .unwrap();
    entry.post().unwrap();
    posting_repo.post(&posted, &entry).await.unwrap();

    migration_id
}

#[tokio::test]
async fn every_classification_auto_resolves_and_clears_obe_once() {
    for (key, expected_code, expected_purpose) in [
        ("RetainedEarnings", "52", "retained_earnings"),
        ("OpeningEquityAdjustment", "521", "opening_equity_adjustment"),
        ("PriorPeriodAdjustment", "525", "prior_period_adjustment"),
        ("OtherEquity", "526", "other_equity"),
    ] {
        let pool = build_pool().await;
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(SqliteAccountRepository::new(pool.clone()));
        let journal_repo: Arc<dyn JournalEntryRepository> =
            Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
        let posting_repo: Arc<dyn OpeningPostingRepository> =
            Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

        let migration_id = post_migration_with_classification(
            &pool, &migration_repo, &account_repo, &posting_repo, key,
        )
        .await;

        // Auto-mode resolved the designated account of the classification.
        let saved = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
        let desired = account_id_by_code(pool.as_ref(), expected_code).await;
        assert_eq!(
            saved.residual_account_id,
            Some(desired),
            "{key} must land on the {expected_code} designated account",
        );

        // Apply the reclassification → one residual journal; OBE 53 nets to zero.
        ApplyResidualToLedgerUseCase::new(
            migration_repo.clone(),
            account_repo.clone(),
            journal_repo.clone(),
            posting_repo.clone(),
        )
        .execute(migration_id.clone())
        .await
        .unwrap();

        let row_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
        )
        .bind(format!("residual_classification:{migration_id}"))
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        assert_eq!(row_count, 1, "{key}: exactly one reclassification journal");

        let obe = account_id_by_code(pool.as_ref(), "53").await;
        let obe_net: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL) - CAST(jl.credit_base AS REAL)), 0.0)
             FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
             WHERE jl.account_id = ? AND (je.source_id LIKE 'opening_balance:%' OR je.source_id LIKE 'residual_classification:%')",
        )
        .bind(obe.0.to_string())
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        assert_eq!(obe_net, 0.0, "{key}: OBE 53 must net to zero");

        // The residual is credited ONCE to the designated account.
        let credited: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(CAST(jl.credit_base AS REAL)), 0.0)
             FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
             WHERE jl.account_id = ? AND je.source_id = ?",
        )
        .bind(desired.0.to_string())
        .bind(format!("residual_classification:{migration_id}"))
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        assert_eq!(credited, 30.0, "{key}: designated account credited exactly once");

        let purpose_of_account: String = sqlx::query_scalar(
            "SELECT purpose FROM accounts WHERE id = ?",
        )
        .bind(desired.0.to_string())
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
        assert_eq!(purpose_of_account, expected_purpose, "{key} maps to its controlled purpose");
    }
}

#[tokio::test]
async fn spec_exposes_all_five_classifications_with_designated_accounts() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let specs = GetResidualClassificationSpecUseCase::new(account_repo)
        .execute()
        .await
        .unwrap();
    assert_eq!(specs.len(), 5);

    let by_key = |k: &str| specs.iter().find(|s| s.key == k).unwrap();

    let retained = by_key("RetainedEarnings");
    assert_eq!(retained.allowed_purposes, vec!["retained_earnings"]);
    assert!(retained.allows_posting);
    assert_eq!(retained.designated_account.as_ref().unwrap().code, "52");

    let prior = by_key("PriorPeriodAdjustment");
    assert!(prior.requires_confirmation);
    assert_eq!(prior.designated_account.as_ref().unwrap().code, "525");

    let unresolved = by_key("UnresolvedDifference");
    assert!(!unresolved.allows_posting);
    assert!(unresolved.allowed_purposes.is_empty());
    assert!(unresolved.designated_account.is_none());
}

#[tokio::test]
async fn unresolved_difference_blocks_posting_before_any_journal() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    let asset = seed_account(pool.as_ref(), "1208", "أصول تجريبية", "Assets", "12").await;
    let liability = seed_account(pool.as_ref(), "2208", "خصوم تجريبية", "Liabilities", "22").await;
    let capital = seed_account(pool.as_ref(), "510001", "رأس مال تجريبي", "Equity", "51").await;
    let obe = account_id_by_code(pool.as_ref(), "53").await;

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
    migration_repo.update(&migration).await.unwrap();

    // Classify as UnresolvedDifference (auto-mode, no account).
    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: "UnresolvedDifference".into(),
            residual_account_id: None,
        })
        .await
        .unwrap();

    // The real post use case rejects BEFORE reconciliation or any journaling.
    let err = PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .unwrap_err();
    assert!(
        err.to_string().contains("غير محلول"),
        "posting an unresolved residual must be blocked: {}",
        err
    );

    // Nothing was posted: no journal carries the migration's source id.
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ? OR source_id = ?",
    )
    .bind(format!("opening_balance:{migration_id}"))
    .bind(format!("residual_classification:{migration_id}"))
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(count, 0, "no ledger artifact may exist for an unresolved residual");
}

#[tokio::test]
async fn unresolved_difference_blocks_locking_even_after_posting() {
    let pool = build_pool().await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // Post normally with RetainedEarnings, then force an UnresolvedDifference
    // re-classification (a direct-API defensive scenario — the wizard would
    // never produce it) — the lock gate must still refuse.
    let migration_id = post_migration_with_classification(
        &pool, &migration_repo, &account_repo, &posting_repo, "RetainedEarnings",
    )
    .await;

    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: "UnresolvedDifference".into(),
            residual_account_id: None,
        })
        .await
        .unwrap();

    let err = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .unwrap_err();
    assert!(
        err.to_string().contains("غير محلول"),
        "locking with an unresolved residual must be blocked: {}",
        err
    );

    let reloaded = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    assert_eq!(reloaded.status, MigrationStatus::Posted, "migration stays posted");
}