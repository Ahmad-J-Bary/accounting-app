//! Fixed-asset opening duplication. Opening fixed-asset details are
//! SUBLEDGER data; the General Ledger must hold the opening value exactly once.
//!
//! Scenario: Car = 150, Equipment = 50. Fixed Asset Subledger = 200 and GL
//! Fixed Asset balance = 200 — the same 200 never appears twice.
//!
//! Architecture (Option B): while an existing company is preparing its opening
//! migration, `create_asset` writes NO GeneralJournal and mutates NO account
//! balance — the records stay subledger-only. The opening migration aggregate
//! posts the single GL opening journal (Dr FA 200 / Cr equity 200). Posting is
//! idempotent: the second post is rejected, so the migration can never book the
//! position a second time.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::asset::fixed_asset::{CreateAssetRequest, FixedAssetUseCases};
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput,
    SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, PostOpeningBalanceUseCase,
    SaveOpeningItemsUseCase, ValidateOpeningBalanceUseCase, KIND_FIXED_ASSET,
};
use domain::accounting::account::{AccountCategory, AccountType};
use domain::shared::ids::AccountId;
use domain::shared::Currency;
use domain::shared::Money;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_fix_fa_opening_{}.sqlite",
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
    let base = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
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

async fn create_leaf_account(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    name_ar: &str,
    account_type: AccountType,
    parent_id: AccountId,
    purpose: domain::accounting::account::AccountPurpose,
) -> AccountId {
    let account = domain::accounting::account::Account::new(
        code.into(),
        name_ar.into(),
        name_ar.into(),
        account_type,
        Some(parent_id),
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        Currency::new("S", "عملة أساسية", "Base", "B", 2, true),
        Decimal::ONE,
        None,
    )
    .unwrap()
    .with_purpose(purpose);
    let id = account.id;
    SqliteAccountRepository::new(pool.clone())
        .save(&account)
        .await
        .unwrap();
    id
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

async fn fixed_asset_journal_count(pool: &sqlx::SqlitePool, source_id: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
        .bind(source_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn subledger_total(pool: &sqlx::SqlitePool) -> Decimal {
    let total: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(purchase_cost AS REAL)), 0.0) FROM fixed_assets",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::try_from(total).unwrap()
}

// ---------------------------------------------------------------------------
// The exact user scenario: Car = 150, Equipment = 50 → Subledger 200, GL 200,
// exactly once. While the opening window is active create_asset is subledger-only;
// the migration aggregate posts the single GL opening journal; posting twice is
// rejected (idempotent).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn opening_fixed_assets_book_gl_exactly_once_150_plus_50_equals_200() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let asset_repo: Arc<dyn AssetRepository> = Arc::new(SqliteAssetRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));
    let settings_repo: Arc<dyn SettingsRepository> =
        Arc::new(SqliteSettingsRepository::new(pool.clone()));

    // Accounts: a dedicated FA leaf under the seeded fixed-assets root (11),
    // an equity counterpart (52) and the residual/payment account (53).
    let fixed_assets_root = account_id_by_code(&pool, "11").await;
    let fa_account = create_leaf_account(
        &pool,
        "1115",
        "أصول ثابتة - سيارات ومعدات",
        AccountType::Assets,
        fixed_assets_root,
        domain::accounting::account::AccountPurpose::FixedAsset,
    )
    .await;
    let equity = account_id_by_code(&pool, "52").await;
    let payment = account_id_by_code(&pool, "53").await;

    // 1) The opening migration draft exists FIRST → the opening window is
    //    active for every subsequent create_asset call.
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
                account_id: fa_account.to_string(),
                amount: "200".into(),
                description: None,
            },
            OpeningLineInput {
                account_id: equity.to_string(),
                amount: "200".into(),
                description: None,
            },
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    // 2) Create the two opening fixed assets (Option B): subledger-only.
    let category =
        domain::assets::AssetCategory::new("أصول ثابتة".into(), domain::assets::AssetType::Fixed);
    asset_repo
        .save_category(&category)
        .await
        .expect("save category");

    let uc = FixedAssetUseCases::new(
        asset_repo.clone(),
        journal_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
        migration_repo.clone(),
    );

    let base_currency = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    let car_id = uc
        .create_asset(CreateAssetRequest {
            code: "FA-CAR".into(),
            name: "سيارة".into(),
            category_id: category.id,
            warehouse_id: None,
            purchase_date: chrono::Utc::now(),
            purchase_cost: Money::new(dec!(150), base_currency.clone()),
            fx_rate: dec!(1),
            useful_life_months: 60,
            asset_account_id: fa_account.0,
            depreciation_account_id: equity.0,
            accumulated_depreciation_account_id: fa_account.0,
            payment_account_id: payment.0,
            addition_type: "existing".into(),
            notes: None,
            location: None,
            salvage_value: None,
            depreciation_method: None,
        })
        .await
        .expect("create car opening asset (subledger-only)");

    let equipment_id = uc
        .create_asset(CreateAssetRequest {
            code: "FA-EQP".into(),
            name: "معدات".into(),
            category_id: category.id,
            warehouse_id: None,
            purchase_date: chrono::Utc::now(),
            purchase_cost: Money::new(dec!(50), base_currency.clone()),
            fx_rate: dec!(1),
            useful_life_months: 60,
            asset_account_id: fa_account.0,
            depreciation_account_id: equity.0,
            accumulated_depreciation_account_id: fa_account.0,
            payment_account_id: payment.0,
            addition_type: "existing".into(),
            notes: None,
            location: None,
            salvage_value: None,
            depreciation_method: None,
        })
        .await
        .expect("create equipment opening asset (subledger-only)");

    // 3) During the opening window NO GeneralJournal and NO account-balance
    //    mutation may exist — the subledger is the only record so far.
    assert_eq!(
        fixed_asset_journal_count(&pool, &car_id.0.to_string()).await,
        0,
        "car must not write a GL journal during opening preparation"
    );
    assert_eq!(
        fixed_asset_journal_count(&pool, &equipment_id.0.to_string()).await,
        0,
        "equipment must not write a GL journal during opening preparation"
    );
    assert_eq!(
        gl_net(&pool, &fa_account).await,
        Decimal::ZERO,
        "FA account GL must be untouched before the migration posts"
    );

    let (debit, credit): (String, String) =
        sqlx::query_as("SELECT debit, credit FROM accounts WHERE id = ?")
            .bind(fa_account.0.to_string())
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(Decimal::from_str(&debit).unwrap(), Decimal::ZERO);
    assert_eq!(Decimal::from_str(&credit).unwrap(), Decimal::ZERO);

    // 4) The subledger carries exactly the two assets = 200.
    assert_eq!(subledger_total(&pool).await, Decimal::from(200));

    // 5) The wizard feeds the FA rows into the migration sub-ledger items.
    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        asset_repo.clone(),
        account_repo.clone(),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![
            OpeningItemInput {
                kind: KIND_FIXED_ASSET.to_string(),
                entity_id: car_id.0.to_string(),
                reference: None,
                amount: "150".into(),
                qty: "0".into(),
            },
            OpeningItemInput {
                kind: KIND_FIXED_ASSET.to_string(),
                entity_id: equipment_id.0.to_string(),
                reference: None,
                amount: "50".into(),
                qty: "0".into(),
            },
        ],
    })
    .await
    .expect("save FA sub-ledger items");

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

    // 6) Post: the migration aggregate posts the SINGLE GL opening journal.
    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("migration must post");

    // 7) GL Fixed Asset = 200 exactly once; the subledger still equals 200;
    //    the FA assets still own no standalone journal.
    assert_eq!(
        gl_net(&pool, &fa_account).await,
        Decimal::from(200),
        "GL fixed-asset opening = 200 exactly once"
    );
    assert_eq!(subledger_total(&pool).await, Decimal::from(200));
    assert_eq!(
        fixed_asset_journal_count(&pool, &car_id.0.to_string()).await,
        0
    );
    assert_eq!(
        fixed_asset_journal_count(&pool, &equipment_id.0.to_string()).await,
        0
    );

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

    // 8) Idempotency: posting a second time is rejected — the GL can never be
    //    booked twice.
    let second_post = PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await;
    assert!(
        second_post.is_err(),
        "a second migration post must be rejected"
    );
    assert_eq!(
        gl_net(&pool, &fa_account).await,
        Decimal::from(200),
        "second post must not double-book the GL"
    );
}
