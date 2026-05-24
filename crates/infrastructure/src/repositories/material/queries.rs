use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::material::{Material, MaterialUnit};
use domain::shared::ids::{MaterialId, MaterialCategoryId};
use uuid::Uuid;
use super::models::{MaterialRow, MaterialUnitRow, MaterialPurchasePriceRow, MaterialSalePriceRow};
use super::mappers::{row_to_material, row_to_unit, row_to_purchase_price, row_to_sale_price};
use domain::inventory::material::{MaterialPurchasePrice, MaterialSalePrice};

const MATERIAL_FIELDS: &str = "id, name, name_en, barcode, code, minimum_stock, is_active, notes, image_path, default_purchase_unit_id, default_sale_unit_id, created_at, updated_at";

pub async fn find_by_id(pool: &SqlitePool, id: &MaterialId) -> Result<Option<Material>, AppError> {
    let row = sqlx::query_as::<_, MaterialRow>(
        &format!("SELECT {} FROM materials WHERE id = ?", MATERIAL_FIELDS)
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        let units = get_units(pool, &r.id).await?;
        let purchase_prices = get_purchase_prices(pool, &r.id).await?;
        let sale_prices = get_sale_prices(pool, &r.id).await?;
        Ok(Some(row_to_material(r, units, cat_ids, purchase_prices, sale_prices)?))
    } else {
        Ok(None)
    }
}

pub async fn find_by_code_or_barcode(pool: &SqlitePool, code_or_barcode: &str) -> Result<Option<Material>, AppError> {
    let row = sqlx::query_as::<_, MaterialRow>(
        &format!("SELECT {} FROM materials WHERE code = ? OR barcode = ?", MATERIAL_FIELDS)
    )
    .bind(code_or_barcode)
    .bind(code_or_barcode)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        let units = get_units(pool, &r.id).await?;
        let purchase_prices = get_purchase_prices(pool, &r.id).await?;
        let sale_prices = get_sale_prices(pool, &r.id).await?;
        Ok(Some(row_to_material(r, units, cat_ids, purchase_prices, sale_prices)?))
    } else {
        Ok(None)
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Material>, AppError> {
    let rows = sqlx::query_as::<_, MaterialRow>(
        &format!("SELECT {} FROM materials ORDER BY name", MATERIAL_FIELDS)
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut materials = vec![];
    for r in rows {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        let units = get_units(pool, &r.id).await?;
        let purchase_prices = get_purchase_prices(pool, &r.id).await?;
        let sale_prices = get_sale_prices(pool, &r.id).await?;
        materials.push(row_to_material(r, units, cat_ids, purchase_prices, sale_prices)?);
    }
    Ok(materials)
}

pub async fn get_purchase_prices(pool: &SqlitePool, material_id: &str) -> Result<Vec<MaterialPurchasePrice>, AppError> {
    let rows = sqlx::query_as::<_, MaterialPurchasePriceRow>(
        "SELECT id, material_id, unit_id, price, price_base, currency, updated_at FROM material_purchase_prices WHERE material_id = ?"
    )
    .bind(material_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut prices = vec![];
    for r in rows {
        prices.push(row_to_purchase_price(r)?);
    }
    Ok(prices)
}

pub async fn get_sale_prices(pool: &SqlitePool, material_id: &str) -> Result<Vec<MaterialSalePrice>, AppError> {
    let rows = sqlx::query_as::<_, MaterialSalePriceRow>(
        "SELECT id, material_id, unit_id, tier, price, price_base, min_price, min_price_base, currency, updated_at FROM material_sale_prices WHERE material_id = ?"
    )
    .bind(material_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut prices = vec![];
    for r in rows {
        prices.push(row_to_sale_price(r)?);
    }
    Ok(prices)
}

pub async fn get_category_ids(pool: &SqlitePool, material_id: &str) -> Result<Vec<MaterialCategoryId>, AppError> {
    let rows = sqlx::query("SELECT category_id FROM material_categories WHERE material_id = ?")
        .bind(material_id)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut ids = vec![];
    for r in rows {
        let category_id: String = sqlx::Row::get(&r, "category_id");
        ids.push(MaterialCategoryId(Uuid::parse_str(&category_id).map_err(|e| AppError::Infrastructure(e.to_string()))?));
    }
    Ok(ids)
}

pub async fn get_units(pool: &SqlitePool, material_id: &str) -> Result<Vec<MaterialUnit>, AppError> {
    let rows = sqlx::query_as::<_, MaterialUnitRow>(
        "SELECT id, material_id, name, conversion_factor, barcode, is_base, created_at, updated_at FROM material_units WHERE material_id = ?"
    )
    .bind(material_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut units = vec![];
    for r in rows {
        units.push(row_to_unit(r)?);
    }
    Ok(units)
}
