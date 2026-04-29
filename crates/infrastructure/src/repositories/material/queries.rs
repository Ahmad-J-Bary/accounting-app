use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::material::Material;
use domain::shared::ids::{MaterialId, MaterialCategoryId};
use uuid::Uuid;
use super::models::MaterialRow;
use super::mappers::row_to_material;

pub async fn find_by_id(pool: &SqlitePool, id: &MaterialId) -> Result<Option<Material>, AppError> {
    let row = sqlx::query_as::<_, MaterialRow>(
        "SELECT id, name, barcode, code, minimum_stock, is_active, created_at, updated_at FROM materials WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        Ok(Some(row_to_material(r, cat_ids)?))
    } else {
        Ok(None)
    }
}

pub async fn find_by_code_or_barcode(pool: &SqlitePool, code_or_barcode: &str) -> Result<Option<Material>, AppError> {
    let row = sqlx::query_as::<_, MaterialRow>(
        "SELECT id, name, barcode, code, minimum_stock, is_active, created_at, updated_at FROM materials WHERE code = ? OR barcode = ?"
    )
    .bind(code_or_barcode)
    .bind(code_or_barcode)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        Ok(Some(row_to_material(r, cat_ids)?))
    } else {
        Ok(None)
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Material>, AppError> {
    let rows = sqlx::query_as::<_, MaterialRow>(
        "SELECT id, name, barcode, code, minimum_stock, is_active, created_at, updated_at FROM materials ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut materials = vec![];
    for r in rows {
        let cat_ids = get_category_ids(pool, &r.id).await?;
        materials.push(row_to_material(r, cat_ids)?);
    }
    Ok(materials)
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
