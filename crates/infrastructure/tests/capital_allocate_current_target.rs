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
    AllocateNetProfitCommand, AllocateNetProfitUseCase,
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
    let result = allocate
        .execute(AllocateNetProfitCommand {
            migration_id: migration_id.clone(),
            net_profit: "500".to_string(),
        })
        .await
        .expect("allocation must post");
    assert_eq!(result.allocated_total, Decimal::from(500));
    assert_eq!(result.shares.len(), 1);

    let entry_id: String = sqlx::query_scalar("SELECT id FROM journal_entries WHERE source_id = ?")
        .bind(format!("profit_distribution:{migration_id}"))
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

    // Re-running the same migration must resolve to the same distribution entry
    // (no second journal) — idempotency via `profit_distribution:{migration_id}`.
    let rerun = allocate
        .execute(AllocateNetProfitCommand {
            migration_id,
            net_profit: "500".to_string(),
        })
        .await
        .unwrap();
    assert_eq!(rerun.entry_number, result.entry_number);
    assert_eq!(rerun.allocated_total, Decimal::from(500));
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
        .execute(AllocateNetProfitCommand {
            migration_id,
            net_profit: "500".to_string(),
        })
        .await
        .expect_err("distribution beyond the available pool must be rejected");
    assert!(
        err.to_string().contains("يتجاوز الأرباح المتاحة"),
        "unexpected error: {err}"
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
        .execute(AllocateNetProfitCommand {
            migration_id,
            net_profit: "400".to_string(),
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
    let result = allocate
        .execute(AllocateNetProfitCommand {
            migration_id: migration_id.clone(),
            net_profit: "500".to_string(),
        })
        .await
        .expect("allocation on a Locked migration must post");

    assert_eq!(result.allocated_total, Decimal::from(500));
    assert_eq!(result.shares.len(), 1);

    // Idempotency holds across the lock: a re-run resolves the same journal.
    let rerun = allocate
        .execute(AllocateNetProfitCommand {
            migration_id,
            net_profit: "500".to_string(),
        })
        .await
        .unwrap();
    assert_eq!(rerun.entry_number, result.entry_number);
    assert_eq!(rerun.allocated_total, Decimal::from(500));
}
