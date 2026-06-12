use application::errors::AppError;
use domain::shared::ids::{MaterialId, MaterialCategoryId, MaterialUnitId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::{MaterialRow, MaterialUnitRow, MaterialPurchasePriceRow, MaterialSalePriceRow};
use domain::inventory::material::{Material, MaterialUnit, MaterialPurchasePrice, MaterialSalePrice};

pub fn row_to_material(
    row: MaterialRow, 
    units: Vec<MaterialUnit>, 
    category_ids: Vec<MaterialCategoryId>,
    purchase_prices: Vec<MaterialPurchasePrice>,
    sale_prices: Vec<MaterialSalePrice>
) -> Result<Material, AppError> {
    Ok(Material {
        id: MaterialId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        name_en: row.name_en,
        barcode: row.barcode.unwrap_or_default(),
        code: row.code.unwrap_or_default(),
        minimum_stock: Decimal::from_str(&row.minimum_stock).unwrap_or_default(),
        units,
        category_ids,
        notes: row.notes,
        image_path: row.image_path,
        default_purchase_unit_id: row.default_purchase_unit_id.and_then(|id| Uuid::parse_str(&id).ok().map(MaterialUnitId)),
        default_sale_unit_id: row.default_sale_unit_id.and_then(|id| Uuid::parse_str(&id).ok().map(MaterialUnitId)),
        default_purchase_currency: row.default_purchase_currency,
        default_sale_currency: row.default_sale_currency,
        default_warehouse_id: row.default_warehouse_id,
        has_expiry: row.has_expiry,
        expiry_alert_before_days: row.expiry_alert_before_days,
        purchase_prices,
        sale_prices,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}

pub fn row_to_purchase_price(row: MaterialPurchasePriceRow) -> Result<MaterialPurchasePrice, AppError> {
    Ok(MaterialPurchasePrice {
        id: row.id,
        unit_id: MaterialUnitId(Uuid::parse_str(&row.unit_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        price: Decimal::from_f64_retain(row.price).unwrap_or_default(),
        price_base: Decimal::from_f64_retain(row.price_base).unwrap_or_default(),
        currency: row.currency,
    })
}

pub fn row_to_sale_price(row: MaterialSalePriceRow) -> Result<MaterialSalePrice, AppError> {
    Ok(MaterialSalePrice {
        id: row.id,
        unit_id: MaterialUnitId(Uuid::parse_str(&row.unit_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        tier: row.tier,
        price: Decimal::from_f64_retain(row.price).unwrap_or_default(),
        price_base: Decimal::from_f64_retain(row.price_base).unwrap_or_default(),
        min_price: Decimal::from_f64_retain(row.min_price).unwrap_or_default(),
        min_price_base: Decimal::from_f64_retain(row.min_price_base).unwrap_or_default(),
        max_quantity: row.max_quantity,
        max_quantity_unit_id: row.max_quantity_unit_id,
        currency: row.currency,
    })
}

pub fn row_to_unit(row: MaterialUnitRow) -> Result<MaterialUnit, AppError> {
    Ok(MaterialUnit {
        id: MaterialUnitId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        material_id: MaterialId(Uuid::parse_str(&row.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        conversion_factor: Decimal::from_str(&row.conversion_factor).unwrap_or_else(|_| Decimal::from(1)),
        barcode: row.barcode,
        is_base: row.is_base,
    })
}
