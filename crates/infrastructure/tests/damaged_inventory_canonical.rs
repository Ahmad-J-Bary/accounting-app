use std::str::FromStr;
use std::sync::Arc;

use application::dto::damaged_dto::CreateDamagedItemRequest;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::exchange_rate_repository::ExchangeRateRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::stock_movement_repository::StockMovementRepository;
use application::use_cases::damaged::{CreateDamagedItemUseCase, DeleteDamagedItemUseCase};
use chrono::Utc;
use domain::inventory::material::Material;
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::exchange_rate::{ExchangeRate, RateType};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteDamagedItemRepository,
    SqliteExchangeRateRepository, SqliteInventoryLotRepository, SqliteJournalEntryRepository,
    SqliteMaterialRepository, SqliteStockMovementRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    build_pool_with_base("USD").await
}

async fn build_pool_with_base(base_code: &str) -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_damaged_canonical_{}.sqlite", uuid::Uuid::new_v4()));
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
    let usd_is_base = base_code == "USD";
    let syp_is_base = base_code == "SYP";
    currency_repo
        .save(&domain::shared::Currency::new("USD", "دولار", "Dollar", "$", 2, usd_is_base))
        .await
        .unwrap();
    currency_repo
        .save(&domain::shared::Currency::new("SYP", "ليرة", "Pound", "ل.س", 2, syp_is_base))
        .await
        .unwrap();
    currency_repo.set_base_currency(base_code).await.unwrap();

    let exchange_repo = Arc::new(SqliteExchangeRateRepository::new(pool.clone()));
    if base_code == "USD" {
        exchange_repo
            .save(&ExchangeRate::new(
                "USD",
                "SYP",
                Decimal::from(130),
                RateType::Middle,
                Utc::now(),
            ))
            .await
            .unwrap();
    } else {
        exchange_repo
            .save(&ExchangeRate::new(
                "SYP",
                "USD",
                Decimal::ONE / Decimal::from(130),
                RateType::Middle,
                Utc::now(),
            ))
            .await
            .unwrap();
    }

    pool
}

async fn create_material_with_stock(pool: &Arc<sqlx::SqlitePool>) -> Material {
    create_material_with_stock_costing(pool, "USD", Decimal::from(5), Decimal::ONE).await
}

async fn create_material_with_stock_costing(
    pool: &Arc<sqlx::SqlitePool>,
    purchase_currency: &str,
    unit_cost_original: Decimal,
    fx_rate: Decimal,
) -> Material {
    let mut material = Material::new(
        "مادة تالفة".into(),
        "DMG-01".into(),
        "DMG-01".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    material.default_purchase_currency = Some(purchase_currency.into());

    let material_repo = SqliteMaterialRepository::new(pool.clone());
    material_repo.save(&material).await.unwrap();

    let movement_repo = SqliteStockMovementRepository::new(pool.clone());
    let mut purchase = StockMovement::new(
        material.id,
        MovementType::Purchase,
        Decimal::from(20),
        unit_cost_original,
        unit_cost_original * Decimal::from(20),
        "PUR-1".into(),
        "purchase".into(),
        Utc::now(),
    )
    .unwrap();
    purchase.original_currency = Some(purchase_currency.into());
    purchase.fx_rate = fx_rate;
    purchase.unit_cost_base = if fx_rate == Decimal::ONE {
        unit_cost_original
    } else {
        unit_cost_original / fx_rate
    };
    purchase.total_cost_base = purchase.unit_cost_base * Decimal::from(20);
    purchase.raw_total_cost_base = purchase.total_cost_base;
    movement_repo.save(&purchase).await.unwrap();

    material
}

#[tokio::test]
async fn damaged_item_uses_carrying_cost_as_canonical_loss_and_cost_impact() {
    let pool = build_pool().await;
    let material = create_material_with_stock(&pool).await;

    let use_case = CreateDamagedItemUseCase::new(
        Arc::new(SqliteDamagedItemRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        Arc::new(SqliteInventoryLotRepository::new(pool.clone())),
        Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        Arc::new(SqliteExchangeRateRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );

    let dto = use_case
        .execute(CreateDamagedItemRequest {
            material_id: material.id.to_string(),
            quantity: 8.0,
            reason: Some("اختبار".into()),
            damage_date: Utc::now().to_rfc3339(),
            cost_impact: 9999.0,
            currency_code: Some("SYP".into()),
            fx_rate: Some(999.0),
            notes: None,
        })
        .await
        .unwrap();

    assert_eq!(dto.currency_code.as_deref(), Some("USD"));
    assert_eq!(dto.fx_rate.as_deref(), Some("1"));
    assert_eq!(dto.cost_impact, "40");
    assert_eq!(dto.cost_impact_base.as_deref(), Some("40"));
    assert_eq!(dto.loss.as_deref(), Some("40"));
    assert_eq!(dto.loss_base.as_deref(), Some("40"));

    let (movement_cost, movement_base): (String, String) = sqlx::query_as(
        "SELECT total_cost, total_cost_base FROM stock_movements WHERE movement_type = 'Damaged' AND document_number = ?",
    )
    .bind(dto.reference.clone().unwrap())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(movement_cost, "40");
    assert_eq!(movement_base, "40");

    let (debit_base, credit_base): (f64, f64) = sqlx::query_as(
        "SELECT SUM(CAST(debit_base AS REAL)), SUM(CAST(credit_base AS REAL)) FROM journal_lines WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = ?)",
    )
    .bind(dto.reference.clone().unwrap())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!((debit_base - 40.0).abs() < 0.001);
    assert!((credit_base - 40.0).abs() < 0.001);
}

#[tokio::test]
async fn damaged_item_preserves_original_usd_and_base_syp_values() {
    let pool = build_pool_with_base("SYP").await;
    let usd_per_syp = Decimal::ONE / Decimal::from(130);
    let material = create_material_with_stock_costing(&pool, "USD", Decimal::from(5), usd_per_syp).await;

    let use_case = CreateDamagedItemUseCase::new(
        Arc::new(SqliteDamagedItemRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        Arc::new(SqliteInventoryLotRepository::new(pool.clone())),
        Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        Arc::new(SqliteExchangeRateRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );

    let dto = use_case
        .execute(CreateDamagedItemRequest {
            material_id: material.id.to_string(),
            quantity: 8.0,
            reason: Some("مثال متعدد العملات".into()),
            damage_date: Utc::now().to_rfc3339(),
            cost_impact: 0.0,
            currency_code: Some("SYP".into()),
            fx_rate: Some(1.0),
            notes: None,
        })
        .await
        .unwrap();

    assert_eq!(dto.currency_code.as_deref(), Some("USD"));
    assert_eq!(Decimal::from_str(&dto.cost_impact).unwrap(), Decimal::from(40));
    assert_eq!(Decimal::from_str(dto.cost_impact_base.as_deref().unwrap()).unwrap().round_dp(4), Decimal::from(5200));
    assert_eq!(Decimal::from_str(dto.loss.as_deref().unwrap()).unwrap(), Decimal::from(40));
    assert_eq!(Decimal::from_str(dto.loss_base.as_deref().unwrap()).unwrap().round_dp(4), Decimal::from(5200));

    let (movement_cost, movement_base, movement_currency, movement_fx): (String, String, Option<String>, String) = sqlx::query_as(
        "SELECT total_cost, total_cost_base, original_currency, fx_rate FROM stock_movements WHERE movement_type = 'Damaged' AND document_number = ?",
    )
    .bind(dto.reference.clone().unwrap())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(Decimal::from_str(&movement_cost).unwrap(), Decimal::from(40));
    assert_eq!(Decimal::from_str(&movement_base).unwrap().round_dp(4), Decimal::from(5200));
    assert_eq!(movement_currency.as_deref(), Some("USD"));
    let dto_fx = Decimal::from_str(dto.fx_rate.as_deref().unwrap()).unwrap();
    let movement_fx = Decimal::from_str(&movement_fx).unwrap();
    assert_eq!(dto_fx.round_dp(10), usd_per_syp.round_dp(10));
    assert_eq!(movement_fx.round_dp(10), usd_per_syp.round_dp(10));

    let (debit_base, credit_base): (f64, f64) = sqlx::query_as(
        "SELECT SUM(CAST(debit_base AS REAL)), SUM(CAST(credit_base AS REAL)) FROM journal_lines WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE source_id = ?)",
    )
    .bind(dto.reference.clone().unwrap())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!((debit_base - 5200.0).abs() < 0.001);
    assert!((credit_base - 5200.0).abs() < 0.001);
}

#[tokio::test]
async fn deleting_a_damaged_item_removes_only_its_own_document_number_movements() {
    let pool = build_pool().await;
    let material = create_material_with_stock(&pool).await;

    let create = CreateDamagedItemUseCase::new(
        Arc::new(SqliteDamagedItemRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        Arc::new(SqliteInventoryLotRepository::new(pool.clone())),
        Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        Arc::new(SqliteExchangeRateRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );

    let first = create
        .execute(CreateDamagedItemRequest {
            material_id: material.id.to_string(),
            quantity: 3.0,
            reason: None,
            damage_date: Utc::now().to_rfc3339(),
            cost_impact: 1.0,
            currency_code: Some("USD".into()),
            fx_rate: Some(1.0),
            notes: None,
        })
        .await
        .unwrap();

    let second = create
        .execute(CreateDamagedItemRequest {
            material_id: material.id.to_string(),
            quantity: 2.0,
            reason: None,
            damage_date: Utc::now().to_rfc3339(),
            cost_impact: 1.0,
            currency_code: Some("USD".into()),
            fx_rate: Some(1.0),
            notes: None,
        })
        .await
        .unwrap();

    let delete = DeleteDamagedItemUseCase::new(
        Arc::new(SqliteDamagedItemRepository::new(pool.clone())),
        Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    );
    delete.execute(&second.id).await.unwrap();

    let remaining_damaged_docs: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM damaged_items")
            .fetch_one(&*pool)
            .await
            .unwrap();
    let remaining_damaged_movements: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM stock_movements WHERE movement_type = 'Damaged'")
            .fetch_one(&*pool)
            .await
            .unwrap();

    assert_eq!(remaining_damaged_docs, 1);
    assert_eq!(remaining_damaged_movements, 1);

    let surviving_doc_number: Option<String> = sqlx::query_scalar(
        "SELECT document_number FROM stock_movements WHERE movement_type = 'Damaged' LIMIT 1",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(surviving_doc_number.as_deref(), first.reference.as_deref());
}
