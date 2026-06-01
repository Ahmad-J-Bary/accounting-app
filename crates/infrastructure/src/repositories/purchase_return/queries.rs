use sqlx::SqlitePool;
use application::errors::AppError;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;
use super::models::{PurchaseReturnRow, PurchaseReturnLineRow};
use super::mappers::row_to_purchase_return;

pub async fn find_by_id(pool: &SqlitePool, id: &PurchaseReturnId) -> Result<Option<PurchaseReturn>, AppError> {
    let row = sqlx::query_as::<_, PurchaseReturnRow>(
        "SELECT id, return_number, supplier_id, return_date, total_amount, notes, created_at, updated_at
         FROM purchase_returns WHERE id = ?"
    )
    .bind(id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    match row {
        Some(r) => {
            let lines = sqlx::query_as::<_, PurchaseReturnLineRow>(
                "SELECT id, purchase_return_id, material_id, quantity, unit_price, unit_id, line_total, notes
                 FROM purchase_return_lines WHERE purchase_return_id = ?"
            )
            .bind(r.id.clone())
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            row_to_purchase_return(r, lines).map(Some)
        }
        None => Ok(None),
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<PurchaseReturn>, AppError> {
    let rows = sqlx::query_as::<_, PurchaseReturnRow>(
        "SELECT id, return_number, supplier_id, return_date, total_amount, notes, created_at, updated_at
         FROM purchase_returns ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut results = Vec::new();
    for r in rows {
        let lines = sqlx::query_as::<_, PurchaseReturnLineRow>(
            "SELECT id, purchase_return_id, material_id, quantity, unit_price, unit_id, line_total, notes
             FROM purchase_return_lines WHERE purchase_return_id = ?"
        )
        .bind(r.id.clone())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        if let Ok(ret) = row_to_purchase_return(r, lines) {
            results.push(ret);
        }
    }
    Ok(results)
}
