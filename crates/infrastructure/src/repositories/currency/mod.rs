use application::errors::AppError;
use application::ports::currency_repository::CurrencyRepository;
use async_trait::async_trait;
use domain::shared::currency::Currency;
use sqlx::{Row, SqlitePool};
use std::sync::Arc;

pub struct SqliteCurrencyRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCurrencyRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CurrencyRepository for SqliteCurrencyRepository {
    async fn save(&self, currency: &Currency) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO currencies (code, name_ar, name_en, symbol, decimals, is_base, is_active, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(code) DO UPDATE SET
               name_ar = excluded.name_ar,
               name_en = excluded.name_en,
               symbol = excluded.symbol,
               decimals = excluded.decimals,
               is_base = excluded.is_base,
               is_active = excluded.is_active,
               notes = excluded.notes"
        )
        .bind(&currency.code)
        .bind(&currency.name_ar)
        .bind(&currency.name_en)
        .bind(&currency.symbol)
        .bind(currency.decimals)
        .bind(currency.is_base)
        .bind(currency.is_active)
        .bind(&currency.notes)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn set_base_currency(&self, code: &str) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query("UPDATE currencies SET is_base = 0")
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query("UPDATE currencies SET is_base = 1, is_active = 1 WHERE code = ?")
            .bind(code)
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_code(&self, code: &str) -> Result<Option<Currency>, AppError> {
        let row = sqlx::query(
            "SELECT code, name_ar, name_en, symbol, decimals, is_base, is_active, notes FROM currencies WHERE code = ?"
        )
        .bind(code)
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(row.map(|r| Currency {
            code: r.get("code"),
            name_ar: r.get("name_ar"),
            name_en: r.get("name_en"),
            symbol: r.get("symbol"),
            decimals: r.get::<i32, _>("decimals"),
            is_base: r.get("is_base"),
            is_active: r.get("is_active"),
            notes: r.get("notes"),
        }))
    }

    async fn list_all(&self) -> Result<Vec<Currency>, AppError> {
        let rows = sqlx::query(
            "SELECT code, name_ar, name_en, symbol, decimals, is_base, is_active, notes FROM currencies ORDER BY is_base DESC, code ASC"
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| Currency {
                code: r.get("code"),
                name_ar: r.get("name_ar"),
                name_en: r.get("name_en"),
                symbol: r.get("symbol"),
                decimals: r.get::<i32, _>("decimals"),
                is_base: r.get("is_base"),
                is_active: r.get("is_active"),
                notes: r.get("notes"),
            })
            .collect())
    }

    async fn list_active(&self) -> Result<Vec<Currency>, AppError> {
        let rows = sqlx::query(
            "SELECT code, name_ar, name_en, symbol, decimals, is_base, is_active, notes FROM currencies WHERE is_active = 1 ORDER BY is_base DESC, code ASC"
        )
        .fetch_all(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|r| Currency {
                code: r.get("code"),
                name_ar: r.get("name_ar"),
                name_en: r.get("name_en"),
                symbol: r.get("symbol"),
                decimals: r.get::<i32, _>("decimals"),
                is_base: r.get("is_base"),
                is_active: r.get("is_active"),
                notes: r.get("notes"),
            })
            .collect())
    }

    async fn get_base_currency(&self) -> Result<Option<Currency>, AppError> {
        let row = sqlx::query(
            "SELECT code, name_ar, name_en, symbol, decimals, is_base, is_active, notes FROM currencies WHERE is_base = 1 LIMIT 1"
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(row.map(|r| Currency {
            code: r.get("code"),
            name_ar: r.get("name_ar"),
            name_en: r.get("name_en"),
            symbol: r.get("symbol"),
            decimals: r.get::<i32, _>("decimals"),
            is_base: r.get("is_base"),
            is_active: r.get("is_active"),
            notes: r.get("notes"),
        }))
    }

    async fn delete(&self, code: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE currencies SET is_active = 0 WHERE code = ?")
            .bind(code)
            .execute(self.pool.as_ref())
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
