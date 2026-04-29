use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use super::models::CategoryRow;
use super::mappers::row_to_category;

pub async fn find_by_id(pool: &SqlitePool, id: &MaterialCategoryId) -> Result<Option<MaterialCategory>, AppError> {
    let row = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
         FROM categories WHERE id = ?",
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_category).transpose()
}

pub async fn find_by_name(pool: &SqlitePool, name: &str) -> Result<Option<MaterialCategory>, AppError> {
    let row = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
         FROM categories WHERE name = ?",
    )
    .bind(name)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_category).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<MaterialCategory>, AppError> {
    let rows = sqlx::query_as::<_, CategoryRow>(
        "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
         FROM categories
         ORDER BY
           CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
           name",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_category).collect()
}

pub async fn count_materials_in_category(pool: &SqlitePool, id: &MaterialCategoryId) -> Result<u64, AppError> {
    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM material_categories WHERE category_id = ?")
            .bind(id.to_string())
            .fetch_one(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(row.0 as u64)
}
