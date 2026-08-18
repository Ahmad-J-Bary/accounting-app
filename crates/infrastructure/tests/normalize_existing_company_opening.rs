//! Normalize the Existing Company opening posting: OPENING SUBLEDGER
//! DETAILS → VALIDATION/RECONCILIATION → ONE CANONICAL OPENING GL POSTING →
//! OPTIONAL RESIDUAL CLASSIFICATION → LOCK.
//!
//! Every opening sub-ledger (AR / AP / Inventory / Fixed Assets / Bank / Loan /
//! Partner Capital) yields exactly ONE GL opening effect. Fixed-asset SUBLEDGER
//! detail (Car 150 + Equipment 50) is preserved while the GL holds 200 exactly
//! once. Temporary preparation entries (legacy standalone opening journals
//! created before the migration existed) are auto-reversed at post time on
//! account membership — original + reversal = 0 — so only the final opening
//! journal remains in the official report surfaces.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::use_cases::account::AccountQueries;
use application::use_cases::asset::fixed_asset::{CreateAssetRequest, FixedAssetUseCases};
use application::use_cases::journal::ListJournalEntriesUseCase;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput, SaveOpeningItemsCommand,
    SetResidualClassificationCommand,
};
use application::use_cases::opening_balance::{
    ApplyResidualToLedgerUseCase, ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase,
    KIND_AR, KIND_AP, KIND_BANK, KIND_FIXED_ASSET, KIND_INVENTORY, KIND_LOAN,
    LockOpeningBalanceUseCase, PostOpeningBalanceUseCase, SaveOpeningItemsUseCase,
    SetResidualClassificationUseCase, ValidateOpeningBalanceUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::MigrationStatus;
use domain::assets::{AssetCategory, AssetType};
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
    SqliteSettingsRepository, SqliteSupplierRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_norm_opening_{}.sqlite", uuid::Uuid::new_v4()));
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
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = START_MODE_EXISTING.into();
    settings_repo.save(&settings).await.unwrap();
    pool
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

/// Net base-currency GL position of an account across ALL journal lines (live
/// ledger truth, ignoring report-surface filters).
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

async fn entry_count_by_source(pool: &sqlx::SqlitePool, source_id: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE source_id = ?")
        .bind(source_id)
        .fetch_one(pool)
        .await
        .unwrap()
}

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

fn line(account: AccountId, amount: &str) -> OpeningLineInput {
    OpeningLineInput { account_id: account.to_string(), amount: amount.into(), description: None }
}

// ---------------------------------------------------------------------------
// 1. The exact scenario end-to-end: AR 80 / AP 70 / Inventory 120 /
//    FA 200 (Car 150 + Equipment 50 subledger) / Bank 40 / Loan 50 / Capital 300
//    / cash 25 → one aggregate posting → residual 45 → retained earnings → lock.
//    Report surfaces (ledger + posted feed) show exactly ONE effect per account.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn canonical_full_lifecycle_single_gl_effect_per_subledger() {
    let pool = build_pool().await;
    let accounts = seed_accounts(&pool).await;

    // Sub-ledger entities: a customer (80), supplier (70), material (120).
    let customer = Customer::new(
        "C-NORM".into(),
        "عميل أول المدة".into(),
        None, None, None,
        Decimal::ZERO, Decimal::ZERO, Decimal::from(80),
        test_currency(), None,
    )
    .unwrap();
    let customer_id = customer.id.to_string();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();

    let supplier = Supplier::new(
        "S-NORM".into(),
        "مورد أول المدة".into(),
        None, None, None,
        Decimal::ZERO, Decimal::ZERO, Decimal::from(70),
        test_currency(), None,
    )
    .unwrap();
    let supplier_id = supplier.id.to_string();
    SqliteSupplierRepository::new(pool.clone()).save(&supplier).await.unwrap();

    let material = Material::new(
        "مادة أول المدة".into(), "M-NORM".into(), "M-NORM".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    let material_id = material.id.to_string();
    SqliteMaterialRepository::new(pool.clone()).save(&material).await.unwrap();

    // 1) The migration draft exists FIRST so the opening window is active for
    //    the fixed-asset create_asset calls below (subledger-only).
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo: Arc<dyn SettingsRepository> =
        Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: Some("legacy".into()),
        source_reference: None,
        lines: vec![
            line(accounts.cash, "25"),
            line(accounts.bank, "40"),
            line(accounts.ar, "80"),
            line(accounts.inventory, "120"),
            line(accounts.fa, "200"),
            line(accounts.ap, "70"),
            line(accounts.loan, "50"),
            line(accounts.capital, "300"),
            line(accounts.obe, "45"),
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    // 2) Fixed assets are SUBLEDGER detail only: Car 150 + Equipment 50.
    let asset_repo: Arc<dyn AssetRepository> =
        Arc::new(SqliteAssetRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let category = AssetCategory::new("أصول ثابتة".into(), AssetType::Fixed);
    asset_repo.save_category(&category).await.expect("save category");
    let fa_uc = FixedAssetUseCases::new(
        asset_repo.clone(),
        journal_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
        migration_repo.clone(),
    );
    let car_id = fa_uc
        .create_asset(CreateAssetRequest {
            code: "FA-CAR".into(),
            name: "سيارة".into(),
            category_id: category.id,
            warehouse_id: None,
            purchase_date: chrono::Utc::now(),
            purchase_cost: Money::new(dec!(150), test_currency()),
            fx_rate: dec!(1),
            useful_life_months: 60,
            asset_account_id: accounts.fa.0,
            depreciation_account_id: accounts.fa.0,
            accumulated_depreciation_account_id: accounts.fa.0,
            payment_account_id: accounts.obe.0,
            addition_type: "existing".into(),
            notes: None,
            location: None,
            salvage_value: None,
            depreciation_method: None,
        })
        .await
        .expect("create car opening asset (subledger-only)");
    let equipment_id = fa_uc
        .create_asset(CreateAssetRequest {
            code: "FA-EQP".into(),
            name: "معدات".into(),
            category_id: category.id,
            warehouse_id: None,
            purchase_date: chrono::Utc::now(),
            purchase_cost: Money::new(dec!(50), test_currency()),
            fx_rate: dec!(1),
            useful_life_months: 60,
            asset_account_id: accounts.fa.0,
            depreciation_account_id: accounts.fa.0,
            accumulated_depreciation_account_id: accounts.fa.0,
            payment_account_id: accounts.obe.0,
            addition_type: "existing".into(),
            notes: None,
            location: None,
            salvage_value: None,
            depreciation_method: None,
        })
        .await
        .expect("create equipment opening asset (subledger-only)");

    // 3) The opening window defers every GL write: no standalone journals yet,
    //    no FA journal per asset, subledger holds exactly the two assets = 200.
    assert_eq!(entry_count_by_source(&pool, &car_id.0.to_string()).await, 0,
        "car must not write a GL journal during opening preparation");
    assert_eq!(entry_count_by_source(&pool, &equipment_id.0.to_string()).await, 0,
        "equipment must not write a GL journal during opening preparation");
    assert_eq!(gl_net(&pool, &accounts.fa).await, Decimal::ZERO,
        "FA account GL untouched before the migration posts");

    let fa_rows: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM fixed_assets").fetch_one(&*pool).await.unwrap();
    let fa_sum: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(purchase_cost AS REAL)), 0.0) FROM fixed_assets",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(fa_rows, 2, "subledger preserves the individual assets (Car + Equipment)");
    assert_eq!(Decimal::try_from(fa_sum).unwrap(), Decimal::from(200));

    // 4) Save the sub-ledger item links (all six kinds; FA = 150 + 50).
    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        asset_repo.clone(),
        account_repo.clone(),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![
            OpeningItemInput { kind: KIND_AR.into(), entity_id: customer_id, reference: None, amount: "80".into(), qty: "0".into() },
            OpeningItemInput { kind: KIND_AP.into(), entity_id: supplier_id, reference: None, amount: "70".into(), qty: "0".into() },
            OpeningItemInput { kind: KIND_INVENTORY.into(), entity_id: material_id, reference: None, amount: "120".into(), qty: "10".into() },
            OpeningItemInput { kind: KIND_FIXED_ASSET.into(), entity_id: car_id.0.to_string(), reference: None, amount: "150".into(), qty: "1".into() },
            OpeningItemInput { kind: KIND_FIXED_ASSET.into(), entity_id: equipment_id.0.to_string(), reference: None, amount: "50".into(), qty: "1".into() },
            OpeningItemInput { kind: KIND_BANK.into(), entity_id: accounts.bank.to_string(), reference: Some("حساب البنوك".into()), amount: "40".into(), qty: "0".into() },
            OpeningItemInput { kind: KIND_LOAN.into(), entity_id: accounts.loan.to_string(), reference: Some("حساب القروض".into()), amount: "50".into(), qty: "0".into() },
        ],
    })
    .await
    .expect("save sub-ledger items");

    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
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

    // 5) ONE canonical opening GL posting.
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));
    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("migration must post");

    let aggregate = format!("opening_balance:{migration_id}");
    assert_eq!(entry_count_by_source(&pool, &aggregate).await, 1,
        "exactly one canonical opening GL posting");

    let aggregate_lines: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.source_id = ?",
    )
    .bind(&aggregate)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(aggregate_lines, 9, "the aggregate carries exactly the nine opening lines");

    // No temporary/preparation journals may survive in the ledger.
    let standalone_aob: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries
         WHERE journal_type = 'AccountOpeningBalance' AND status = 'Posted'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(standalone_aob, 1, "the ONLY posted AccountOpeningBalance is the aggregate");
    let material_j: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'MaterialOpeningBalance'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(material_j, 0, "no deferred MaterialOpeningBalance journal may appear");
    let fa_tag: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_type = 'fixed_asset_opening'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(fa_tag, 0, "no fixed_asset_opening standalone journal may appear");

    // 6) Every opening account nets EXACTLY ONCE in the live ledger.
    assert_eq!(gl_net(&pool, &accounts.cash).await, Decimal::from(25));
    assert_eq!(gl_net(&pool, &accounts.bank).await, Decimal::from(40));
    assert_eq!(gl_net(&pool, &accounts.ar).await, Decimal::from(80));
    assert_eq!(gl_net(&pool, &accounts.inventory).await, Decimal::from(120));
    assert_eq!(gl_net(&pool, &accounts.fa).await, Decimal::from(200),
        "GL fixed-asset opening = 200 exactly once while the subledger keeps 150 + 50");
    assert_eq!(gl_net(&pool, &accounts.ap).await, Decimal::from(-70));
    assert_eq!(gl_net(&pool, &accounts.loan).await, Decimal::from(-50));
    assert_eq!(gl_net(&pool, &accounts.capital).await, Decimal::from(-300));
    assert_eq!(gl_net(&pool, &accounts.obe).await, Decimal::from(-45),
        "residual sits on OBE 53 before reclassification");

    // Report surface: exactly one ledger movement per account.
    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());
    for acc in [accounts.ar, accounts.fa, accounts.bank, accounts.inventory] {
        let ledger = queries.get_ledger(&[acc]).await.expect("ledger");
        assert_eq!(ledger.lines.len(), 1, "exactly one GL opening movement per sub-ledger");
    }

    // 7) Optional residual classification: Retained Earnings 45, exactly once.
    SetResidualClassificationUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
    )
    .execute(SetResidualClassificationCommand {
        migration_id: migration_id.clone(),
        classification: "RetainedEarnings".into(),
        residual_account_id: Some(accounts.retained.to_string()),
    })
    .await
    .expect("classify residual");
    ApplyResidualToLedgerUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("apply residual");

    let residual = format!("residual_classification:{migration_id}");
    assert_eq!(entry_count_by_source(&pool, &residual).await, 1,
        "exactly one residual classification journal");
    assert_eq!(gl_net(&pool, &accounts.obe).await, Decimal::ZERO,
        "OBE 53 nets to zero after the classification");
    assert_eq!(gl_net(&pool, &accounts.retained).await, Decimal::from(-45),
        "retained earnings holds exactly one 45 classification effect (credited once)");

    // 8) Lock.
    let locked = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("lock");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    // 9) The posted report feed carries ONLY the two canonical journals — the
    //    aggregate and the residual classification. No standalone journals, no
    //    reversals.
    let feed = ListJournalEntriesUseCase::new(journal_repo.clone(), account_repo.clone())
        .execute_posted(None, None, None, None)
        .await
        .unwrap();
    assert_eq!(feed.len(), 2, "feed = aggregate + residual classification only");
    let mut sources: Vec<Option<String>> =
        feed.iter().map(|e| e.source_id.clone()).collect();
    sources.sort();
    let mut expected: Vec<Option<String>> =
        vec![Some(aggregate.clone()), Some(residual.clone())];
    expected.sort();
    assert_eq!(sources, expected, "no temporary/preparation journal may reach the feed");
    assert!(feed.iter().all(|e| e.reversal_of_entry_id.is_none()),
        "no reversal contra may reach the feed");
}

// ---------------------------------------------------------------------------
// 2. Gap-1 regression: a legacy standalone opening journal (created BEFORE the
//    migration existed) whose amount does NOT match the migration line is still
//    auto-reversed at post time (account membership, not exact amount) — it can
//    never survive as a second permanent GL balance.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn legacy_standalone_opening_journal_auto_reversed_even_on_amount_mismatch() {
    let pool = build_pool().await;
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    // 1) NO migration exists yet → the opening window is closed → a customer
    //    opening books a standalone AccountOpeningBalance journal (Dr AR 90 /
    //    Cr 53 90) against the seeded OBE 53.
    let ar = save_account(&pool, "1912", AccountPurpose::Receivable, AccountType::Assets).await;
    let capital = save_account(&pool, "3910", AccountPurpose::PartnerCapital, AccountType::Equity).await;
    let cash = save_account(&pool, "1910", AccountPurpose::General, AccountType::Assets).await;
    let obe = account_id_by_code(&pool, "53").await;

    let mut legacy = JournalEntry::new(
        "LEGACY-AR".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(
                ar,
                crate_amount(dec!(90)),
                crate_zero(),
                "رصيد افتتاحي مدين (قديم)".into(),
            ),
            JournalLine::new(
                obe,
                crate_zero(),
                crate_amount(dec!(90)),
                "رصيد افتتاحي دائن (قديم)".into(),
            ),
        ],
        chrono::Utc::now(),
        "قيد افتتاح عميل قديم".to_string(),
        Some("legacy_customer_opening".to_string()),
    )
    .unwrap();
    legacy.post().unwrap();
    journal_repo.save(&legacy).await.unwrap();

    // 2) The migration books AR 80 (NOT 90) — a deliberate amount mismatch.
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: vec![
            line(ar, "80"),
            line(cash, "25"),
            line(capital, "105"),
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    // Reconcile the AR sub-ledger with an item of 80 so validation passes.
    let customer = Customer::new(
        "C-LEG".into(),
        "عميل قديم".into(),
        None, None, None,
        Decimal::ZERO, Decimal::ZERO, Decimal::from(80),
        test_currency(), None,
    )
    .unwrap();
    let customer_id = customer.id.to_string();
    SqliteCustomerRepository::new(pool.clone()).save(&customer).await.unwrap();
    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
        account_repo.clone(),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![
            OpeningItemInput { kind: KIND_AR.into(), entity_id: customer_id, reference: None, amount: "80".into(), qty: "0".into() },
        ],
    })
    .await
    .expect("save AR item");

    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone(), "tester".into())
    .await
    .expect("validate");

    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(migration_id.clone(), "approver".into())
        .await
        .expect("approve");

    // 3) Post → the legacy standalone (90 ≠ migration 80) is auto-reversed on
    //    account membership.
    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(migration_id.clone())
    .await
    .expect("migration must post");

    // The legacy original is Reversed and its contra is linked back to it.
    let (legacy_status, contra_link, contra_type): (String, Option<String>, String) = sqlx::query_as(
        "SELECT je.status, r.reversal_of_entry_id, r.journal_type
         FROM journal_entries je
         LEFT JOIN journal_entries r ON r.reversal_of_entry_id = je.id
         WHERE je.source_id = 'legacy_customer_opening'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(legacy_status, "Reversed", "legacy standalone must be auto-reversed");
    assert!(contra_link.is_some(), "reversal contra must exist");
    assert_eq!(contra_type, "AccountOpeningBalance", "contra inherits the original's type");

    // AR nets exactly the single canonical effect (80): 90 − 90 + 80 = 80.
    assert_eq!(gl_net(&pool, &ar).await, Decimal::from(80),
        "AR GL = 80 exactly once after the auto-reversal");
    assert_eq!(gl_net(&pool, &obe).await, Decimal::ZERO,
        "OBE 53 nets zero (standalone 90 + reversal −90, aggregate residual zero)");

    // Exactly one aggregate posting exists.
    let aggregate = format!("opening_balance:{migration_id}");
    assert_eq!(entry_count_by_source(&pool, &aggregate).await, 1);

    // Report surface: the AR ledger shows ONLY the aggregate movement.
    let queries = AccountQueries::new(account_repo.clone(), journal_repo.clone());
    let ar_ledger = queries.get_ledger(&[ar]).await.expect("AR ledger");
    assert_eq!(ar_ledger.lines.len(), 1, "report surface hides the reversal pair");

    // Feed: aggregate + the reversal contra (frontend drops contras). The
    // Reversed legacy original is gone from the feed.
    let feed = ListJournalEntriesUseCase::new(journal_repo.clone(), account_repo.clone())
        .execute_posted(None, None, None, None)
        .await
        .unwrap();
    let aggregate_entry = feed.iter().find(|e| e.source_id.as_deref() == Some(aggregate.as_str()));
    assert!(aggregate_entry.is_some(), "aggregate is in the feed");
    assert!(feed.iter().any(|e| e.reversal_of_entry_id.is_some()),
        "the reversal contra is present (and the frontend drops it)");
    assert!(feed.iter().all(|e| e.status == "Posted"));
}

fn crate_amount(v: Decimal) -> domain::shared::monetary_amount::MonetaryAmount {
    use domain::shared::monetary_amount::MonetaryAmount;
    MonetaryAmount::from_base(v, test_currency())
}

fn crate_zero() -> domain::shared::monetary_amount::MonetaryAmount {
    use domain::shared::monetary_amount::MonetaryAmount;
    MonetaryAmount::zero(test_currency())
}
