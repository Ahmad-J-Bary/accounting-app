use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::material::{Material, MaterialUnit};
use domain::shared::ids::{MaterialId, MaterialCategoryId};
use chrono::Utc;
use uuid::Uuid;

use domain::inventory::material::{MaterialPurchasePrice, MaterialSalePrice};

pub async fn save(pool: &SqlitePool, material: &Material) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "INSERT INTO materials (id, name, name_en, barcode, code, minimum_stock, notes, image_path, default_purchase_unit_id, default_sale_unit_id, default_purchase_currency, default_sale_currency, default_warehouse_id, has_expiry, expiry_alert_before_days, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(material.id.to_string())
    .bind(&material.name)
    .bind(&material.name_en)
    .bind(&material.barcode)
    .bind(&material.code)
    .bind(material.minimum_stock.to_string())
    .bind(&material.notes)
    .bind(&material.image_path)
    .bind(material.default_purchase_unit_id.as_ref().map(|id| id.to_string()))
    .bind(material.default_sale_unit_id.as_ref().map(|id| id.to_string()))
    .bind(&material.default_purchase_currency)
    .bind(&material.default_sale_currency)
    .bind(&material.default_warehouse_id)
    .bind(material.has_expiry)
    .bind(material.expiry_alert_before_days)
    .bind(material.created_at.to_rfc3339())
    .bind(material.updated_at.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    save_category_links(&mut tx, &material.id.to_string(), &material.category_ids).await?;
    save_units(&mut tx, &material.units).await?;
    save_purchase_prices(&mut tx, &material.id.to_string(), &material.purchase_prices).await?;
    save_sale_prices(&mut tx, &material.id.to_string(), &material.sale_prices).await?;

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, material: &Material) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "UPDATE materials SET name=?, name_en=?, barcode=?, code=?, minimum_stock=?, notes=?, image_path=?, default_purchase_unit_id=?, default_sale_unit_id=?, default_purchase_currency=?, default_sale_currency=?, default_warehouse_id=?, has_expiry=?, expiry_alert_before_days=?, updated_at=? 
         WHERE id=?"
    )
    .bind(&material.name)
    .bind(&material.name_en)
    .bind(&material.barcode)
    .bind(&material.code)
    .bind(material.minimum_stock.to_string())
    .bind(&material.notes)
    .bind(&material.image_path)
    .bind(material.default_purchase_unit_id.as_ref().map(|id| id.to_string()))
    .bind(material.default_sale_unit_id.as_ref().map(|id| id.to_string()))
    .bind(&material.default_purchase_currency)
    .bind(&material.default_sale_currency)
    .bind(&material.default_warehouse_id)
    .bind(material.has_expiry)
    .bind(material.expiry_alert_before_days)
    .bind(material.updated_at.to_rfc3339())
    .bind(material.id.to_string())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    save_category_links(&mut tx, &material.id.to_string(), &material.category_ids).await?;
    save_units(&mut tx, &material.units).await?;
    save_purchase_prices(&mut tx, &material.id.to_string(), &material.purchase_prices).await?;
    save_sale_prices(&mut tx, &material.id.to_string(), &material.sale_prices).await?;

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &MaterialId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM materials WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn add_unit(pool: &SqlitePool, material_id: &MaterialId, name: String, factor: rust_decimal::Decimal, barcode: Option<String>) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO material_units (id, material_id, name, conversion_factor, barcode, is_base, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(material_id.to_string())
    .bind(name)
    .bind(factor.to_string())
    .bind(barcode)
    .bind(false)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete_unit(pool: &SqlitePool, unit_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM material_units WHERE id = ? AND is_base = 0")
        .bind(unit_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn save_category_links(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, material_id: &str, category_ids: &[MaterialCategoryId]) -> Result<(), AppError> {
    sqlx::query("DELETE FROM material_categories WHERE material_id = ?")
        .bind(material_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for cid in category_ids {
        sqlx::query(
            "INSERT INTO material_categories (material_id, category_id) VALUES (?, ?)"
        )
        .bind(material_id)
        .bind(cid.to_string())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

async fn save_units(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, units: &[MaterialUnit]) -> Result<(), AppError> {
    if units.is_empty() { return Ok(()); }
    
    let material_id = units[0].material_id.to_string();
    
    sqlx::query("DELETE FROM material_units WHERE material_id = ?")
        .bind(&material_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let now = Utc::now().to_rfc3339();
    for u in units {
        sqlx::query(
            "INSERT INTO material_units (id, material_id, name, conversion_factor, barcode, is_base, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(u.id.to_string())
        .bind(u.material_id.to_string())
        .bind(&u.name)
        .bind(u.conversion_factor.to_string())
        .bind(&u.barcode)
        .bind(u.is_base)
        .bind(&now)
        .bind(&now)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

async fn save_purchase_prices(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, material_id: &str, prices: &[MaterialPurchasePrice]) -> Result<(), AppError> {
    sqlx::query("DELETE FROM material_purchase_prices WHERE material_id = ?")
        .bind(material_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let now = Utc::now().to_rfc3339();
    for p in prices {
        sqlx::query(
            "INSERT INTO material_purchase_prices (id, material_id, unit_id, price, price_base, currency, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&p.id)
        .bind(material_id)
        .bind(p.unit_id.to_string())
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.price).unwrap_or_default())
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.price_base).unwrap_or_default())
        .bind(&p.currency)
        .bind(&now)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

async fn save_sale_prices(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>, material_id: &str, prices: &[MaterialSalePrice]) -> Result<(), AppError> {
    sqlx::query("DELETE FROM material_sale_prices WHERE material_id = ?")
        .bind(material_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let now = Utc::now().to_rfc3339();
    for p in prices {
        sqlx::query(
            "INSERT INTO material_sale_prices (id, material_id, unit_id, tier, price, price_base, min_price, min_price_base, max_quantity, max_quantity_unit_id, currency, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&p.id)
        .bind(material_id)
        .bind(p.unit_id.to_string())
        .bind(&p.tier)
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.price).unwrap_or_default())
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.price_base).unwrap_or_default())
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.min_price).unwrap_or_default())
        .bind(rust_decimal::prelude::ToPrimitive::to_f64(&p.min_price_base).unwrap_or_default())
        .bind(&p.max_quantity)
        .bind(&p.max_quantity_unit_id)
        .bind(&p.currency)
        .bind(&now)
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}
