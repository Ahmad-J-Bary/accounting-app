use sqlx::SqlitePool;
use application::errors::AppError;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;

pub async fn save(pool: &SqlitePool, ret: &PurchaseReturn) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO purchase_returns (id, return_number, supplier_id, return_date, total_amount, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            return_number=excluded.return_number,
            supplier_id=excluded.supplier_id,
            return_date=excluded.return_date,
            total_amount=excluded.total_amount,
            notes=excluded.notes,
            updated_at=excluded.updated_at"
    )
    .bind(ret.id.0.to_string())
    .bind(&ret.return_number)
    .bind(ret.supplier_id.0.to_string())
    .bind(ret.return_date.to_rfc3339())
    .bind(ret.total_amount.to_string())
    .bind(&ret.notes)
    .bind(ret.created_at.to_rfc3339())
    .bind(ret.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query("DELETE FROM purchase_return_lines WHERE purchase_return_id = ?")
        .bind(ret.id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for line in &ret.lines {
        sqlx::query(
            "INSERT INTO purchase_return_lines (id, purchase_return_id, material_id, quantity, unit_price, unit_id, line_total, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(line.id.to_string())
        .bind(ret.id.0.to_string())
        .bind(line.material_id.0.to_string())
        .bind(line.quantity.to_string())
        .bind(line.unit_price.to_string())
        .bind(&line.unit_id)
        .bind(line.line_total.to_string())
        .bind(&line.notes)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &PurchaseReturnId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM purchase_returns WHERE id = ?")
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
