use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::partner::{Partner};
use domain::shared::ids::{PartnerId};
use super::models::PartnerRow;
use super::mappers::row_to_partner;

pub async fn find_by_id(pool: &SqlitePool, id: &PartnerId) -> Result<Option<Partner>, AppError> {
    let row = sqlx::query_as::<_, PartnerRow>("SELECT * FROM partners WHERE id = ?")
        .bind(id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_partner).transpose()
}

pub async fn list_all(pool: &SqlitePool, _include_inactive: bool) -> Result<Vec<Partner>, AppError> {
    let rows = sqlx::query_as::<_, PartnerRow>("SELECT * FROM partners ORDER BY name ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_partner).collect()
}
