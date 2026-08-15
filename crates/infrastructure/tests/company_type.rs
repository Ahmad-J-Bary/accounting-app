//! Phase 2 — Company Type (persisted in settings.accounting_start_mode).
//!
//! Under test:
//!   - fresh DB default is EXISTING ("ExistingCompanyMigration") — proves both
//!     the domain default flip and migration 154 converting the pristine seed;
//!   - persistence + reload of the company type through the settings repo;
//!   - R1 (migration 154) flips the pristine/unconfigured row (id='default',
//!     company_name='شركتي') and leaves named/configured companies untouched;
//!   - the settings update use case rejects any company-type value outside the
//!     two allowed constants.

use std::str::FromStr;
use std::sync::Arc;

use application::dto::settings_dto::UpdateSettingsRequest;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::settings::UpdateSettingsUseCase;
use domain::settings::START_MODE_EXISTING;
use domain::settings::START_MODE_NEW;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteSettingsRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

const PRISTINE_NAME: &str = "شركة بردى للصناعة";

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_company_type_{}.sqlite", uuid::Uuid::new_v4()));
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

// The exact UPDATE emitted by migration 154 (R1), run manually so tests can
// exercise its WHERE clause against crafted rows.
static R1: &str = "UPDATE settings SET accounting_start_mode = 'ExistingCompanyMigration'
                   WHERE id = 'default' AND company_name = 'شركة بردى للصناعة' AND accounting_start_mode = 'NewCompany'";

#[tokio::test]
async fn fresh_db_defaults_to_existing() {
    let pool = build_pool().await;
    let repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let settings = repo.get().await.unwrap();

    // R1 flipped the pristine seed row; domain default is also EXISTING.
    assert_eq!(settings.accounting_start_mode, START_MODE_EXISTING);
    assert_eq!(
        domain::settings::CompanySettings::default().accounting_start_mode,
        START_MODE_EXISTING
    );
}

#[tokio::test]
async fn company_type_persists_and_reloads() {
    let pool = build_pool().await;
    let repo: Arc<dyn SettingsRepository> = Arc::new(SqliteSettingsRepository::new(pool.clone()));

    let mut settings = repo.get().await.unwrap();
    settings.accounting_start_mode = START_MODE_NEW.into();
    repo.save(&settings).await.unwrap();

    // Reload from a fresh in-memory repo instance (same DB file → same pool).
    let reloaded = repo.get().await.unwrap();
    assert_eq!(reloaded.accounting_start_mode, START_MODE_NEW);

    // And back to EXISTING.
    let mut again = repo.get().await.unwrap();
    again.accounting_start_mode = START_MODE_EXISTING.into();
    repo.save(&again).await.unwrap();
    let final_ = repo.get().await.unwrap();
    assert_eq!(final_.accounting_start_mode, START_MODE_EXISTING);
}

#[tokio::test]
async fn r1_flips_only_the_pristine_row() {
    let pool = build_pool().await;

    // Scenario A — the untouched seed (as it existed before migration 154):
    // pristine name + the pre-change default.
    sqlx::query(
        "UPDATE settings SET company_name = ?, accounting_start_mode = 'NewCompany' WHERE id = 'default'",
    )
    .bind(PRISTINE_NAME)
    .execute(&*pool)
    .await
    .unwrap();
    let _ = sqlx::query(R1).execute(&*pool).await.unwrap();
    let row: String = sqlx::query_scalar(
        "SELECT accounting_start_mode FROM settings WHERE id = 'default'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(row, START_MODE_EXISTING, "pristine row must be converted");

    // Scenario B — a configured company (renamed away from the sentinel) that
    // still carries the old NewCompany default must be left UNTOUCHED.
    sqlx::query(
        "UPDATE settings SET company_name = 'شركتي المعدلة', accounting_start_mode = 'NewCompany' WHERE id = 'default'",
    )
    .execute(&*pool)
    .await
    .unwrap();
    let _ = sqlx::query(R1).execute(&*pool).await.unwrap();
    let row2: String = sqlx::query_scalar(
        "SELECT accounting_start_mode FROM settings WHERE id = 'default'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(
        row2, START_MODE_NEW,
        "configured company must keep its recorded type (no data loss)"
    );
}

fn base_update_request(mode: Option<String>, company_name: &str) -> UpdateSettingsRequest {
    UpdateSettingsRequest {
        company_name: company_name.into(),
        company_name_en: None,
        tax_number: None,
        commercial_register: None,
        address: None,
        phone: None,
        email: None,
        currency: "SAR".into(),
        currency_symbol: "ر.س".into(),
        tax_rate: 0.0,
        invoice_prefix: "INV".into(),
        purchase_prefix: "PUR".into(),
        journal_prefix: "JRN".into(),
        fiscal_year_start_month: 1,
        purchase_warehouse_id: None,
        sales_warehouse_id: None,
        numeral_system: "western".into(),
        accounting_start_mode: mode,
    }
}

#[tokio::test]
async fn update_use_case_whitelists_company_type() {
    let pool = build_pool().await;
    let repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let uc = UpdateSettingsUseCase::new(repo.clone());

    // A bogus value is rejected at the boundary.
    let bad = base_update_request(Some("RandomMode".into()), "ALPHA");
    let err = uc.execute(bad).await.unwrap_err();
    assert!(matches!(err, application::errors::AppError::Invalid(_)), "{err:?}");

    // Both allowed values persist.
    let ok_existing = uc
        .execute(base_update_request(Some(START_MODE_EXISTING.into()), "ALPHA"))
        .await
        .unwrap();
    assert_eq!(ok_existing.accounting_start_mode, START_MODE_EXISTING);

    let ok_new = uc
        .execute(base_update_request(Some(START_MODE_NEW.into()), "ALPHA"))
        .await
        .unwrap();
    assert_eq!(ok_new.accounting_start_mode, START_MODE_NEW);

    // Omitted → keeps whatever was stored.
    let kept = uc
        .execute(base_update_request(None, "ALPHA"))
        .await
        .unwrap();
    assert_eq!(kept.accounting_start_mode, START_MODE_NEW);
}