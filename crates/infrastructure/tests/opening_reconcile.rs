//! Phase 8 — Opening Reconciliation direct test. `GetOpeningReconciliationUseCase`
//! reports each sub-ledger (AR / AP / Inventory / Fixed Assets) compared against
//! the migration's own general-ledger opening lines. A migration whose AR
//! sub-ledger item (700) matches its GL receivable line (700) reconciles; a
//! migration whose AR item does not match the GL does not — and the blocker text
//! surfaces exactly that.
//!
//! Under test:
//!   - a reconciled migration: `all_reconciled == true` and every row
//!     `subledger == general_ledger`;
//!   - a non-reconciled migration: the AR row reports the mismatch and
//!     `all_reconciled == false`, with the exact human blocker.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput, SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    CreateOpeningBalanceUseCase, GetOpeningReconciliationUseCase, KIND_AR, SaveOpeningItemsUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::customers::Customer;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteSettingsRepository,
    SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_reconcile_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn save_account(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    purpose: AccountPurpose,
    account_type: AccountType,
) -> AccountId {
    let account = Account::new(
        code.to_string(),
        format!("حساب {}", code),
        format!("Account {}", code),
        account_type,
        None,
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true),
        Decimal::ONE,
        None,
    )
    .unwrap()
    .with_purpose(purpose);
    let id = account.id;
    SqliteAccountRepository::new(pool.clone()).save(&account).await.unwrap();
    id
}

async fn create_draft(pool: &Arc<sqlx::SqlitePool>, with_ar_gl_line: bool) -> String {
    // A dedicated AR account (purpose receivable) + a credit-normal equity leg,
    // both created directly so the sub-ledger classification is explicit.
    let ar = save_account(pool, "1907", AccountPurpose::Receivable, AccountType::Assets).await;
    let equity = save_account(pool, "1909", AccountPurpose::General, AccountType::Equity).await;
    let mut lines = vec![];
    if with_ar_gl_line {
        // Dr AR 700 / Cr Equity 700 → AR GL bucket = 700, balanced.
        lines.push(OpeningLineInput { account_id: ar.to_string(), amount: "700".into(), description: None });
        lines.push(OpeningLineInput { account_id: equity.to_string(), amount: "700".into(), description: None });
    } else {
        // Non-reconciled GL: no receivable line on the AR account at all —
        // Dr a general asset 500 / Cr Equity 500 (balanced, AR GL bucket = 0).
        let asset = save_account(pool, "1908", AccountPurpose::General, AccountType::Assets).await;
        lines.push(OpeningLineInput { account_id: asset.to_string(), amount: "500".into(), description: None });
        lines.push(OpeningLineInput { account_id: equity.to_string(), amount: "500".into(), description: None });
    }
    let draft = CreateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines,
    })
    .await
    .expect("create draft");
    draft.0.id
}

async fn save_ar_item(pool: &Arc<sqlx::SqlitePool>, migration_id: &str, amount: &str) {
    let customer = Customer::new(
        "C-REC".into(),
        "عميل أول المدة".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(700),
        domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true),
        None,
    )
    .unwrap();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();

    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    SaveOpeningItemsUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        customer_repo,
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.to_string(),
        items: vec![OpeningItemInput {
            kind: KIND_AR.to_string(),
            entity_id: customer.id.to_string(),
            reference: None,
            amount: amount.into(),
            qty: "0".into(),
        }],
    })
    .await
    .expect("save AR sub-ledger item");
}

fn reconciler(pool: &Arc<sqlx::SqlitePool>) -> GetOpeningReconciliationUseCase {
    GetOpeningReconciliationUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

// ---------------------------------------------------------------------------
// AR sub-ledger item (700) matches the GL receivable line (700): every row
// reconciles and the report is a fully reconciled view.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn reconciled_migration_reports_matching_rows_and_all_reconciled() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let id = create_draft(&pool, true).await;
    save_ar_item(&pool, &id, "700").await;

    let dto = reconciler(&pool).execute(id).await.expect("reconciliation computes");

    assert!(dto.all_reconciled, "balanced reconciled migration must reconcile");
    let ar_row = dto.rows.iter().find(|r| r.key == "AR").expect("AR row present");
    assert_eq!(ar_row.subledger, dec!(700), "AR sub-ledger total is 700");
    assert_eq!(ar_row.general_ledger, dec!(700), "GL receivable line is 700");
    assert!(ar_row.reconciled);
    assert!(dto.debit_equals_credit, "reconciled migration is balanced");
}

// ---------------------------------------------------------------------------
// AR sub-ledger item (700) does not match the GL (no receivable line): the AR
// row reports the mismatch, the report is NOT reconciled, and the human blocker
// names the failing sub-ledger.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn unreconciled_migration_reports_ar_mismatch_and_blocker() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let id = create_draft(&pool, false).await;
    save_ar_item(&pool, &id, "700").await;

    let dto = reconciler(&pool).execute(id).await.expect("reconciliation computes");

    assert!(!dto.all_reconciled, "mismatched sub-ledger must not reconcile");
    let ar_row = dto.rows.iter().find(|r| r.key == "AR").expect("AR row present");
    assert_eq!(ar_row.subledger, dec!(700));
    assert_eq!(ar_row.general_ledger, dec!(0), "no GL receivable line");
    assert!(!ar_row.reconciled);

    let blockers = application::use_cases::opening_balance::readiness_blockers(&dto, false);
    assert!(
        blockers.iter().any(|b| b.contains("الواجهات الفرعية")),
        "blocker must name the sub-ledger mismatch: {blockers:?}"
    );
}