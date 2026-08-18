//! Bank / Loan / Inventory opening reconciliation.
//! The P0 scenario: EXISTING company opens Cash 25, Bank 40, AR 80, Inventory
//! 120, FA 200 (Dr 465) vs AP 70, Loan 50, Capital 300, residual 45 on 53 (Cr
//! 465). Every sub-ledger incl. the new Bank (`bank` purpose) and Loan (`loan`
//! purpose) must reconcile, validate, post, reclassify residual, and lock.
//! Regression: dropped Bank/Inventory/Loan GL rows must be surfaced precisely.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput, SaveOpeningItemsCommand,
    SetResidualClassificationCommand, UpdateOpeningMigrationLinesCommand,
};
use application::use_cases::opening_balance::{
    readiness_blockers, ApplyResidualToLedgerUseCase, ApproveOpeningBalanceUseCase,
    CreateOpeningBalanceUseCase, GetOpeningPositionControlUseCase, GetOpeningReconciliationUseCase,
    KIND_AR, KIND_AP, KIND_BANK, KIND_FIXED_ASSET, KIND_INVENTORY, KIND_LOAN, LockOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, SaveOpeningItemsUseCase, SetResidualClassificationUseCase,
    UpdateOpeningMigrationLinesUseCase, ValidateOpeningBalanceUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::MigrationStatus;
use domain::assets::{AssetCategory, AssetType, FixedAsset};
use domain::customers::Customer;
use domain::inventory::material::Material;
use domain::shared::ids::AccountId;
use domain::shared::money::Money;
use domain::shared::Currency;
use domain::suppliers::Supplier;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqlitePartnerRepository, SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_bank_loan_inv_{}.sqlite", uuid::Uuid::new_v4()));
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
    currency_repo.save(&test_currency()).await.unwrap();
    currency_repo.set_base_currency("S").await.unwrap();
    set_start_mode(&pool, START_MODE_EXISTING).await;
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
        test_currency(),
        Decimal::ONE,
        None,
    )
    .unwrap()
    .with_purpose(purpose);
    let id = account.id;
    SqliteAccountRepository::new(pool.clone()).save(&account).await.unwrap();
    id
}

#[allow(dead_code)]
struct Accounts {
    cash: AccountId,
    bank: AccountId,
    ar: AccountId,
    inventory: AccountId,
    fa: AccountId,
    ap: AccountId,
    loan: AccountId,
    capital: AccountId,
    obe: AccountId,
    retained: AccountId,
}

async fn seed_accounts(pool: &Arc<sqlx::SqlitePool>) -> Accounts {
    let obe = account_id_by_code(pool, "53").await;
    Accounts {
        cash: save_account(pool, "1910", AccountPurpose::General, AccountType::Assets).await,
        bank: save_account(pool, "1911", AccountPurpose::Bank, AccountType::Assets).await,
        ar: save_account(pool, "1912", AccountPurpose::Receivable, AccountType::Assets).await,
        inventory: save_account(pool, "1913", AccountPurpose::Inventory, AccountType::Assets).await,
        fa: save_account(pool, "1914", AccountPurpose::FixedAsset, AccountType::Assets).await,
        ap: save_account(pool, "2910", AccountPurpose::Payable, AccountType::Liabilities).await,
        loan: save_account(pool, "2911", AccountPurpose::Loan, AccountType::Liabilities).await,
        capital: save_account(pool, "3910", AccountPurpose::PartnerCapital, AccountType::Equity).await,
        obe,
        retained: save_account(pool, "3912", AccountPurpose::RetainedEarnings, AccountType::Equity).await,
    }
}

struct Entities {
    customer: String,
    supplier: String,
    material: String,
    asset: String,
}

async fn seed_entities(pool: &Arc<sqlx::SqlitePool>) -> Entities {
    let customer = Customer::new(
        "C-BL".into(),
        "عميل أول المدة".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(80),
        test_currency(),
        None,
    )
    .unwrap();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();

    let supplier = Supplier::new(
        "S-BL".into(),
        "مورد أول المدة".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(70),
        test_currency(),
        None,
    )
    .unwrap();
    SqliteSupplierRepository::new(pool.clone()).save(&supplier).await.unwrap();

    let material = Material::new(
        "مادة أول المدة".into(),
        "M-BL".into(),
        "M-BL".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    SqliteMaterialRepository::new(pool.clone()).save(&material).await.unwrap();

    let asset_repo = SqliteAssetRepository::new(pool.clone());
    let category = AssetCategory::new("أصول أول المدة".into(), AssetType::Fixed);
    asset_repo.save_category(&category).await.unwrap();
    let fa_dep = save_account(pool, "1915", AccountPurpose::General, AccountType::Assets).await;
    let fa_acc = save_account(pool, "1916", AccountPurpose::General, AccountType::Assets).await;
    let asset = FixedAsset::new(
        "FA-BL".into(),
        "أصل أول المدة".into(),
        category.id,
        None,
        chrono::Utc::now(),
        Money::new(dec!(200), test_currency()),
        dec!(1),
        24,
        account_id_by_code(pool, "1914").await.0,
        fa_dep.0,
        fa_acc.0,
    );
    asset_repo.save_asset(&asset).await.unwrap();

    Entities {
        customer: customer.id.to_string(),
        supplier: supplier.id.to_string(),
        material: material.id.to_string(),
        asset: asset.id.0.to_string(),
    }
}

fn line(account: AccountId, amount: &str) -> OpeningLineInput {
    OpeningLineInput { account_id: account.to_string(), amount: amount.into(), description: None }
}

fn full_lines(a: &Accounts) -> Vec<OpeningLineInput> {
    vec![
        line(a.cash, "25"),
        line(a.bank, "40"),
        line(a.ar, "80"),
        line(a.inventory, "120"),
        line(a.fa, "200"),
        line(a.ap, "70"),
        line(a.loan, "50"),
        line(a.capital, "300"),
        line(a.obe, "45"),
    ]
}

fn dropped_lines(a: &Accounts) -> Vec<OpeningLineInput> {
    vec![
        line(a.cash, "25"),
        line(a.ar, "80"),
        line(a.fa, "200"),
        line(a.ap, "70"),
        line(a.capital, "300"),
        line(a.obe, "45"),
    ]
}

fn six_items(a: &Accounts, e: &Entities) -> Vec<OpeningItemInput> {
    vec![
        OpeningItemInput { kind: KIND_AR.into(), entity_id: e.customer.clone(), reference: None, amount: "80".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_AP.into(), entity_id: e.supplier.clone(), reference: None, amount: "70".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_INVENTORY.into(), entity_id: e.material.clone(), reference: None, amount: "120".into(), qty: "10".into() },
        OpeningItemInput { kind: KIND_FIXED_ASSET.into(), entity_id: e.asset.clone(), reference: None, amount: "200".into(), qty: "1".into() },
        OpeningItemInput { kind: KIND_BANK.into(), entity_id: a.bank.to_string(), reference: Some("حساب البنوك".into()), amount: "40".into(), qty: "0".into() },
        OpeningItemInput { kind: KIND_LOAN.into(), entity_id: a.loan.to_string(), reference: Some("حساب القروض".into()), amount: "50".into(), qty: "0".into() },
    ]
}

fn create(pool: &Arc<sqlx::SqlitePool>) -> CreateOpeningBalanceUseCase {
    CreateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
}

fn update_uc(pool: &Arc<sqlx::SqlitePool>) -> UpdateOpeningMigrationLinesUseCase {
    UpdateOpeningMigrationLinesUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
}

fn reconciler(pool: &Arc<sqlx::SqlitePool>) -> GetOpeningReconciliationUseCase {
    GetOpeningReconciliationUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

fn validator(pool: &Arc<sqlx::SqlitePool>) -> ValidateOpeningBalanceUseCase {
    ValidateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

async fn save_items(pool: &Arc<sqlx::SqlitePool>, migration_id: &str, items: Vec<OpeningItemInput>) {
    SaveOpeningItemsUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
    )
    .execute(SaveOpeningItemsCommand { migration_id: migration_id.into(), items })
    .await
    .expect("save sub-ledger items");
}

fn create_cmd(lines: Vec<OpeningLineInput>, s: Option<&str>) -> CreateOpeningBalanceMigrationCommand {
    CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        lines,
        source_system: s.map(String::from),
        source_reference: None,
    }
}

// ---------------------------------------------------------------------------
// The exact 465/465 scenario end-to-end: reconciled, validated,
// approved, posted (465/465, equity balanced), residual reclassified (53 -> 0),
// locked, and the position control sees Assets 465 / Liabilities 120 / Equity
// 345 with zero equity difference.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn exact_465_scenario_full_lifecycle_reconciles_posts_and_locks() {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let entities = seed_entities(&pool).await;

    let draft = create(&pool)
        .execute(create_cmd(full_lines(&accounts), Some("legacy")))
        .await
        .expect("create exact 465 migration");
    let id = draft.0.id.clone();
    save_items(&pool, &id, six_items(&accounts, &entities)).await;

    // Pre-posting reconciliation: all six rows match, Debit = Credit = 465.
    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon 465");
    assert!(recon.all_reconciled, "bank/loan/inventory must reconcile: {recon:?}");
    assert_eq!(recon.debit_total, dec!(465));
    assert_eq!(recon.credit_total, dec!(465));
    assert!(recon.debit_equals_credit);
    assert!(readiness_blockers(&recon, false).is_empty(), "no pre-posting blockers");
    let bank_row = recon.rows.iter().find(|r| r.key == "Bank").expect("Bank row");
    assert_eq!(bank_row.subledger, dec!(40));
    assert_eq!(bank_row.general_ledger, dec!(40));
    let loan_row = recon.rows.iter().find(|r| r.key == "Loan").expect("Loan row");
    assert_eq!(loan_row.subledger, dec!(50));
    assert_eq!(loan_row.general_ledger, dec!(50));
    let inv_row = recon.rows.iter().find(|r| r.key == "Inventory").expect("Inventory row");
    assert_eq!(inv_row.subledger, dec!(120));
    assert_eq!(inv_row.general_ledger, dec!(120));

    let validated = validator(&pool).execute(id.clone(), "system".into()).await.expect("validate");
    assert_eq!(validated.0.status, MigrationStatus::Validated);
    let approved = ApproveOpeningBalanceUseCase::new(Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())))
        .execute(id.clone(), "manager".into())
        .await
        .expect("approve");
    assert_eq!(approved.0.status, MigrationStatus::Approved);

    let posted = PostOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("post");
    assert_eq!(posted.debit_total, dec!(465));
    assert_eq!(posted.credit_total, dec!(465));
    assert!(posted.equity_balanced, "posted migration must be equity-balanced");

    // Reclassify the residual plug off the Opening Balance Equity account 53
    // into retained earnings (accountant's explicit choice), then lock.
    SetResidualClassificationUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
    )
        .execute(SetResidualClassificationCommand {
            migration_id: id.clone(),
            classification: "RetainedEarnings".into(),
            residual_account_id: Some(accounts.retained.to_string()),
        })
        .await
        .expect("classify residual");
    ApplyResidualToLedgerUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("apply residual");

    let after = reconciler(&pool).execute(id.clone()).await.expect("recon after apply");
    assert_eq!(after.opening_control_balance, dec!(0), "account 53 must net zero");

    let locked = LockOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("lock");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    let pos = GetOpeningPositionControlUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqlitePartnerRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("position");
    assert_eq!(pos.total_assets, dec!(465));
    assert_eq!(pos.total_liabilities, dec!(120));
    assert_eq!(pos.total_equity, dec!(345));
    assert_eq!(pos.net_assets, dec!(345));
    assert!(pos.is_balanced, "final position must be balanced");
}

// ---------------------------------------------------------------------------
// Regression for the original P0 bug: the Bank / Inventory / Loan GL rows are
// dropped (unbalanced Dr 305 / Cr 415), yet the sub-ledger still carries them.
// Every dropped section must surface its precise mismatch and validation must
// reject the migration (the buggy wizard let this "balanced" state through).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn dropped_bank_inventory_loan_gl_lines_are_caught_not_silently_balanced() {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let entities = seed_entities(&pool).await;

    let draft = create(&pool)
        .execute(create_cmd(dropped_lines(&accounts), None))
        .await
        .expect("create migration with dropped GL lines");
    let id = draft.0.id.clone();
    save_items(&pool, &id, six_items(&accounts, &entities)).await;

    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon dropped");
    assert!(!recon.all_reconciled, "dropped sections must be reported");
    let bank = recon.rows.iter().find(|r| r.key == "Bank").expect("Bank row");
    assert_eq!(bank.subledger, dec!(40));
    assert_eq!(bank.general_ledger, dec!(0), "Bank GL line was dropped");
    assert!(!bank.reconciled);
    let loan = recon.rows.iter().find(|r| r.key == "Loan").expect("Loan row");
    assert_eq!(loan.subledger, dec!(50));
    assert_eq!(loan.general_ledger, dec!(0), "Loan GL line was dropped");
    let inventory = recon.rows.iter().find(|r| r.key == "Inventory").expect("Inventory row");
    assert_eq!(inventory.subledger, dec!(120));
    assert_eq!(inventory.general_ledger, dec!(0), "Inventory GL line was dropped");

    // Dr 305 / Cr 415 — the wizard must never report this as balanced.
    assert_eq!(recon.debit_total, dec!(305));
    assert_eq!(recon.credit_total, dec!(415));
    assert!(!recon.debit_equals_credit);

    let blockers = readiness_blockers(&recon, false);
    assert!(blockers.iter().any(|b| b.contains("الواجهات الفرعية")), "{blockers:?}");

    // Validation enforcement: a dropped-section draft stays in Draft.
    let err = validator(&pool).execute(id.clone(), "system".into()).await;
    assert!(err.is_err(), "dropped-section migration must not validate");
    let status: String = sqlx::query_scalar("SELECT status FROM opening_balance_migrations WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(status, "Draft", "rejected validation leaves the migration in Draft");
}

// ---------------------------------------------------------------------------
// Back-navigation (update-lines) path: the accountant removes the Bank line,
// the reconciliation re-runs and reports the gap; restoring it reworks the
// reconciliation. An update is also legal from Validated (status resets to
// Draft) and blocked once Posted.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn update_lines_back_navigation_reworks_reconciliation_and_resets_status() {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let entities = seed_entities(&pool).await;

    let draft = create(&pool)
        .execute(create_cmd(full_lines(&accounts), None))
        .await
        .expect("create");
    let id = draft.0.id.clone();
    save_items(&pool, &id, six_items(&accounts, &entities)).await;
    let cutover = chrono::Utc::now().to_rfc3339();

    let update = |lines: Vec<OpeningLineInput>| UpdateOpeningMigrationLinesCommand {
        migration_id: id.clone(),
        cutover_date: cutover.clone(),
        notes: None,
        lines,
        source_system: Some("legacy".into()),
        source_reference: None,
    };

    // The accountant goes back and removes the Bank GL line.
    update_uc(&pool)
        .execute(update(dropped_lines(&accounts)))
        .await
        .expect("update may drop lines while Draft");
    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon after drop");
    let bank = recon.rows.iter().find(|r| r.key == "Bank").expect("Bank row");
    assert_eq!(bank.general_ledger, dec!(0));
    assert!(!recon.all_reconciled, "dropping the Bank line must break reconciliation");

    // Restoring the Bank line reworks the migration back to reconciled.
    update_uc(&pool)
        .execute(update(full_lines(&accounts)))
        .await
        .expect("update restores the Bank line");
    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon restored");
    assert!(recon.all_reconciled, "restored 9-line set reconciles: {recon:?}");
    assert_eq!(recon.debit_total, dec!(465));

    // Validate, then update again from Validated — legal, resets to Draft.
    validator(&pool).execute(id.clone(), "system".into()).await.expect("validate");
    update_uc(&pool)
        .execute(update(full_lines(&accounts)))
        .await
        .expect("update while Validated is allowed");
    let status: String = sqlx::query_scalar("SELECT status FROM opening_balance_migrations WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(status, "Draft", "edit after validation must return to Draft");
}

#[tokio::test]
async fn update_lines_rejected_once_posted_and_for_new_company() {
    // Posted -> update lines is forbidden.
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let entities = seed_entities(&pool).await;
    let draft = create(&pool)
        .execute(create_cmd(full_lines(&accounts), None))
        .await
        .expect("create");
    let id = draft.0.id.clone();
    save_items(&pool, &id, six_items(&accounts, &entities)).await;
    validator(&pool).execute(id.clone(), "system".into()).await.expect("validate");
    ApproveOpeningBalanceUseCase::new(Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())))
        .execute(id.clone(), "manager".into())
        .await
        .expect("approve");
    PostOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("post");
    let cmd = UpdateOpeningMigrationLinesCommand {
        migration_id: id.clone(),
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        lines: full_lines(&accounts),
        source_system: None,
        source_reference: None,
    };
    let err = update_uc(&pool).execute(cmd).await.expect_err("posted migration must reject edit");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
    let status: String = sqlx::query_scalar("SELECT status FROM opening_balance_migrations WHERE id = ?")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(status, "Posted", "rejected edit must leave the migration Posted");

    // NewCompany -> the same update is forbidden (never an opening window).
    let pool2 = build_pool().await;
    set_start_mode(&pool2, "NewCompany").await;
    let mig_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at)
         VALUES (?, datetime('now'), 'Draft', NULL, NULL, datetime('now'), datetime('now'))",
    )
    .bind(&mig_id)
    .execute(&*pool2)
    .await
    .unwrap();
    let cmd2 = UpdateOpeningMigrationLinesCommand {
        migration_id: mig_id,
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        lines: vec![line(accounts.capital, "300")],
        source_system: None,
        source_reference: None,
    };
    let err2 = update_uc(&pool2).execute(cmd2).await.expect_err("a NEW company never edits");
    assert!(matches!(err2, AppError::Forbidden(_)), "expected Forbidden, got {err2:?}");
}

// ---------------------------------------------------------------------------
// A scenario with no Bank, no Loan and no Inventory still reconciles cleanly.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn no_bank_loan_inventory_scenario_reconciles_and_posts() {
    let pool = build_pool().await;
    let cash = save_account(&pool, "1910", AccountPurpose::General, AccountType::Assets).await;
    let ar = save_account(&pool, "1912", AccountPurpose::Receivable, AccountType::Assets).await;
    let other = save_account(&pool, "1917", AccountPurpose::General, AccountType::Assets).await;
    let ap = save_account(&pool, "2910", AccountPurpose::Payable, AccountType::Liabilities).await;
    let capital = save_account(&pool, "3910", AccountPurpose::PartnerCapital, AccountType::Equity).await;

    let customer = Customer::new(
        "C-NOBL".into(),
        "عميل بدون بنوك".into(),
        None, None, None,
        Decimal::ZERO, Decimal::ZERO, Decimal::from(80),
        test_currency(), None,
    )
    .unwrap();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();
    let supplier = Supplier::new(
        "S-NOBL".into(),
        "مورد بدون بنوك".into(),
        None, None, None,
        Decimal::ZERO, Decimal::ZERO, Decimal::from(70),
        test_currency(), None,
    )
    .unwrap();
    SqliteSupplierRepository::new(pool.clone()).save(&supplier).await.unwrap();

    // Dr: cash 25 + AR 80 + other assets 265 = 370 | Cr: AP 70 + capital 300 = 370.
    let draft = create(&pool)
        .execute(create_cmd(
            vec![
                line(cash, "25"),
                line(ar, "80"),
                line(other, "265"),
                line(ap, "70"),
                line(capital, "300"),
            ],
            None,
        ))
        .await
        .expect("create no-bank migration");
    let id = draft.0.id.clone();
    save_items(
        &pool,
        &id,
        vec![
            OpeningItemInput { kind: KIND_AR.into(), entity_id: customer.id.to_string(), reference: None, amount: "80".into(), qty: "0".into() },
            OpeningItemInput { kind: KIND_AP.into(), entity_id: supplier.id.to_string(), reference: None, amount: "70".into(), qty: "0".into() },
        ],
    )
    .await;

    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon no-bank");
    assert!(recon.all_reconciled, "bank/loan-free scenario reconciles: {recon:?}");
    assert_eq!(recon.debit_total, dec!(370));
    assert_eq!(recon.credit_total, dec!(370));
    let bank = recon.rows.iter().find(|r| r.key == "Bank").expect("Bank row");
    assert_eq!(bank.subledger, dec!(0));
    assert_eq!(bank.general_ledger, dec!(0));
    assert!(bank.reconciled);

    validator(&pool).execute(id.clone(), "system".into()).await.expect("validate no-bank");
    ApproveOpeningBalanceUseCase::new(Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())))
        .execute(id.clone(), "manager".into())
        .await
        .expect("approve no-bank");
    let posted = PostOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("post no-bank");
    assert_eq!(posted.debit_total, dec!(370));
    assert_eq!(posted.credit_total, dec!(370));
}

// ---------------------------------------------------------------------------
// Multiple bank accounts: two bank-purpose GL lines / items add into one Bank
// reconciliation row (40) that matches the GL bucket.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn multiple_bank_accounts_combine_into_one_reconciliation_row() {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;
    let bank2 = save_account(&pool, "1917", AccountPurpose::Bank, AccountType::Assets).await;
    let entities = seed_entities(&pool).await;

    // First bank 15 (1911) + second bank 25 (1917) = 40; everything else like
    // the exact scenario so the migration stays balanced at 465/465.
    let lines = vec![
        line(accounts.cash, "25"),
        line(accounts.bank, "15"),
        line(bank2, "25"),
        line(accounts.ar, "80"),
        line(accounts.inventory, "120"),
        line(accounts.fa, "200"),
        line(accounts.ap, "70"),
        line(accounts.loan, "50"),
        line(accounts.capital, "300"),
        line(accounts.obe, "45"),
    ];
    let draft = create(&pool).execute(create_cmd(lines, None)).await.expect("create multi-bank");
    let id = draft.0.id.clone();
    let mut items = six_items(&accounts, &entities);
    items.retain(|i| i.kind != KIND_BANK);
    items.push(OpeningItemInput { kind: KIND_BANK.into(), entity_id: accounts.bank.to_string(), reference: None, amount: "15".into(), qty: "0".into() });
    items.push(OpeningItemInput { kind: KIND_BANK.into(), entity_id: bank2.to_string(), reference: None, amount: "25".into(), qty: "0".into() });
    save_items(&pool, &id, items).await;

    let recon = reconciler(&pool).execute(id.clone()).await.expect("recon multi-bank");
    let bank = recon.rows.iter().find(|r| r.key == "Bank").expect("Bank row");
    assert_eq!(bank.subledger, dec!(40), "two bank accounts must total 40");
    assert_eq!(bank.general_ledger, dec!(40));
    assert!(bank.reconciled);
    assert!(recon.all_reconciled, "multi-bank scenario reconciles: {recon:?}");
    assert_eq!(recon.debit_total, dec!(465));
}