use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::category_repository::CategoryRepository;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use std::sync::Arc;
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub struct SqliteCategoryRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCategoryRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct CategoryRow {
    id: String,
    name: String,
    parent_id: Option<String>,
    is_active: bool,
    is_hybrid: Option<bool>,
    code_prefix: Option<String>,
    created_at: String,
    updated_at: String,
}

fn row_to_category(row: CategoryRow) -> Result<MaterialCategory, AppError> {
    Ok(MaterialCategory {
        id: MaterialCategoryId(
            Uuid::parse_str(&row.id)
                .map_err(|e| AppError::Infrastructure(e.to_string()))?,
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

#[async_trait]
impl CategoryRepository for SqliteCategoryRepository {
    async fn save(&self, category: &MaterialCategory) -> Result<(), AppError> {
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
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(
        &self,
        id: &MaterialCategoryId,
    ) -> Result<Option<MaterialCategory>, AppError> {
        let row = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
             FROM categories WHERE id = ?",
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_category).transpose()
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<MaterialCategory>, AppError> {
        let row = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
             FROM categories WHERE name = ?",
        )
        .bind(name)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_category).transpose()
    }

    async fn list_all(&self) -> Result<Vec<MaterialCategory>, AppError> {
        let rows = sqlx::query_as::<_, CategoryRow>(
            "SELECT id, name, parent_id, is_active, is_hybrid, code_prefix, created_at, updated_at
             FROM categories
             ORDER BY
               CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
               name",
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_category).collect()
    }

    async fn update(&self, category: &MaterialCategory) -> Result<(), AppError> {
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
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &MaterialCategoryId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM categories WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn count_materials_in_category(
        &self,
        id: &MaterialCategoryId,
    ) -> Result<u64, AppError> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM material_categories WHERE category_id = ?")
                .bind(id.to_string())
                .fetch_one(&*self.pool)
                .await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(row.0 as u64)
    }
}
