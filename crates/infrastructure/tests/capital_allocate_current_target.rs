use std::str::FromStr;
use std::sync::Arc;

use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::currency::Currency;
use domain::shared::ids::{AccountId, PartnerId};
use domain::shared::monetary_amount::MonetaryAmount;
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::partner_repository::PartnerRepository;
use application::use_cases::equity::GetPartnerEquityStatementUseCase;
use application::use_cases::fiscal_period::GetDistributableProfitUseCase;
use application::use_cases::journal::ReverseJournalEntryUseCase;
use application::use_cases::opening_balance::{
    DistributeProfitCommand, AllocateNetProfitUseCase, ProfitDistributionSource,
    PreviewProfitDistributionCommand, PreviewProfitDistributionUseCase,
};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqliteOpeningMigrationRepository,
    SqlitePartnerRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
}

async fn lines_for(pool: &sqlx::SqlitePool, entry_id: &str) -> Vec<(String, Decimal, Decimal)> {
    sqlx::query_as::<_, (String, String, String)>(
        "SELECT account_id, debit_base, credit_base FROM journal_lines WHERE journal_entry_id = ?",
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .unwrap()
    .into_iter()
    .map(|(a, d, c)| {
        (
            a,
            Decimal::from_str(&d).unwrap_or_default(),
            Decimal::from_str(&c).unwrap_or_default(),
        )
    })
    .collect()
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_capalloc_test_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn parent_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

/// Creates a partner together with its capital, drawings and current accounts
/// via the production repository path, mirroring CreatePartnerUseCase.
async fn seed_partner_with_current(pool: &Arc<sqlx::SqlitePool>) -> PartnerId {
    let repo = SqlitePartnerRepository::new(pool.clone());

    let mut partner = Partner::new(
        "P2".to_string(),
        "شريك".to_string(),
        test_currency(),
        Decimal::ONE,
        Decimal::new(1000, 0),
        false,
        ProfitSharingType::BasedOnCapitalLocal,
        None,
    )
    .unwrap();

    let capital = Account::new(
        "519999".to_string(),
        "رأس مال".to_string(),
        "Capital".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "51").await),
        AccountCategory::Detail,
        4,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();
    let drawings = Account::new(
        "449999".to_string(),
        "مسحوبات".to_string(),
        "Drawings".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "44").await),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();
    let current = Account::new(
        "549999".to_string(),
        "حساب جاري".to_string(),
        "Current".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "54").await),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();

    partner.link_account(capital.id);
    partner.link_drawings_account(drawings.id);
    partner.link_current_account(current.id);
    repo.save_with_accounts(&partner, &capital, &drawings, Some(&current))
        .await
        .unwrap();
    partner.id
}

/// Inserts a Posted migration header row (schema from migrations 139/140).
async fn insert_posted_migration(pool: &sqlx::SqlitePool, id: &str) {
    insert_migration_with_status(pool, id, "Posted").await;
}

/// Inserts a migration header row with an explicit status.
async fn insert_migration_with_status(pool: &sqlx::SqlitePool, id: &str, status: &str) {
    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at)
         VALUES (?, datetime('now'), ?, NULL, datetime('now'), datetime('now'), datetime('now'))",
    )
    .bind(id)
    .bind(status)
    .execute(pool)
    .await
    .unwrap();
}

/// Posts a balanced journal crediting retained earnings (52) so a subsequent
/// allocation has available profit to distribute (Sec 7 cap guard).
async fn seed_retained_credit(pool: &Arc<sqlx::SqlitePool>, amount: Decimal) {
    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let retained = account_repo
        .find_by_code("52")
        .await
        .unwrap()
        .expect("retained earnings account");
    let contra = account_repo
        .find_by_code("519999")
        .await
        .unwrap()
        .expect("capital account");

    let c = test_currency();
    let mut entry = JournalEntry::new(
        uuid::Uuid::new_v4().to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(
                contra.id,
                MonetaryAmount::from_base(amount, c.clone()),
                MonetaryAmount::zero(c.clone()),
                "تغذية الأرباح المبقاة".to_string(),
            ),
            JournalLine::new(
                retained.id,
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::from_base(amount, c.clone()),
                "تغذية الأرباح المبقاة".to_string(),
            ),
        ],
        chrono::Utc::now(),
        "تغذية الأرباح المبقاة قبل التوزيع".to_string(),
        Some("cap_test_seed".to_string()),
    )
    .unwrap();
    entry.post().unwrap();
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    journal_repo.save(&entry).await.unwrap();
}

/// Feeds retained earnings from the opening-balance-equity control account (53)
/// instead of a partner capital account, so a full distribution + equity
/// statement can assert that partner capital stays untouched (Sec 10).
async fn seed_retained_from_obe(pool: &Arc<sqlx::SqlitePool>, amount: Decimal) {
    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let retained = account_repo.find_by_code("52").await.unwrap().expect("retained earnings account");
    let obe = account_repo.find_by_code("53").await.unwrap().expect("opening balance equity account");

    let c = test_currency();
    let mut entry = JournalEntry::new(
        uuid::Uuid::new_v4().to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(
                obe.id,
                MonetaryAmount::from_base(amount, c.clone()),
                MonetaryAmount::zero(c.clone()),
                "رصيد افتتاحي لمصدر الأرباح المبقاة".to_string(),
            ),
            JournalLine::new(
                retained.id,
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::from_base(amount, c.clone()),
                "تمييز الأرباح المبقاة".to_string(),
            ),
        ],
        chrono::Utc::now(),
        "تغذية الأرباح المبقاة من رصيد الافتتاح".to_string(),
        Some(format!("obe_seed_{}", uuid::Uuid::new_v4())),
    )
    .unwrap();
    entry.post().unwrap();
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    journal_repo.save(&entry).await.unwrap();
}

/// Creates a partner with a MANUAL profit-sharing ratio plus its capital,
/// drawings and current accounts (mirrors `seed_partner_with_current` with an
/// explicit ratio for the 60/40 partial-distribution scenarios).
async fn seed_partner_with_ratio(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    name: &str,
    ratio: Decimal,
    suffix: &str,
) -> PartnerId {
    let repo = SqlitePartnerRepository::new(pool.clone());

    let mut partner = Partner::new(
        code.to_string(),
        name.to_string(),
        test_currency(),
        Decimal::ONE,
        Decimal::new(100, 0),
        false,
        ProfitSharingType::Manual,
        Some(ratio),
    )
    .unwrap();

    let capital = Account::new(
        format!("51{suffix}").to_string(),
        format!("رأس مال {name}").to_string(),
        "Capital".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "51").await),
        AccountCategory::Detail,
        4,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();
    let drawings = Account::new(
        format!("44{suffix}").to_string(),
        format!("مسحوبات {name}").to_string(),
        "Drawings".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "44").await),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();
    let current = Account::new(
        format!("54{suffix}").to_string(),
        format!("حساب جاري {name}").to_string(),
        "Current".to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, "54").await),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap();

    partner.link_account(capital.id);
    partner.link_drawings_account(drawings.id);
    partner.link_current_account(current.id);
    repo.save_with_accounts(&partner, &capital, &drawings, Some(&current))
        .await
        .unwrap();
    partner.id
}

async fn new_allocate(pool: &Arc<sqlx::SqlitePool>) -> AllocateNetProfitUseCase {
    AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

/// Runs the distributable-profit projection over the opening window (from start
/// of time to the migration's cutover end-of-day) and returns (retained,
/// allocated_to_date, distributable).
async fn opening_distributable(pool: &Arc<sqlx::SqlitePool>) -> (Decimal, Decimal, Decimal) {
    let cutover: String =
        sqlx::query_scalar("SELECT cutover_date FROM opening_balance_migrations LIMIT 1")
            .fetch_one(pool.as_ref())
            .await
            .unwrap();
    let date = cutover.split(' ').next().unwrap().to_string();
    let uc = GetDistributableProfitUseCase::new(
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    let dto = uc
        .execute("1970-01-01T00:00:00Z".to_string(), format!("{date}T23:59:59Z"))
        .await
        .unwrap();
    (
        Decimal::from_str(&dto.retained_earnings_balance).unwrap(),
        Decimal::from_str(&dto.allocated_to_date).unwrap(),
        Decimal::from_str(&dto.distributable).unwrap(),
    )
}

async fn count_distribution_journals(pool: &sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_type = 'profit_distribution'")
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn allocation_credits_current_account_not_capital() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    // A distribution needs an available pool first (Sec 7 cap).
    seed_retained_credit(&pool, Decimal::from(600)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let current = account_repo
        .find_by_code("549999")
        .await
        .unwrap()
        .expect("current account");
    let capital = account_repo
        .find_by_code("519999")
        .await
        .unwrap()
        .expect("capital account");

    let allocate = AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        account_repo.clone(),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    let event_key = uuid::Uuid::new_v4().to_string();
    let result = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "500".to_string(),
            idempotency_key: event_key.clone(),
        })
        .await
        .expect("allocation must post");
    assert_eq!(result.allocated_total, Decimal::from(500));
    assert_eq!(result.shares.len(), 1);

    let entry_id: String = sqlx::query_scalar("SELECT id FROM journal_entries WHERE source_id = ?")
        .bind(format!("profit_distribution:{migration_id}:{event_key}"))
        .fetch_one(pool.as_ref())
        .await
        .unwrap();

    let lines = lines_for(pool.as_ref(), &entry_id).await;
    assert_eq!(lines.len(), 2, "allocation journal has 2 legs");

    for (account_id, debit, credit) in &lines {
        if account_id == &capital.id.0.to_string() {
            assert_eq!(*debit, Decimal::ZERO, "الربح يجب ألا يذهب إلى حساب رأس المال");
            assert_eq!(*credit, Decimal::ZERO, "الربح يجب ألا يذهب إلى حساب رأس المال");
        }
        if account_id == &current.id.0.to_string() {
            assert_eq!(*debit, Decimal::ZERO);
            assert_eq!(*credit, Decimal::from(500), "الربح يُضاف للحساب الجاري");
        }
    }

    // Re-running the same event key must resolve to the same distribution entry
    // (no second journal) — idempotency via the event source id.
    let rerun = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "500".to_string(),
            idempotency_key: event_key,
        })
        .await
        .unwrap();
    assert_eq!(rerun.entry_number, result.entry_number);
    assert_eq!(rerun.allocated_total, Decimal::from(500));
    assert!(rerun.posted);
}

#[tokio::test]
async fn equity_statement_profit_equals_current_balance() {
    let pool = build_pool().await;
    let partner_id = seed_partner_with_current(&pool).await;

    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let current = account_repo.find_by_code("549999").await.unwrap().expect("current account");
    let retained = account_repo.find_by_code("52").await.unwrap().expect("retained earnings");

// Feed the current account directly with a distribution-shaped entry.
    let c = test_currency();
    let mut entry = JournalEntry::new(
        "1".to_string(),
        JournalType::ProfitDistribution,
        vec![
            JournalLine::new(
                retained.id,
                MonetaryAmount::from_base(Decimal::from(300), c.clone()),
                MonetaryAmount::zero(c.clone()),
                "توزيع أرباح".to_string(),
            ),
            JournalLine::new(
                current.id,
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::from_base(Decimal::from(300), c.clone()),
                "توزيع أرباح".to_string(),
            ),
        ],
        chrono::Utc::now(),
        "توزيع أرباح".to_string(),
        Some("test_scope".to_string()),
    )
    .unwrap();
    entry.post().unwrap();
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    journal_repo.save(&entry).await.unwrap();

    let dto = GetPartnerEquityStatementUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        journal_repo,
    )
    .execute()
    .await
    .unwrap();

    let row = dto.rows.iter().find(|r| r.partner_id == partner_id.to_string()).expect("row");
    assert_eq!(row.current_balance, "300");
    assert_eq!(row.profit_allocated, row.current_balance);
    assert_eq!(row.ledger_balance, "0", "رأس المال غير متأثر بحركة الأرباح");
    assert_eq!(row.total_equity, "300", "خصم المسحوبات غير موجود بعد");
}

#[tokio::test]
async fn allocation_is_rejected_beyond_available() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    // Only 200 is available; the requested 500 must be rejected (Sec 7).
    seed_retained_credit(&pool, Decimal::from(200)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    let err = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "500".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .expect_err("distribution beyond the available pool must be rejected");
    assert!(
        err.to_string().contains("يتجاوز الأرباح المتاحة"),
        "unexpected error: {err}"
    );
    assert!(
        err.to_string().contains("بمقدار 300"),
        "the rejected error must state the over-amount: {err}"
    );
}

#[tokio::test]
async fn allocation_is_allowed_within_available() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    seed_retained_credit(&pool, Decimal::from(600)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    let result = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "400".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .expect("distribution within the available pool must post");
    assert_eq!(result.allocated_total, Decimal::from(400));
}

#[tokio::test]
async fn allocation_after_lock_is_allowed() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    seed_retained_credit(&pool, Decimal::from(600)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    // Locked — not just Posted — distribution must stay reachable (Sec 10).
    insert_migration_with_status(pool.as_ref(), &migration_id, "Locked").await;

    let allocate = AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    let event_key = uuid::Uuid::new_v4().to_string();
    let result = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "500".to_string(),
            idempotency_key: event_key.clone(),
        })
        .await
        .expect("allocation on a Locked migration must post");

    assert_eq!(result.allocated_total, Decimal::from(500));
    assert_eq!(result.shares.len(), 1);

    // Idempotency holds across the lock: a re-run with the same key resolves the
    // same journal.
    let rerun = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "500".to_string(),
            idempotency_key: event_key,
        })
        .await
        .unwrap();
    assert_eq!(rerun.entry_number, result.entry_number);
    assert_eq!(rerun.allocated_total, Decimal::from(500));
}

#[tokio::test]
async fn full_distribution_of_45_splits_27_and_18_and_touches_only_current() {
    let pool = build_pool().await;
    let ahmad = seed_partner_with_ratio(&pool, "A", "أحمد", Decimal::new(60, 0), "9999").await;
    let mohammad = seed_partner_with_ratio(&pool, "M", "محمد", Decimal::new(40, 0), "9998").await;
    seed_retained_from_obe(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = new_allocate(&pool).await;
    let res = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "45".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .unwrap();
    assert!(res.posted);
    assert_eq!(res.allocated_total, Decimal::new(45, 0));
    let a = res.shares.iter().find(|s| s.partner_id == ahmad.to_string()).unwrap();
    let m = res.shares.iter().find(|s| s.partner_id == mohammad.to_string()).unwrap();
    assert_eq!(a.share, Decimal::new(27, 0), "أحمد 60% من 45 = 27");
    assert_eq!(m.share, Decimal::new(18, 0), "محمد 40% من 45 = 18");

    // The accounting effect: retained 45 → 0, capital unchanged, currents credited.
    let (retained, allocated, remaining) = opening_distributable(&pool).await;
    assert_eq!(retained, Decimal::ZERO);
    assert_eq!(allocated, Decimal::new(45, 0));
    assert_eq!(remaining, Decimal::ZERO);

    let equity = GetPartnerEquityStatementUseCase::new(
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute()
    .await
    .unwrap();
    let arow = equity.rows.iter().find(|r| r.partner_id == ahmad.to_string()).unwrap();
    let mrow = equity.rows.iter().find(|r| r.partner_id == mohammad.to_string()).unwrap();
    assert_eq!(arow.current_balance, "27.00", "الحساب الجاري لأحمد يرتفع بمقدار نصيبه");
    assert_eq!(mrow.current_balance, "18.00", "الحساب الجاري لمحمد يرتفع بمقدار نصيبه");
    assert_eq!(arow.ledger_balance, "0", "رأس مال أحمد لا يتغير بالتوزيع (Sec 10)");
    assert_eq!(mrow.ledger_balance, "0", "رأس مال محمد لا يتغير بالتوزيع (Sec 10)");
}

#[tokio::test]
async fn partial_distribution_20_then_remaining_25() {
    let pool = build_pool().await;
    let _ = seed_partner_with_ratio(&pool, "A", "أحمد", Decimal::new(60, 0), "9999").await;
    let _ = seed_partner_with_ratio(&pool, "M", "محمد", Decimal::new(40, 0), "9998").await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = new_allocate(&pool).await;

    // Partial 20 → 12 / 8; remaining must stay visible (Sec 6).
    let first = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "20".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .unwrap();
    assert_eq!(first.allocated_total, Decimal::new(20, 0));
    let a = first.shares.iter().find(|s| s.partner_name == "أحمد").unwrap();
    let m = first.shares.iter().find(|s| s.partner_name == "محمد").unwrap();
    assert_eq!(a.share, Decimal::new(12, 0));
    assert_eq!(m.share, Decimal::new(8, 0));

    let (retained, allocated, remaining) = opening_distributable(&pool).await;
    assert_eq!(retained, Decimal::new(25, 0), "الرصيد المتبقي من الأرباح المبقاة");
    assert_eq!(allocated, Decimal::new(20, 0), "الموزع حتى الآن");
    assert_eq!(remaining, Decimal::new(25, 0), "المتبقي القابل للتوزيع = 45 − 20");

    // Second partial event (30 > 25 must fail) then the exact remaining 25 posts.
    let over = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "30".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .expect_err("30 exceeds the remaining 25 and must be rejected");
    assert!(over.to_string().contains("بمقدار 5"), "unexpected: {over}");

    let second = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "25".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .unwrap();
    assert_eq!(second.allocated_total, Decimal::new(25, 0));
    let a2 = second.shares.iter().find(|s| s.partner_name == "أحمد").unwrap();
    let m2 = second.shares.iter().find(|s| s.partner_name == "محمد").unwrap();
    assert_eq!(a2.share, Decimal::new(15, 0));
    assert_eq!(m2.share, Decimal::new(10, 0));

    let (retained, _allocated, remaining) = opening_distributable(&pool).await;
    assert_eq!(retained, Decimal::ZERO);
    assert_eq!(remaining, Decimal::ZERO, "لا يتبقى شيء بعد التوزيع الكامل");
}

#[tokio::test]
async fn zero_distribution_creates_no_journal() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = new_allocate(&pool).await;
    let res = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "0".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .unwrap();
    assert_eq!(res.entry_number, "", "لا قيد لأي توزيع صفري");
    assert!(!res.posted);
    assert_eq!(res.allocated_total, Decimal::ZERO);
    assert_eq!(count_distribution_journals(pool.as_ref()).await, 0, "لا يُنشأ قيد على الإطلاق");
}

#[tokio::test]
async fn same_idempotency_key_resolves_same_journal() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = new_allocate(&pool).await;
    let key = uuid::Uuid::new_v4().to_string();
    let a = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "20".to_string(),
            idempotency_key: key.clone(),
        })
        .await
        .unwrap();
    let b = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "20".to_string(),
            idempotency_key: key,
        })
        .await
        .unwrap();
    assert_eq!(a.entry_number, b.entry_number, "إعادة الإرسال بنفس المفتاح توائم نفس القيد");
    assert_eq!(count_distribution_journals(pool.as_ref()).await, 1, "لا يتكرر القيد");
}

#[tokio::test]
async fn preview_projects_without_posting() {
    let pool = build_pool().await;
    let _ = seed_partner_with_ratio(&pool, "A", "أحمد", Decimal::new(60, 0), "9999").await;
    let _ = seed_partner_with_ratio(&pool, "M", "محمد", Decimal::new(40, 0), "9998").await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let preview = PreviewProfitDistributionUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(PreviewProfitDistributionCommand {
        source: ProfitDistributionSource::OpeningMigration { migration_id },
        net_profit: "45".to_string(),
    })
    .await
    .unwrap();
    assert!(!preview.posted, "المعاينة لا تُرحّل أي شيء");
    assert_eq!(preview.entry_number, "");
    let a = preview.shares.iter().find(|s| s.partner_name == "أحمد").unwrap().share;
    let m = preview.shares.iter().find(|s| s.partner_name == "محمد").unwrap().share;
    assert_eq!(a, Decimal::new(27, 0));
    assert_eq!(m, Decimal::new(18, 0));
    assert_eq!(count_distribution_journals(pool.as_ref()).await, 0, "لا قيد بعد المعاينة");
}

#[tokio::test]
async fn reversing_a_distribution_restores_the_pool() {
    let pool = build_pool().await;
    let _ = seed_partner_with_ratio(&pool, "A", "أحمد", Decimal::new(60, 0), "9999").await;
    let _ = seed_partner_with_ratio(&pool, "M", "محمد", Decimal::new(40, 0), "9998").await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let allocate = new_allocate(&pool).await;
    let key = uuid::Uuid::new_v4().to_string();
    allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
            net_profit: "45".to_string(),
            idempotency_key: key.clone(),
        })
        .await
        .unwrap();

    let journal_id: String =
        sqlx::query_scalar("SELECT id FROM journal_entries WHERE source_id = ?")
            .bind(format!("profit_distribution:{migration_id}:{key}"))
            .fetch_one(pool.as_ref())
            .await
            .unwrap();

    // Reverse through the existing reversal mechanism (Sec 16) — never delete.
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    ReverseJournalEntryUseCase::new(journal_repo).execute(journal_id.clone()).await.unwrap();

    let (retained, allocated, remaining) = opening_distributable(&pool).await;
    assert_eq!(retained, Decimal::new(45, 0), "الأرباح المبقاة تُستعاد بالكامل بعد العكس");
    assert_eq!(allocated, Decimal::ZERO, "الموزع يعود للصفر بعد العكس");
    assert_eq!(remaining, Decimal::new(45, 0), "المتبقي القابل للتوزيع يُستعاد بعد العكس");

    // The reversed original stays in the archive (records are never deleted).
    let status: String = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
        .bind(&journal_id)
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(status, "Reversed", "الأصل يبقى موثّقاً بحالة معكوسة — لا يُحذف");
}

#[tokio::test]
async fn legacy_single_distribution_is_still_resolved() {
    let pool = build_pool().await;
    seed_partner_with_current(&pool).await;
    seed_retained_credit(&pool, Decimal::new(45, 0)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    // A distribution already posted with the legacy source key
    // `profit_distribution:{migration_id}` before this phase.
    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let current = account_repo.find_by_code("549999").await.unwrap().expect("current account");
    let retained = account_repo.find_by_code("52").await.unwrap().expect("retained earnings");
    let c = test_currency();
    let mut legacy = JournalEntry::new(
        uuid::Uuid::new_v4().to_string(),
        JournalType::ProfitDistribution,
        vec![
            JournalLine::new(retained.id, MonetaryAmount::from_base(Decimal::new(20, 0), c.clone()), MonetaryAmount::zero(c.clone()), "توزيع قديم".to_string()),
            JournalLine::new(current.id, MonetaryAmount::zero(c.clone()), MonetaryAmount::from_base(Decimal::new(20, 0), c.clone()), "توزيع قديم".to_string()),
        ],
        chrono::Utc::now(),
        "توزيع قديم".to_string(),
        Some(format!("profit_distribution:{migration_id}")),
    )
    .unwrap();
    legacy.post().unwrap();
    let journal_repo: Arc<dyn JournalEntryRepository> = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    journal_repo.save(&legacy).await.unwrap();

    // A new distribution request (any event key) resolves the legacy journal
    // instead of posting a duplicate against the same migration.
    let allocate = new_allocate(&pool).await;
    let res = allocate
        .execute(DistributeProfitCommand {
            source: ProfitDistributionSource::OpeningMigration { migration_id },
            net_profit: "20".to_string(),
            idempotency_key: uuid::Uuid::new_v4().to_string(),
        })
        .await
        .unwrap();
    assert_eq!(res.entry_number, legacy.entry_number);
    assert_eq!(res.allocated_total, Decimal::new(20, 0));
    assert_eq!(count_distribution_journals(pool.as_ref()).await, 1, "لا يتكرر التوزيع القديم");
}
