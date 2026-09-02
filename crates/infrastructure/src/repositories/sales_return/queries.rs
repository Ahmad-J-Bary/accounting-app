use super::mappers::row_to_sales_return;
use super::models::{SalesReturnLineRow, SalesReturnRow};
use application::errors::AppError;
use domain::returns::SalesReturn;
use domain::shared::ids::SalesReturnId;
use sqlx::SqlitePool;

pub async fn find_by_id(
    pool: &SqlitePool,
    id: &SalesReturnId,
) -> Result<Option<SalesReturn>, AppError> {
    let row = sqlx::query_as::<_, SalesReturnRow>(
        "SELECT id, return_number, customer_id, return_date, total_amount, notes, created_at, updated_at
         FROM sales_returns WHERE id = ?"
    )
    .bind(id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    match row {
        Some(r) => {
            let lines = sqlx::query_as::<_, SalesReturnLineRow>(
                "SELECT id, sales_return_id, material_id, quantity, unit_price, unit_id, line_total, notes, invoice_line_id
                 FROM sales_return_lines WHERE sales_return_id = ?"
            )
            .bind(r.id.clone())
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            row_to_sales_return(r, lines).map(Some)
        }
        None => Ok(None),
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<SalesReturn>, AppError> {
    let rows = sqlx::query_as::<_, SalesReturnRow>(
        "SELECT id, return_number, customer_id, return_date, total_amount, notes, created_at, updated_at
         FROM sales_returns ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut results = Vec::new();
    for r in rows {
        let lines = sqlx::query_as::<_, SalesReturnLineRow>(
            "SELECT id, sales_return_id, material_id, quantity, unit_price, unit_id, line_total, notes, invoice_line_id
             FROM sales_return_lines WHERE sales_return_id = ?"
        )
        .bind(r.id.clone())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        if let Ok(ret) = row_to_sales_return(r, lines) {
            results.push(ret);
        }
    }
    Ok(results)
}
