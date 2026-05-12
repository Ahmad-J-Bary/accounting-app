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
        is_active: row.is_active,
        category_ids,
        notes: row.notes,
        image_path: row.image_path,
        default_purchase_unit_id: row.default_purchase_unit_id.and_then(|id| Uuid::parse_str(&id).ok().map(MaterialUnitId)),
        default_sale_unit_id: row.default_sale_unit_id.and_then(|id| Uuid::parse_str(&id).ok().map(MaterialUnitId)),
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
        price_usd: Decimal::from_f64_retain(row.price_usd).unwrap_or_default(),
        price_syp: Decimal::from_f64_retain(row.price_syp).unwrap_or_default(),
    })
}

pub fn row_to_sale_price(row: MaterialSalePriceRow) -> Result<MaterialSalePrice, AppError> {
    Ok(MaterialSalePrice {
        id: row.id,
        unit_id: MaterialUnitId(Uuid::parse_str(&row.unit_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        tier: row.tier,
        price_usd: Decimal::from_f64_retain(row.price_usd).unwrap_or_default(),
        price_syp: Decimal::from_f64_retain(row.price_syp).unwrap_or_default(),
        min_price_usd: Decimal::from_f64_retain(row.min_price_usd).unwrap_or_default(),
        min_price_syp: Decimal::from_f64_retain(row.min_price_syp).unwrap_or_default(),
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
