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
use application::use_cases::opening_balance::{
    AllocateNetProfitUseCase, DistributeProfitCommand, ProfitDistributionSource,
};
use application::use_cases::partner::{
    CreateCapitalContributionUseCase, CreatePartnerDrawingUseCase,
};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteFiscalPeriodRepository, SqliteJournalEntryRepository, SqliteOpeningMigrationRepository,
    SqlitePartnerRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
}

/// Net credit−debit ledger balance of one account straight from SQL lines
/// (Posted/Reversed journals only) — the ground truth the statement must map.
async fn sql_net_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT jl.credit_base, jl.debit_base
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ? AND je.status != 'Draft'",
    )
    .bind(account_id.0.to_string())
    .fetch_all(pool)
    .await
    .unwrap();
    let mut net = Decimal::ZERO;
    for (c, d) in rows {
        net += Decimal::from_str(&c).unwrap_or_default()
            - Decimal::from_str(&d).unwrap_or_default();
    }
    net
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_equity_reconcile_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn new_account(pool: &Arc<sqlx::SqlitePool>, code: &str, name: &str, parent: &str) -> Account {
    Account::new(
        code.to_string(),
        name.to_string(),
        name.to_string(),
        AccountType::Equity,
        Some(parent_id_by_code(pool, parent).await),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap()
}

/// Real partner with capital / drawings / current accounts, persisted through
/// the production repository path.
async fn seed_partner(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    capital_code: &str,
    drawings_code: &str,
    current_code: &str,
    registered_capital: Decimal,
) -> (PartnerId, AccountId, AccountId, AccountId) {
    let repo = SqlitePartnerRepository::new(pool.clone());
    let mut partner = Partner::new(
        code.to_string(),
        format!("شريك {code}"),
        test_currency(),
        Decimal::ONE,
        registered_capital,
        false,
        ProfitSharingType::BasedOnCapitalLocal,
        None,
        None,
    )
    .unwrap();
    let capital = new_account(pool, capital_code, "رأس مال", "51").await;
    let drawings = new_account(pool, drawings_code, "مسحوبات", "44").await;
    let current = new_account(pool, current_code, "حساب جاري", "54").await;
    partner.link_account(capital.id);
    partner.link_drawings_account(drawings.id);
    partner.link_current_account(current.id);
    repo.save_with_accounts(&partner, &capital, &drawings, Some(&current))
        .await
        .unwrap();
    (partner.id, capital.id, drawings.id, current.id)
}

async fn insert_posted_migration(pool: &sqlx::SqlitePool, id: &str) {
    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at)
         VALUES (?, datetime('now'), 'Posted', NULL, datetime('now'), datetime('now'), datetime('now'))",
    )
    .bind(id)
    .execute(pool)
    .await
    .unwrap();
}

/// The per-partner equity row must reconcile line-by-line with the partner's
/// capital / current / drawings ledgers, and a drawing must REDUCE total
/// equity (contra-equity), never increase it.
#[tokio::test]
async fn equity_statement_reconciles_with_partner_ledgers() {
    let pool = build_pool().await;

    let (a_id, a_capital, a_drawings, a_current) =
        seed_partner(&pool, "P1", "519911", "449911", "549911", Decimal::from(1000)).await;
    let (b_id, b_capital, b_drawings, b_current) =
        seed_partner(&pool, "P2", "519912", "449912", "549912", Decimal::from(3000)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let cash = new_account(&pool, "1201", "نقدية", "12").await;
    account_repo.save(&cash).await.unwrap();
    let partner_repo: Arc<dyn PartnerRepository> = Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    // Feed retained earnings from the opening-balance-equity control account (53)
    // so the 600 distribution has an available pool (Sec 7) while partner capital
    // stays untouched (Sec 10).
    let retained = account_repo.find_by_code("52").await.unwrap().expect("retained earnings account");
    let obe = account_repo.find_by_code("53").await.unwrap().expect("opening balance equity account");
    let c = test_currency();
    let mut seed = JournalEntry::new(
        uuid::Uuid::new_v4().to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(obe.id, MonetaryAmount::from_base(Decimal::from(600), c.clone()), MonetaryAmount::zero(c.clone()), "رصيد افتتاحي".to_string()),
            JournalLine::new(retained.id, MonetaryAmount::zero(c.clone()), MonetaryAmount::from_base(Decimal::from(600), c.clone()), "تمييز الأرباح المبقاة".to_string()),
        ],
        chrono::Utc::now(),
        "تغذية الأرباح المبقاة من رصيد الافتتاح".to_string(),
        Some(format!("equity_gl_seed_{}", uuid::Uuid::new_v4())),
    )
    .unwrap();
    seed.post().unwrap();
    journal_repo.save(&seed).await.unwrap();

    // Opening sequence: profit allocation runs while the migration is still
    // Posted (pre-lock), then the migration is sealed (Locked) before any
    // operational capital/drawing event is posted — the gate forbids normal
    // journals while an unsealed migration exists.
    AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        partner_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        Arc::new(SqliteFiscalPeriodRepository::new(pool.clone())),
    )
    .execute(DistributeProfitCommand {
        source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
        net_profit: "600".to_string(),
        idempotency_key: uuid::Uuid::new_v4().to_string(),
    })
    .await
    .unwrap();
    sqlx::query("UPDATE opening_balance_migrations SET status = 'Locked', locked_at = datetime('now') WHERE id = ?")
        .bind(&migration_id)
        .execute(pool.as_ref())
        .await
        .unwrap();

    // two explicit contributions feed both capital ledgers
    let contrib_a = 200;
    let contrib_b = 400;
    CreateCapitalContributionUseCase::new(partner_repo.clone(), account_repo.clone(), journal_repo.clone(), Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())))
        .execute(a_id.to_string(), cash.id.0.to_string(), Decimal::from(contrib_a), false, Some("rec-a".into()))
        .await
        .unwrap();
    CreateCapitalContributionUseCase::new(partner_repo.clone(), account_repo.clone(), journal_repo.clone(), Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())))
        .execute(b_id.to_string(), cash.id.0.to_string(), Decimal::from(contrib_b), false, Some("rec-b".into()))
        .await
        .unwrap();

    // One partner draws out — this is contra-equity and must REDUCE equity.
    CreatePartnerDrawingUseCase::new(partner_repo.clone(), account_repo.clone(), journal_repo.clone())
        .execute(a_id.to_string(), cash.id.0.to_string(), Decimal::from(90), None, None, Some("rec-draw".into()))
        .await
        .unwrap();

    let dto = GetPartnerEquityStatementUseCase::new(partner_repo, journal_repo)
        .execute(None, None)
        .await
        .unwrap();

    let row_a = dto.rows.iter().find(|r| r.partner_id == a_id.to_string()).expect("row a");
    let row_b = dto.rows.iter().find(|r| r.partner_id == b_id.to_string()).expect("row b");

    // Ground truth from SQL: equity = capital net + current (profit) net +
    // drawings (signed; negative for debit-normal drawings). The statement must
    // equal it exactly.
    let cap_a = sql_net_balance(&pool, &a_capital).await;
    let cur_a = sql_net_balance(&pool, &a_current).await;
    let drw_a = sql_net_balance(&pool, &a_drawings).await; // negative (debits)
    let expected_a = cap_a + cur_a + drw_a;

    let cap_b = sql_net_balance(&pool, &b_capital).await;
    let cur_b = sql_net_balance(&pool, &b_current).await;
    let drw_b = sql_net_balance(&pool, &b_drawings).await;

    assert_eq!(Decimal::from_str(&row_a.total_equity).unwrap(), expected_a);
    assert_eq!(Decimal::from_str(&row_b.total_equity).unwrap(), cap_b + cur_b + drw_b);

    // The drawings leg is a debit, so net_balance for the drawings account is
    // negative and equity must be SMALLER than without the drawing.
    assert!(expected_a < cap_a + cur_a, "drawings must reduce equity");

    // Registered capital must stay untouched by all events above (master data).
    assert_eq!(Decimal::from_str(&row_a.capital_registered).unwrap(), Decimal::from(1000));
    assert_eq!(Decimal::from_str(&row_b.capital_registered).unwrap(), Decimal::from(3000));

    // profit_allocated == current account balance on the ledger (Sec 13).
    assert_eq!(Decimal::from_str(&row_a.profit_allocated).unwrap(), cur_a);
    assert_eq!(Decimal::from_str(&row_b.profit_allocated).unwrap(), cur_b);

    // loss_allocated exposes the debit leg separately: no losses were
    // allocated in this run, so it must be zero (and distinct from profit).
    let loss_a: Decimal = Decimal::from_str(&row_a.loss_allocated).unwrap();
    let loss_b: Decimal = Decimal::from_str(&row_b.loss_allocated).unwrap();
    assert_eq!(loss_a, Decimal::ZERO);
    assert_eq!(loss_b, Decimal::ZERO);
    // profit − loss restores the net current balance used by total_equity.
    assert_eq!(Decimal::from_str(&row_a.profit_allocated).unwrap() - loss_a, cur_a);
    assert_eq!(Decimal::from_str(&row_b.profit_allocated).unwrap() - loss_b, cur_b);
}

/// Date-range filtering must return the same equity totals when no entries
/// fall outside the range (all entries are within the range).
#[tokio::test]
async fn equity_statement_date_range_filtering() {
    let pool = build_pool().await;

    let (a_id, _a_capital, _a_drawings, _a_current) =
        seed_partner(&pool, "P1", "518811", "448811", "548811", Decimal::from(1000)).await;

    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_posted_migration(pool.as_ref(), &migration_id).await;

    let account_repo: Arc<dyn AccountRepository> = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let cash = new_account(&pool, "1201", "نقدية", "12").await;
    account_repo.save(&cash).await.unwrap();
    let partner_repo: Arc<dyn PartnerRepository> = Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    // Seed retained earnings + profit allocation
    let retained = account_repo.find_by_code("52").await.unwrap().expect("retained earnings");
    let obe = account_repo.find_by_code("53").await.unwrap().expect("opening balance equity");
    let c = test_currency();
    let mut seed = JournalEntry::new(
        uuid::Uuid::new_v4().to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(obe.id, MonetaryAmount::from_base(Decimal::from(300), c.clone()), MonetaryAmount::zero(c.clone()), "تغذية".to_string()),
            JournalLine::new(retained.id, MonetaryAmount::zero(c.clone()), MonetaryAmount::from_base(Decimal::from(300), c.clone()), "تمييز".to_string()),
        ],
        chrono::Utc::now(),
        "تغذية الأرباح المبقاة".to_string(),
        Some(format!("dr_seed_{}", uuid::Uuid::new_v4())),
    )
    .unwrap();
    seed.post().unwrap();
    journal_repo.save(&seed).await.unwrap();

    AllocateNetProfitUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        partner_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        Arc::new(SqliteFiscalPeriodRepository::new(pool.clone())),
    )
    .execute(DistributeProfitCommand {
        source: ProfitDistributionSource::OpeningMigration { migration_id: migration_id.clone() },
        net_profit: "300".to_string(),
        idempotency_key: uuid::Uuid::new_v4().to_string(),
    })
    .await
    .unwrap();
    sqlx::query("UPDATE opening_balance_migrations SET status = 'Locked', locked_at = datetime('now') WHERE id = ?")
        .bind(&migration_id)
        .execute(pool.as_ref())
        .await
        .unwrap();

    // Capital contribution
    CreateCapitalContributionUseCase::new(
        partner_repo.clone(), account_repo.clone(), journal_repo.clone(),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    )
    .execute(a_id.to_string(), cash.id.0.to_string(), Decimal::from(500), false, Some("dr-contrib".into()))
    .await
    .unwrap();

    // Full-range statement (no date filter) — baseline
    let full = GetPartnerEquityStatementUseCase::new(partner_repo.clone(), journal_repo.clone())
        .execute(None, None)
        .await
        .unwrap();

    // Wide date range that covers all entries — should match baseline
    let wide_from = chrono::Utc::now() - chrono::Duration::days(365);
    let wide_to = chrono::Utc::now() + chrono::Duration::days(1);
    let wide = GetPartnerEquityStatementUseCase::new(partner_repo.clone(), journal_repo.clone())
        .execute(Some(wide_from), Some(wide_to))
        .await
        .unwrap();

    assert_eq!(full.rows.len(), wide.rows.len(), "same partner count");
    for (full_row, wide_row) in full.rows.iter().zip(wide.rows.iter()) {
        assert_eq!(full_row.partner_id, wide_row.partner_id);
        assert_eq!(full_row.total_equity, wide_row.total_equity,
            "wide range must match full for {}", full_row.partner_name);
    }

    // Narrow range that excludes everything — should have zero period figures
    // but still show accumulated balances
    let narrow_from = chrono::Utc::now() + chrono::Duration::days(100);
    let narrow_to = chrono::Utc::now() + chrono::Duration::days(200);
    let narrow = GetPartnerEquityStatementUseCase::new(partner_repo.clone(), journal_repo.clone())
        .execute(Some(narrow_from), Some(narrow_to))
        .await
        .unwrap();

    assert_eq!(full.rows.len(), narrow.rows.len(), "same partner count even with narrow range");
    // No entries in the narrow range, so period profit/drawings must be zero
    for row in &narrow.rows {
        assert_eq!(row.period_profit, "0", "no period profit for {}", row.partner_name);
        assert_eq!(row.period_drawings, "0", "no period drawings for {}", row.partner_name);
    }
}