use domain::accounting::partner::{Partner, ProfitSharingType};
use domain::shared::ids::{PartnerId, AccountId};
use application::ports::partner_repository::PartnerRepository;
use application::errors::AppError;
use crate::db::pool::DbPool;
use async_trait::async_trait;
use rust_decimal::Decimal;
use std::str::FromStr;
use sqlx::{sqlite::SqliteRow, Row};

pub struct SqlitePartnerRepository {
    pool: DbPool,
}

impl SqlitePartnerRepository {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PartnerRepository for SqlitePartnerRepository {
    async fn find_by_id(&self, id: &PartnerId) -> Result<Option<Partner>, AppError> {
        let row = sqlx::query("SELECT * FROM partners WHERE id = ?")
            .bind(id.0 as i64)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e: sqlx::Error| AppError::Infrastructure(e.to_string()))?;

        match row {
            Some(row) => Ok(Some(self.map_row_to_partner(row)?)),
            None => Ok(None),
        }
    }

    async fn list_all(&self, _include_inactive: bool) -> Result<Vec<Partner>, AppError> {
        let rows = sqlx::query("SELECT * FROM partners ORDER BY name ASC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e: sqlx::Error| AppError::Infrastructure(e.to_string()))?;

        let mut partners = Vec::new();
        for row in rows {
            partners.push(self.map_row_to_partner(row)?);
        }
        Ok(partners)
    }

    async fn save(&self, partner: &Partner) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO partners (name, exchange_rate, amount_local, amount_usd, is_amount_in_usd, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&partner.name)
        .bind(partner.exchange_rate.to_string())
        .bind(partner.amount_local.to_string())
        .bind(partner.amount_usd.to_string())
        .bind(partner.is_amount_in_usd)
        .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
        .bind(match partner.profit_sharing_type {
            ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
            ProfitSharingType::BasedOnCapitalUSD => "BasedOnCapitalUSD",
            ProfitSharingType::Manual => "Manual",
        })
        .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
        .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
        .bind(partner.created_at)
        .bind(partner.updated_at)
        .execute(&*self.pool)
        .await
        .map_err(|e: sqlx::Error| AppError::Infrastructure(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, partner: &Partner) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE partners SET name = ?, exchange_rate = ?, amount_local = ?, amount_usd = ?, is_amount_in_usd = ?, profit_sharing_ratio = ?, profit_sharing_type = ?, linked_account_id = ?, drawings_account_id = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&partner.name)
        .bind(partner.exchange_rate.to_string())
        .bind(partner.amount_local.to_string())
        .bind(partner.amount_usd.to_string())
        .bind(partner.is_amount_in_usd)
        .bind(partner.profit_sharing_ratio.as_ref().map(|r| r.to_string()))
        .bind(match partner.profit_sharing_type {
            ProfitSharingType::BasedOnCapitalLocal => "BasedOnCapitalLocal",
            ProfitSharingType::BasedOnCapitalUSD => "BasedOnCapitalUSD",
            ProfitSharingType::Manual => "Manual",
        })
        .bind(partner.linked_account_id.as_ref().map(|id| id.to_string()))
        .bind(partner.drawings_account_id.as_ref().map(|id| id.to_string()))
        .bind(partner.updated_at)
        .bind(partner.id.0 as i64)
        .execute(&*self.pool)
        .await
        .map_err(|e: sqlx::Error| AppError::Infrastructure(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, id: &PartnerId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM partners WHERE id = ?")
            .bind(id.0 as i64)
            .execute(&*self.pool)
            .await
            .map_err(|e: sqlx::Error| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl SqlitePartnerRepository {
    fn map_row_to_partner(&self, row: SqliteRow) -> Result<Partner, AppError> {
        let sharing_type_str: String = row.get("profit_sharing_type");
        let sharing_type = match sharing_type_str.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalUSD" => ProfitSharingType::BasedOnCapitalUSD,
            "Manual" => ProfitSharingType::Manual,
            _ => ProfitSharingType::Manual,
        };

        Ok(Partner {
            id: PartnerId(row.get::<i64, _>("id") as u64),
            name: row.get("name"),
            exchange_rate: Decimal::from_str(&row.get::<String, _>("exchange_rate")).unwrap_or_default(),
            amount_local: Decimal::from_str(&row.get::<String, _>("amount_local")).unwrap_or_default(),
            amount_usd: Decimal::from_str(&row.get::<String, _>("amount_usd")).unwrap_or_default(),
            is_amount_in_usd: row.get("is_amount_in_usd"),
            profit_sharing_ratio: row.get::<Option<String>, _>("profit_sharing_ratio")
                .and_then(|r| Decimal::from_str(&r).ok()),
            profit_sharing_type: sharing_type,
            linked_account_id: row.get::<Option<String>, _>("linked_account_id")
                .and_then(|id| AccountId::from_str(&id).ok()),
            drawings_account_id: row.get::<Option<String>, _>("drawings_account_id")
                .and_then(|id| AccountId::from_str(&id).ok()),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}
