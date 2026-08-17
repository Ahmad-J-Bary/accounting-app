//! Phase 5 — financial-reporting integrity.
//!
//! All reports read from ONE authoritative GL source: the posted journal
//! lines. This suite pins the invariants that make the reports trustworthy:
//!
//!   EXACT OPENING + RESIDUAL — Assets 150 / Liabilities 50 / Capital 70 /
//!   prior residual 30 on OBE (53). After the residual reclassification the
//!   designated account is credited exactly once, OBE nets to zero, the trial
//!   balance keeps equal Debit/Credit totals, and the balance sheet invariant
//!   A = L + E holds (150 = 50 + 100).
//!
//!   REVERSAL NEUTRALITY — reversing a posted journal removes BOTH sides from
//!   the backend GL (`get_ledger` surfaces neither the original nor its contra
//!   journal), while the posted report feed still carries the Reversal row —
//!   the contract that the frontend `computeLedgerTotals` mirrors by dropping
//!   `reversal_of_entry_id` rows, keeping reports consistent with the ledger.

use std::str::FromStr;
use std::sync::Arc;

use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::opening_balance::{OpeningBalanceLine, OpeningBalanceMigration};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use application::dto::journal_entry_dto::{CreateJournalEntryRequest, JournalLineDto};
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::use_cases::journal::{CreateJournalEntryUseCase, ListJournalEntriesUseCase, PostJournalEntryUseCase, ReverseJournalEntryUseCase};
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, SetResidualClassificationCommand, SetResidualClassificationUseCase,
};
use application::use_cases::account::AccountQueries;
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
    path.push(format!("acc_phase5_report_{}.sqlite", uuid::Uuid::new_v4()));
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

/// net = SUM(debit_base) - SUM(credit_base) for the account across posted lines.
async fn net_of(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let net: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL) - CAST(jl.credit_base AS REAL)), 0.0)
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ? AND je.status = 'Posted'",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::from_f64_retain(net).unwrap_or(Decimal::ZERO)
}

// ---------------------------------------------------------------------------
// 1. EXACT OPENING + RESIDUAL — with Accounts 150 / Liabs 50 / Capital 70 /
//    residual 30 on OBE (53), classified RetainedEarnings (auto → 52). The
//    posted opening journal plus the single reclassification journal produce:
//    TB Debit == Credit, FA/asset amount appears once, residual once on 52,
//    OBE nets to zero, and A = L + E exactly.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn exact_opening_with_residual_is_balanced_and_appears_once() {
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

    // Auto-mode classification: RetainedEarnings → designated account 52.
    SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
        .execute(SetResidualClassificationCommand {
            migration_id: migration_id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: None,
        })
        .await
        .unwrap();

    let mut posted = migration_repo.find_by_id(&migration_id).await.unwrap().unwrap();
    posted.mark_posted().unwrap();
    migration_repo.update(&posted).await.unwrap();

    let mut entry = JournalEntry::new(
        format!("OB-P5-{}", &migration_id[..8]),
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

    // The single residual reclassification journal (Dr OBE / Cr 52).
    ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .unwrap();

    let residual_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("residual_classification:{migration_id}"))
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(residual_count, 1, "exactly one residual reclassification journal");

    // Trial balance: total Debit == total Credit across all posted lines.
    let (total_dr, total_cr): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL)), 0.0),
                COALESCE(SUM(CAST(jl.credit_base AS REAL)), 0.0)
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.status = 'Posted'",
    )
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(Decimal::from_f64_retain(total_dr).unwrap(), Decimal::from_f64_retain(total_cr).unwrap());

    // Balance sheet invariant A = L + E on the posted GL nets.
    let asset_net = net_of(pool.as_ref(), &asset).await;
    assert_eq!(asset_net, dec!(150), "asset appears once (150)");
    let liab_net = -net_of(pool.as_ref(), &liability).await;
    let capital_net = -net_of(pool.as_ref(), &capital).await;
    let obe_net = -net_of(pool.as_ref(), &obe).await;
    assert_eq!(obe_net, dec!(0), "OBE 53 nets to zero after reclassification");

    let residual = account_id_by_code(pool.as_ref(), "52").await;
    let residual_net = -net_of(pool.as_ref(), &residual).await;
    assert_eq!(residual_net, dec!(30), "designated account credited exactly once");

    let equity = capital_net + obe_net + residual_net;
    assert_eq!(asset_net, liab_net + equity, "A = L + E must hold exactly (150 = 50 + 100)");
}

// ---------------------------------------------------------------------------
// 2. REVERSAL NEUTRALITY — a reversed entry must not move the GL: the backend
//    ledger surfaces neither side of the pair, while the posted report feed
//    carries exactly the Reversal contra row (`reversal_of_entry_id` set) —
//    the contract the frontend `computeLedgerTotals` mirrors.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn reversed_entry_is_neutral_in_ledger_and_feed_carries_only_the_contra() {
    let pool = build_pool().await;
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));

    let asset = seed_account(pool.as_ref(), "1209", "نقد تجريبي", "Assets", "12").await;
    let equity = seed_account(pool.as_ref(), "510002", "رأس مال تجريبي2", "Equity", "51").await;

    let create = CreateJournalEntryUseCase::new(journal_repo.clone());
    let dto = create
        .execute(CreateJournalEntryRequest {
            entry_number: "0".into(),
            journal_type: JournalType::GeneralJournal,
            source_id: None,
            lines: vec![
                JournalLineDto {
                    account_id: asset.to_string(),
                    account_code: None,
                    account_name: None,
                    account_purpose: None,
                    partner_id: None,
                    currency: "BASE".into(),
                    fx_rate: "1".into(),
                    debit: "100".into(),
                    credit: "0".into(),
                    debit_base: Some("100".into()),
                    credit_base: None,
                    description: "قيد تجريبي".into(),
                },
                JournalLineDto {
                    account_id: equity.to_string(),
                    account_code: None,
                    account_name: None,
                    account_purpose: None,
                    partner_id: None,
                    currency: "BASE".into(),
                    fx_rate: "1".into(),
                    debit: "0".into(),
                    credit: "100".into(),
                    debit_base: None,
                    credit_base: Some("100".into()),
                    description: "قيد تجريبي".into(),
                },
            ],
            entry_date: Utc::now().to_rfc3339(),
            description: "قيد تجريبي".into(),
        })
        .await
        .unwrap();
    let entry_id = dto.id;

    PostJournalEntryUseCase::new(journal_repo.clone())
        .execute(entry_id.clone())
        .await
        .unwrap();

    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());
    let before = queries.get_ledger(&[asset]).await.unwrap();
    assert_eq!(before.lines.len(), 1, "before reversal the ledger has one line");
    assert_eq!(before.closing_balance_base, dec!(100));

    // Reverse → the original flips to Reversed, a Posted contra lands in the feed.
    let reversal = ReverseJournalEntryUseCase::new(journal_repo.clone())
        .execute(entry_id.clone())
        .await
        .unwrap();
    assert_eq!(reversal.reversal_of_entry_id.as_deref(), Some(entry_id.as_str()));

    let after = queries.get_ledger(&[asset]).await.unwrap();
    assert_eq!(after.lines.len(), 0, "the ledger surfaces NEITHER side of the pair");
    assert_eq!(after.closing_balance_base, dec!(0), "reversal is mathematically neutral");

    // The posted report feed carries ONLY the Reversal contra row (the original
    // is Reversed and not Posted). The frontend `computeLedgerTotals` drops any
    // entry with `reversal_of_entry_id` set, so reports stay consistent with
    // the backend ledger.
    let feed = ListJournalEntriesUseCase::new(journal_repo.clone(), account_repo.clone())
        .execute_posted(None, None, None, None)
        .await
        .unwrap();
    assert_eq!(feed.len(), 1, "only the Reversal contra reaches the report feed");
    assert_eq!(feed[0].journal_type, JournalType::Reversal);
    assert_eq!(feed[0].reversal_of_entry_id.as_deref(), Some(entry_id.as_str()));
}