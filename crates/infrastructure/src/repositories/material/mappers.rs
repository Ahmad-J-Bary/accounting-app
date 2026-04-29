use application::errors::AppError;
use domain::inventory::material::Material;
use domain::shared::ids::{MaterialId, MaterialCategoryId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::MaterialRow;

pub fn row_to_material(row: MaterialRow, category_ids: Vec<MaterialCategoryId>) -> Result<Material, AppError> {
    Ok(Material {
        id: MaterialId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        barcode: row.barcode.unwrap_or_default(),
        code: row.code.unwrap_or_default(),
        minimum_stock: Decimal::from_str(&row.minimum_stock).unwrap_or_default(),
        is_active: row.is_active,
        category_ids,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
