//! Regression — creating a material with multiple units must not hit
//! SQLite code 787 (FOREIGN KEY constraint failed).
//!
//! materials.default_purchase_unit_id / default_sale_unit_id (migration 049)
//! reference material_units(id), and material_units.material_id references
//! materials(id) back (migration 027) — a circular FK. The repository inserts
//! the materials row before its units, so FK enforcement must be deferred to
//! commit inside save(). This test exercises the REAL CreateMaterialUseCase the
//! way the desktop frontend does: unit ids sent as *names* (e.g. "قطعة"), the
//! domain resolves them to fresh UUIDs, and persistence must succeed.
//!
//! Covered here:
//!   - create succeeds with default unit ids supplied by name;
//!   - the persisted materials row points at unit rows that actually exist;
//!   - the units themselves survive a read-back and stay attached to the material.

use std::str::FromStr;
use std::sync::Arc;

use application::dto::material_dto::{
    CreateMaterialRequest, CreateMaterialUnitRequest,
};
use application::ports::material_repository::MaterialRepository;
use application::use_cases::material::CreateMaterialUseCase;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteCategoryRepository, SqliteMaterialRepository,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_material_card_{}.sqlite", uuid::Uuid::new_v4()));
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

#[tokio::test]
async fn create_material_with_named_default_units_persists() {
    let pool = build_pool().await;

    let use_case = CreateMaterialUseCase::new(
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteCategoryRepository::new(pool.clone())),
    );

    let dto = use_case
        .execute(CreateMaterialRequest {
            name: "مادة اختبار الوحدات".to_string(),
            name_en: Some("Test Unit Material".to_string()),
            barcode: Some("UNIT-TEST-001".to_string()),
            code: Some("MAT-UNIT-TEST".to_string()),
            minimum_stock: "5".to_string(),
            units: vec![
                CreateMaterialUnitRequest {
                    name: "قطعة".to_string(),
                    conversion_factor: "1".to_string(),
                    barcode: None,
                },
                CreateMaterialUnitRequest {
                    name: "كرتونة".to_string(),
                    conversion_factor: "24".to_string(),
                    barcode: None,
                },
            ],
            category_ids: vec![],
            notes: None,
            image_path: None,
            default_purchase_unit_id: Some("قطعة".to_string()),
            default_sale_unit_id: Some("قطعة".to_string()),
            default_purchase_currency: None,
            default_sale_currency: None,
            default_warehouse_id: None,
            has_expiry: None,
            expiry_alert_before_days: None,
            purchase_prices: vec![],
            sale_prices: vec![],
        })
        .await
        .expect("create material must succeed");

    assert_eq!(dto.units.len(), 2);
    assert!(!dto.id.is_empty());

    // The default ids must be resolved to genuine unit ids (name -> fresh UUID).
    let purchase_default = dto.default_purchase_unit_id.clone().expect("purchase default");
    let sale_default = dto.default_sale_unit_id.clone().expect("sale default");
    assert!(dto.units.iter().any(|u| u.id == purchase_default), "purchase default must be a real unit");
    assert!(dto.units.iter().any(|u| u.id == sale_default), "sale default must be a real unit");
    assert_eq!(purchase_default, sale_default);

    // The materials row must reference material_units rows that exist (code 787
    // regression: previously the INSERT bound fresh UUIDs before units existed).
    let unit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM material_units WHERE material_id = ?")
        .bind(&dto.id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(unit_count, 2);

    let default_unit_id: String =
        sqlx::query_scalar("SELECT default_purchase_unit_id FROM materials WHERE id = ?")
            .bind(&dto.id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    let referenced: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM material_units WHERE id = ?")
            .bind(&default_unit_id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(referenced, 1, "default unit FK must point at an existing unit");
}

#[tokio::test]
async fn updating_replace_units_keeps_default_unit_valid() {
    let pool = build_pool().await;

    let use_case = CreateMaterialUseCase::new(
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteCategoryRepository::new(pool.clone())),
    );

    let dto = use_case
        .execute(CreateMaterialRequest {
            name: "مادة تحديث الوحدات".to_string(),
            name_en: None,
            barcode: Some("UNIT-TEST-002".to_string()),
            code: Some("MAT-UNIT-UPDATE".to_string()),
            minimum_stock: "0".to_string(),
            units: vec![CreateMaterialUnitRequest {
                name: "قطعة".to_string(),
                conversion_factor: "1".to_string(),
                barcode: None,
            }],
            category_ids: vec![],
            notes: None,
            image_path: None,
            default_purchase_unit_id: Some("قطعة".to_string()),
            default_sale_unit_id: Some("قطعة".to_string()),
            default_purchase_currency: None,
            default_sale_currency: None,
            default_warehouse_id: None,
            has_expiry: None,
            expiry_alert_before_days: None,
            purchase_prices: vec![],
            sale_prices: vec![],
        })
        .await
        .expect("create material");

    let repo = SqliteMaterialRepository::new(pool.clone());
    let mut material = repo
        .find_by_id(&material_id(&dto.id))
        .await
        .expect("read material")
        .expect("material exists");

    // Simulate the edit flow: replace the unit set entirely, keeping the same
    // default unit name so update() must DELETE + re-INSERT units while the
    // materials row still references one of them.
    material.units[0].name = "قطعة".to_string();
    material.units[0].conversion_factor = rust_decimal::Decimal::from(1);

    repository_save(&repo, &material).await;

    let reloaded = repo
        .find_by_id(&material_id(&dto.id))
        .await
        .expect("re-read material")
        .expect("material still exists");
    assert_eq!(reloaded.units.len(), 1);

    let default_unit_id: String =
        sqlx::query_scalar("SELECT default_sale_unit_id FROM materials WHERE id = ?")
            .bind(&dto.id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    let referenced: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM material_units WHERE id = ?")
            .bind(&default_unit_id)
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(referenced, 1, "default unit must stay valid after unit replacement");
}

fn material_id(id: &str) -> domain::shared::ids::MaterialId {
    domain::shared::ids::MaterialId(uuid::Uuid::parse_str(id).unwrap())
}

async fn repository_save(
    repo: &SqliteMaterialRepository,
    material: &domain::inventory::material::Material,
) {
    // SqliteMaterialRepository implements save() (full replace); update() also
    // funnels through commands::update. We exercise update directly because it
    // is the path that DELETE + re-INSERTs units on top of the materials row.
    repo.update(material).await.expect("update material");
}