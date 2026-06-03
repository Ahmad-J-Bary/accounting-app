use sqlx::SqlitePool;
use application::errors::AppError;
use application::dto::stock_dto::StockMovementDetailDto;
use domain::inventory::stock_movement::StockMovement;
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use super::models::StockMovementRow;
use super::mappers::row_to_movement;

pub async fn find_by_id(pool: &SqlitePool, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
    let row = sqlx::query_as::<_, StockMovementRow>(
        "SELECT id, material_id, quantity, unit_cost, unit_cost_base, total_cost, total_cost_base, raw_total_cost_base, original_currency, fx_rate, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_movement).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>("SELECT id, material_id, quantity, unit_cost, unit_cost_base, total_cost, total_cost_base, raw_total_cost_base, original_currency, fx_rate, movement_type, reason, reference, movement_date, created_at FROM stock_movements ORDER BY movement_date DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_movement).collect()
}

pub async fn list_by_material(pool: &SqlitePool, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError> {
    let rows = sqlx::query_as::<_, StockMovementRow>(
        "SELECT id, material_id, quantity, unit_cost, unit_cost_base, total_cost, total_cost_base, raw_total_cost_base, original_currency, fx_rate, movement_type, reason, reference, movement_date, created_at FROM stock_movements WHERE material_id = ? ORDER BY movement_date DESC"
    )
    .bind(material_id.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_movement).collect()
}

pub async fn get_stock_balance(pool: &SqlitePool, material_id: &MaterialId) -> Result<Decimal, AppError> {
    let movements = list_by_material(pool, material_id).await?;
    let mut balance = Decimal::ZERO;
    for m in movements {
        if m.is_inflow() {
            balance += m.quantity;
        } else if m.is_outflow() {
            balance -= m.quantity;
        }
    }
    Ok(balance)
}

pub async fn get_material_summary(pool: &SqlitePool, material_id: &MaterialId) -> Result<application::ports::stock_movement_repository::MaterialInventorySummary, AppError> {
    let movements = list_by_material(pool, material_id).await?;
    
    let mut total_received = Decimal::ZERO;
    let mut total_sold = Decimal::ZERO;
    let mut total_damaged = Decimal::ZERO;
    let mut total_available = Decimal::ZERO;
    let mut total_inflow_cost = Decimal::ZERO;
    let mut total_inflow_cost_base = Decimal::ZERO;
    let mut total_raw_inflow_cost_base = Decimal::ZERO;
    
    let mut last_purchase_price = Decimal::ZERO;
    let mut last_purchase_price_base = Decimal::ZERO;
    let mut last_sale_price = Decimal::ZERO;
    let mut last_sale_price_base = Decimal::ZERO;

    // movements are ordered by date DESC
    let mut found_last_purchase = false;
    let mut found_last_sale = false;

    for m in &movements {
        if m.is_inflow() {
            if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::SalesReturn) {
                // SalesReturn increases physical stock but NOT received/purchased quantity
                total_available += m.quantity;
            } else {
                total_available += m.quantity;
                total_received += m.quantity;
                total_inflow_cost += m.total_cost;
                total_inflow_cost_base += m.total_cost_base;
                total_raw_inflow_cost_base += m.raw_total_cost_base;
            }
            
            if !found_last_purchase && (
                matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Purchase) || 
                matches!(m.movement_type, domain::inventory::stock_movement::MovementType::In) ||
                matches!(m.movement_type, domain::inventory::stock_movement::MovementType::OpeningBalance)
            ) {
                last_purchase_price = m.unit_cost;
                last_purchase_price_base = m.unit_cost_base;
                found_last_purchase = true;
            }
        } else if m.is_outflow() {
            total_available -= m.quantity;
            
            if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Sale) {
                total_sold += m.quantity;
                if !found_last_sale {
                    last_sale_price = m.unit_cost;
                    last_sale_price_base = m.unit_cost_base;
                    found_last_sale = true;
                }
            } else if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Damaged) {
                total_damaged += m.quantity;
            } else if matches!(m.movement_type, domain::inventory::stock_movement::MovementType::PurchaseReturn) {
                // PurchaseReturn: goods returned to supplier, reduce received count & costs
                total_received -= m.quantity;
                total_inflow_cost -= m.total_cost;
                total_inflow_cost_base -= m.total_cost_base;
                total_raw_inflow_cost_base -= m.raw_total_cost_base;
            }
        }
    }

    let average_cost = if total_received > Decimal::ZERO {
        total_inflow_cost / total_received
    } else {
        Decimal::ZERO
    };

    let average_cost_base = if total_received > Decimal::ZERO {
        total_inflow_cost_base / total_received
    } else {
        Decimal::ZERO
    };

    let average_raw_price_base = if total_received > Decimal::ZERO {
        total_raw_inflow_cost_base / total_received
    } else {
        Decimal::ZERO
    };

    Ok(application::ports::stock_movement_repository::MaterialInventorySummary {
        total_received,
        total_sold,
        total_available,
        total_damaged,
        last_purchase_price,
        last_purchase_price_base,
        last_sale_price,
        last_sale_price_base,
        average_cost,
        average_cost_base,
        average_raw_price_base,
    })
}

// Row struct for the enriched detail query (JOINed with invoices + parties)
#[derive(sqlx::FromRow)]
pub struct MovementDetailRow {
    pub id: String,
    pub material_id: String,
    pub movement_type: String,
    pub quantity: String,
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub original_currency: Option<String>,
    pub fx_rate: String,
    pub reference: Option<String>,
    pub reason: Option<String>,
    pub movement_date: String,
    pub invoice_number: Option<String>,
    pub invoice_type: Option<String>,
    pub customer_name: Option<String>,
    pub supplier_name: Option<String>,
}

fn movement_type_label(t: &str) -> String {
    match t {
        "Purchase" | "MovementType::Purchase" => "شراء".to_string(),
        "Sale"     | "MovementType::Sale"     => "بيع".to_string(),
        "OpeningBalance" | "MovementType::OpeningBalance" => "بضاعة أول المدة".to_string(),
        "In"       | "MovementType::In"       => "إدخال".to_string(),
        "Out"      | "MovementType::Out"      => "إخراج".to_string(),
        "Damaged"  | "MovementType::Damaged"  => "تالف".to_string(),
        "Adjustment"| "MovementType::Adjustment" => "تسوية".to_string(),
        "Transfer" | "MovementType::Transfer" => "تحويل".to_string(),
        "SalesReturn" | "MovementType::SalesReturn" => "مرتجع مبيعات".to_string(),
        "PurchaseReturn" | "MovementType::PurchaseReturn" => "مرتجع مشتريات".to_string(),
        _ => t.to_string(),
    }
}

fn movement_type_is_inflow(t: &str) -> bool {
    matches!(t, "Purchase" | "MovementType::Purchase"
             | "In" | "MovementType::In"
             | "OpeningBalance" | "MovementType::OpeningBalance"
             | "Transfer" | "MovementType::Transfer"
             | "SalesReturn" | "MovementType::SalesReturn")
}

pub async fn list_detailed_by_material(
    pool: &SqlitePool,
    material_id: &MaterialId,
) -> Result<Vec<StockMovementDetailDto>, AppError> {
    let rows = sqlx::query_as::<_, MovementDetailRow>(
        r#"
        SELECT
            sm.id,
            sm.material_id,
            sm.movement_type,
            sm.quantity,
            sm.unit_cost,
            sm.unit_cost_base,
            sm.total_cost,
            sm.total_cost_base,
            sm.original_currency,
            sm.fx_rate,
            sm.reference,
            sm.reason,
            sm.movement_date,
            ui.invoice_number,
            ui.invoice_type,
            COALESCE(c.name, cr.name) AS customer_name,
            COALESCE(s.name, sr2.name) AS supplier_name
        FROM stock_movements sm
        LEFT JOIN unified_invoices ui ON sm.reference = ui.invoice_number AND (
            (sm.movement_type = 'Purchase' AND ui.invoice_type IN ('Purchase', 'PurchaseCosts')) OR
            (sm.movement_type = 'Sale' AND ui.invoice_type = 'Sales') OR
            (sm.movement_type = 'OpeningBalance' AND ui.invoice_type = 'OpeningBalance')
        )
        LEFT JOIN customers c         ON ui.customer_id  = c.id
        LEFT JOIN suppliers s         ON ui.supplier_id  = s.id
        LEFT JOIN sales_returns sr    ON sm.reference = sr.return_number AND sm.movement_type = 'SalesReturn'
        LEFT JOIN customers cr        ON sr.customer_id = cr.id
        LEFT JOIN purchase_returns pr ON sm.reference = pr.return_number AND sm.movement_type = 'PurchaseReturn'
        LEFT JOIN suppliers sr2       ON pr.supplier_id = sr2.id
        WHERE sm.material_id = ?
        ORDER BY sm.movement_date ASC, sm.created_at ASC
        "#
    )
    .bind(material_id.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    // Compute running balance (ASC order)
    let mut balance = Decimal::ZERO;
    let mut result = Vec::with_capacity(rows.len());

    for row in rows {
        let qty: Decimal = row.quantity.parse().unwrap_or(Decimal::ZERO);
        let inflow = movement_type_is_inflow(&row.movement_type);

        let balance_before = balance;
        if inflow {
            balance += qty;
        } else {
            balance -= qty;
        }
        let balance_after = balance;

        let party_name = row.customer_name.or(row.supplier_name);
        let label = movement_type_label(&row.movement_type);
        let ref_str = row.reference.clone().unwrap_or_default();

        result.push(StockMovementDetailDto {
            id: row.id,
            material_id: row.material_id,
            movement_type: row.movement_type.replace("MovementType::", ""),
            movement_type_label: label,
            quantity: qty.to_string(),
            unit_cost: row.unit_cost,
            unit_cost_base: row.unit_cost_base,
            total_cost: row.total_cost,
            total_cost_base: row.total_cost_base,
            currency: row.original_currency,
            fx_rate: row.fx_rate,
            reference: ref_str,
            notes: row.reason.unwrap_or_default(),
            movement_date: row.movement_date,
            invoice_number: row.invoice_number,
            invoice_type: row.invoice_type,
            party_name,
            balance_before: balance_before.to_string(),
            balance_after: balance_after.to_string(),
            is_inflow: inflow,
        });
    }

    Ok(result)
}
