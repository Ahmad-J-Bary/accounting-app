use super::models::CategoryRow;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use uuid::Uuid;

pub fn row_to_category(row: CategoryRow) -> Result<MaterialCategory, AppError> {
    Ok(MaterialCategory {
        id: MaterialCategoryId(
            Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        name: row.name,
        parent_id: row
            .parent_id
            .and_then(|pid| Uuid::parse_str(&pid).ok().map(MaterialCategoryId)),
        is_active: row.is_active,
        is_hybrid: row.is_hybrid.unwrap_or(false),
        code_prefix: row.code_prefix,
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}
