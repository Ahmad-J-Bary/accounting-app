//! Regression — the migration aggregate journal is the SINGLE canonical
//! GL owner of every Opening sub-ledger (R1). When an entity's opening balance
//! is booked by a standalone per-entity journal (customer/supplier created
//! while the opening window was closed), the migration must never double-book
//! that balance: post-time AUTO-REVERSAL cancels each duplicated standalone
//! journal (audit-preserving Reversal + original kept), so the migration posts
//! and the GL carries exactly ONE opening movement.
//!
//! This mirrors the live-DB duplication (customer «عمار» 1231 / supplier
//! «مراد» 2231 / inventory 121) fixed by migration 158: here a customer is
//! created BEFORE any migration exists (window inactive -> per-entity journal),
//! then a migration including the same AR account auto-reverses that journal
//! during post instead of failing.

use std::str::FromStr;
use std::sync::Arc;

use application::dto::customer_dto::CreateCustomerRequest;
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::customer::CreateCustomerUseCase;
use application::use_cases::journal::ReverseJournalEntryUseCase;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput,
    SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, PostOpeningBalanceUseCase,
    SaveOpeningItemsUseCase, ValidateOpeningBalanceUseCase, KIND_AR,
};
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_fix_dup_partner_opening_{}.sqlite",
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
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let base = domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
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

/// Net base-currency GL position of an account (live ledger truth).
async fn gl_net(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let balance: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::try_from(balance).unwrap()
}

// ---------------------------------------------------------------------------
// Step 1: a customer is created with an opening balance BEFORE any migration
// window exists -> the old defect: a standalone per-entity AccountOpeningBalance
// journal is posted to AR (Dr) / 53 (Cr). Posting a migration that includes
// the SAME account must NOT double-book: the standalone journal is auto-reversed
// at post time and the GL nets to exactly one opening movement.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn migration_posting_auto_reverses_standalone_per_entity_opening_journal() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));
    let settings_repo: Arc<dyn SettingsRepository> =
        Arc::new(SqliteSettingsRepository::new(pool.clone()));

    // 1) Customer with opening balance, NO migration yet (window inactive):
    //    standalone AccountOpeningBalance journal -> Dr AR / Cr 53.
    let created = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "C1".into(),
        name: "عميل عمار".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: Some("800".into()),
        credit: None,
        opening_balance: Some("800".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer outside window");

    let ar_account_id = AccountId::from_str(created.account_id.as_deref().unwrap()).unwrap();
    let per_entity_id: String =
        sqlx::query_scalar("SELECT id FROM journal_entries WHERE source_id = ? LIMIT 1")
            .bind(&created.id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    let per_entity: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
            .bind(&created.id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(
        per_entity, 1,
        "a standalone opening journal was posted (legacy)"
    );

    // 2) Migration includes the SAME AR account (mirrors wizard deriveAr),
    //    balanced against equity so the draft is reconciled and postable.
    let equity = account_id_by_code(&pool, "52").await;
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: vec![
            OpeningLineInput {
                account_id: ar_account_id.to_string(),
                amount: "800".into(),
                description: None,
            },
            OpeningLineInput {
                account_id: equity.to_string(),
                amount: "800".into(),
                description: None,
            },
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        customer_repo.clone(),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        account_repo.clone(),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![OpeningItemInput {
            kind: KIND_AR.to_string(),
            entity_id: created.id.clone(),
            reference: None,
            amount: "800".into(),
            qty: "0".into(),
        }],
    })
    .await
    .expect("save AR sub-ledger item");

    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone(), "tester".into())
    .await
    .expect("reconciled draft must validate");

    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(migration_id.clone(), "approver".into())
        .await
        .expect("approve");

    // 3) Posting the migration AUTO-REVERSES the duplicated standalone journal
    //    (audit-preserving) and posts the aggregate — no manual step.
    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("R1: posting auto-reverses the duplicated standalone opening journal");

    {
        let status: String = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
            .bind(&per_entity_id)
            .fetch_one(&*pool)
            .await
            .unwrap();
        assert_eq!(
            status, "Reversed",
            "standalone original journal is Reversed"
        );
        let reversals: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM journal_entries WHERE reversal_of_entry_id = ?",
        )
        .bind(&per_entity_id)
        .fetch_one(&*pool)
        .await
        .unwrap();
        assert_eq!(
            reversals, 1,
            "a true audit-preserving Reversal journal exists"
        );
    }

    // 4) GL nets to exactly ONE opening movement (800): the reversal cancels
    //    the standalone posting, the migration aggregate carries the canonical
    //    position — never 800+800.
    assert_eq!(gl_net(&pool, &ar_account_id).await, Decimal::from(800));
    let migration_journals: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
            .bind(format!("opening_balance:{migration_id}"))
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(
        migration_journals, 1,
        "exactly one migration aggregate journal"
    );
}

// ---------------------------------------------------------------------------
// Step 2: reversing the per-entity journal again releases the account; the
// migration then posts, and the GL carries exactly ONE opening movement (net
// 800) while the standalone journal is preserved as an audited Reversal.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn migration_posts_after_reversal_gl_nets_exactly_one_opening() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));
    let settings_repo: Arc<dyn SettingsRepository> =
        Arc::new(SqliteSettingsRepository::new(pool.clone()));

    // 1) Same legacy setup: customer opening outside the window.
    let created = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "C2".into(),
        name: "عميل مراد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: Some("800".into()),
        credit: None,
        opening_balance: Some("800".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer outside window");

    let ar_account_id = AccountId::from_str(created.account_id.as_deref().unwrap()).unwrap();
    let per_entity_id: String =
        sqlx::query_scalar("SELECT id FROM journal_entries WHERE source_id = ? LIMIT 1")
            .bind(&created.id)
            .fetch_one(&*pool)
            .await
            .unwrap();

    // 2) Reverse the standalone opening journal (audit-preserving, the same
    //    action migration 158 performs for every duplicated journal).
    ReverseJournalEntryUseCase::new(journal_repo.clone())
        .execute(per_entity_id.clone())
        .await
        .expect("reverse the standalone opening journal");

    {
        let status: String = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
            .bind(&per_entity_id)
            .fetch_one(&*pool)
            .await
            .unwrap();
        assert_eq!(status, "Reversed", "original journal is now Reversed");
        let reversals: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM journal_entries WHERE reversal_of_entry_id = ?",
        )
        .bind(&per_entity_id)
        .fetch_one(&*pool)
        .await
        .unwrap();
        assert_eq!(reversals, 1, "a true Reversal journal exists");
    }

    // 3) Migration over the same account can now post.
    let equity = account_id_by_code(&pool, "52").await;
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: vec![
            OpeningLineInput {
                account_id: ar_account_id.to_string(),
                amount: "800".into(),
                description: None,
            },
            OpeningLineInput {
                account_id: equity.to_string(),
                amount: "800".into(),
                description: None,
            },
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        customer_repo.clone(),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        account_repo.clone(),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![OpeningItemInput {
            kind: KIND_AR.to_string(),
            entity_id: created.id.clone(),
            reference: None,
            amount: "800".into(),
            qty: "0".into(),
        }],
    })
    .await
    .expect("save AR sub-ledger item");

    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone(), "tester".into())
    .await
    .expect("reconciled draft must validate");

    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(migration_id.clone(), "approver".into())
        .await
        .expect("approve");

    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("after reversal the migration must post");

    // 4) GL nets to exactly ONE opening movement (800): the reversal cancels
    //    the standalone journal, the migration carries the canonical position.
    assert_eq!(gl_net(&pool, &ar_account_id).await, Decimal::from(800));
    let migration_journals: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
            .bind(format!("opening_balance:{migration_id}"))
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(
        migration_journals, 1,
        "exactly one migration aggregate journal"
    );
}
