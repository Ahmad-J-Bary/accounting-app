use application::errors::AppError;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use sqlx::SqlitePool;

pub async fn save(pool: &SqlitePool, category: &MaterialCategory) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO categories (id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(category.id.to_string())
    .bind(&category.name)
    .bind(category.parent_id.as_ref().map(|id| id.to_string()))
    .bind(category.is_active)
    .bind(category.is_hybrid)
    .bind(&category.code_prefix)
    .bind(category.created_at.to_rfc3339())
    .bind(category.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, category: &MaterialCategory) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE categories
         SET name=?, parent_id=?, is_active=?, is_hybrid=?, code_prefix=?, updated_at=?
         WHERE id=?",
    )
    .bind(&category.name)
    .bind(category.parent_id.as_ref().map(|id| id.to_string()))
    .bind(category.is_active)
    .bind(category.is_hybrid)
    .bind(&category.code_prefix)
    .bind(category.updated_at.to_rfc3339())
    .bind(category.id.to_string())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &MaterialCategoryId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn reassign_materials(
    pool: &SqlitePool,
    from: &MaterialCategoryId,
    to: &MaterialCategoryId,
) -> Result<u64, AppError> {
    let result =
        sqlx::query("UPDATE material_categories SET category_id = ? WHERE category_id = ?")
            .bind(to.to_string())
            .bind(from.to_string())
            .execute(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(result.rows_affected())
}
