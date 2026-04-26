use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::material_repository::MaterialRepository;
use domain::inventory::material::Material;
use domain::shared::ids::{MaterialId, MaterialCategoryId};
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use domain::shared::money::Money;

pub struct SqliteMaterialRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteMaterialRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct MaterialRow {
    id: String,
    name: String,
    barcode: String,
    code: String,
    purchase_price: Option<String>,
    retail_price: Option<String>,
    wholesale_price: Option<String>,
    semi_wholesale_price: Option<String>,
    minimum_stock: String,
    is_active: bool,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

async fn get_category_ids(pool: &SqlitePool, material_id: &str) -> Result<Vec<MaterialCategoryId>, AppError> {
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

async fn save_category_links(pool: &SqlitePool, material_id: &str, category_ids: &[MaterialCategoryId]) -> Result<(), AppError> {
    // Delete existing links
    sqlx::query("DELETE FROM material_categories WHERE material_id = ?")
        .bind(material_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    // Insert new links
    for cid in category_ids {
        sqlx::query(
            "INSERT INTO material_categories (material_id, category_id) VALUES (?, ?)"
        )
        .bind(material_id)
        .bind(cid.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

fn row_to_material(row: MaterialRow, category_ids: Vec<MaterialCategoryId>) -> Result<Material, AppError> {
    let parse_money = |s: Option<String>| s.and_then(|v| Decimal::from_str(&v).ok().map(Money::syp));

    Ok(Material {
        id: MaterialId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        barcode: row.barcode,
        code: row.code,
        purchase_price: parse_money(row.purchase_price),
        retail_price: parse_money(row.retail_price),
        wholesale_price: parse_money(row.wholesale_price),
        semi_wholesale_price: parse_money(row.semi_wholesale_price),
        minimum_stock: Decimal::from_str(&row.minimum_stock).unwrap_or(Decimal::ZERO),
        is_active: row.is_active,
        notes: row.notes,
        category_ids,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}

#[async_trait]
impl MaterialRepository for SqliteMaterialRepository {
    async fn save(&self, material: &Material) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "INSERT INTO materials (id, name, barcode, code, purchase_price, retail_price, wholesale_price, semi_wholesale_price, minimum_stock, is_active, notes, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(material.id.to_string())
        .bind(&material.name)
        .bind(&material.barcode)
        .bind(&material.code)
        .bind(material.purchase_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.retail_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.minimum_stock.to_string())
        .bind(material.is_active)
        .bind(&material.notes)
        .bind(material.created_at.to_rfc3339())
        .bind(material.updated_at.to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        save_category_links(&self.pool, &material.id.to_string(), &material.category_ids).await?;

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &MaterialId) -> Result<Option<Material>, AppError> {
        let row = sqlx::query_as::<_, MaterialRow>(
            "SELECT * FROM materials WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(r) = row {
            let cat_ids = get_category_ids(&self.pool, &r.id).await?;
            Ok(Some(row_to_material(r, cat_ids)?))
        } else {
            Ok(None)
        }
    }

    async fn find_by_code_or_barcode(&self, code_or_barcode: &str) -> Result<Option<Material>, AppError> {
        let row = sqlx::query_as::<_, MaterialRow>(
            "SELECT * FROM materials WHERE code = ? OR barcode = ?"
        )
        .bind(code_or_barcode)
        .bind(code_or_barcode)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(r) = row {
            let cat_ids = get_category_ids(&self.pool, &r.id).await?;
            Ok(Some(row_to_material(r, cat_ids)?))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<Material>, AppError> {
        let rows = sqlx::query_as::<_, MaterialRow>(
            "SELECT * FROM materials ORDER BY name"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut materials = vec![];
        for r in rows {
            let cat_ids = get_category_ids(&self.pool, &r.id).await?;
            materials.push(row_to_material(r, cat_ids)?);
        }
        Ok(materials)
    }

    async fn update(&self, material: &Material) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "UPDATE materials SET name=?, barcode=?, code=?, purchase_price=?, retail_price=?, wholesale_price=?, semi_wholesale_price=?, minimum_stock=?, is_active=?, notes=?, updated_at=? 
             WHERE id=?"
        )
        .bind(&material.name)
        .bind(&material.barcode)
        .bind(&material.code)
        .bind(material.purchase_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.retail_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.semi_wholesale_price.as_ref().map(|m| m.amount().to_string()))
        .bind(material.minimum_stock.to_string())
        .bind(material.is_active)
        .bind(&material.notes)
        .bind(material.updated_at.to_rfc3339())
        .bind(material.id.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        save_category_links(&self.pool, &material.id.to_string(), &material.category_ids).await?;

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &MaterialId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM materials WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
