use crate::bootstrap::container::AppState;
use application::dto::inventory_lot_dto::InventoryLotDto;
use application::dto::stock_dto::{StockMovementDetailDto, StockMovementDto};
use serde::Serialize;
use tauri::State;

#[tauri::command]
pub async fn list_stock_movements(
    state: State<'_, AppState>,
) -> Result<Vec<StockMovementDto>, String> {
    let movement_tuples = state
        .stock_movement_repo
        .list_all_with_material_names()
        .await
        .map_err(|e| e.to_string())?;

    let doc_numbers: Vec<String> = movement_tuples
        .iter()
        .filter_map(|(_, doc_num)| doc_num.clone())
        .collect();

    let mut seen = std::collections::HashSet::new();
    let unique_docs: Vec<String> = doc_numbers
        .into_iter()
        .filter(|d| seen.insert(d.clone()))
        .collect();

    let source_ids = state
        .stock_movement_repo
        .resolve_source_document_ids(&unique_docs)
        .await
        .unwrap_or_default();

    Ok(movement_tuples
        .into_iter()
        .map(|(mut m, doc_num)| {
            if let Some(ref dn) = doc_num {
                if !dn.is_empty() {
                    m.source_document_id = source_ids.get(dn).cloned();
                }
            } else {
                let ref_key = m.reference.clone().unwrap_or_default();
                if !ref_key.is_empty() {
                    m.source_document_id = source_ids.get(&ref_key).cloned();
                }
            }
            m
        })
        .collect())
}

#[tauri::command]
pub async fn list_movements_by_material(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<StockMovementDetailDto>, String> {
    let mid = material_id
        .parse()
        .map_err(|_| "معرّف المادة غير صالح".to_string())?;

    state
        .stock_movement_repo
        .list_detailed_by_material(&mid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material_available_lots(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<InventoryLotDto>, String> {
    let lots = state
        .inventory_lot_repo
        .find_available_by_material(&material_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(lots.into_iter().map(InventoryLotDto::from).collect())
}

#[tauri::command]
pub async fn get_stock_balance(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<String, String> {
    let mid = material_id
        .parse()
        .map_err(|_| "معرّف المادة غير صالح".to_string())?;
    let balance = state
        .stock_movement_repo
        .get_stock_balance(&mid)
        .await
        .map_err(|e| e.to_string())?;
    Ok(balance.to_string())
}

#[tauri::command]
pub async fn get_material_costing_method(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<String, String> {
    state
        .inventory_lot_repo
        .get_costing_method(&material_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material_lots(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<InventoryLotDto>, String> {
    let lots = state
        .inventory_lot_repo
        .find_by_material(&material_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(lots
        .into_iter()
        .filter(|l| l.quantity_remaining > rust_decimal::Decimal::ZERO)
        .map(InventoryLotDto::from)
        .collect())
}

#[tauri::command]
pub async fn update_lot_sale_prices(
    state: State<'_, AppState>,
    lot_id: String,
    retail_price_base: Option<String>,
    semi_wholesale_price_base: Option<String>,
    wholesale_price_base: Option<String>,
) -> Result<(), String> {
    state
        .inventory_lot_repo
        .update_sale_prices(
            &lot_id,
            retail_price_base.as_deref(),
            semi_wholesale_price_base.as_deref(),
            wholesale_price_base.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct PriceHistoryEntry {
    pub price_base: String,
    pub invoice_number: Option<String>,
    pub purchase_date: Option<String>,
    pub lot_id: String,
}

#[derive(Serialize)]
pub struct MaterialPriceHistoryResponse {
    pub first_cost_base: Option<String>,
    pub average_cost_base: String,
    pub last_cost_base: Option<String>,
    pub history: Vec<PriceHistoryEntry>,
}

#[tauri::command]
pub async fn get_material_purchase_price_history(
    state: State<'_, AppState>,
    material_id: String,
    unit_id: Option<String>,
) -> Result<MaterialPriceHistoryResponse, String> {
    let mid = material_id
        .parse()
        .map_err(|_| "معرّف المادة غير صالح".to_string())?;
    let material = state
        .material_repo
        .find_by_id(&mid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "المادة غير موجودة".to_string())?;

    let summary = state
        .stock_movement_repo
        .get_material_summary(&mid)
        .await
        .map_err(|e| e.to_string())?;

    let all_lots = state
        .inventory_lot_repo
        .find_by_material(&material_id)
        .await
        .map_err(|e| e.to_string())?;

    let average_cost_base = summary.average_cost_base.to_string();

    let last_cost_base = if let Some(ref uid) = unit_id {
        material
            .purchase_prices
            .iter()
            .find(|p| p.unit_id.to_string() == *uid)
            .map(|p| p.price_base.to_string())
            .or_else(|| all_lots.first().map(|l| l.unit_cost_base.to_string()))
    } else {
        all_lots.first().map(|l| l.unit_cost_base.to_string())
    };

    let first_cost_base = all_lots.last().map(|l| l.unit_cost_base.to_string());

    let history: Vec<PriceHistoryEntry> = all_lots
        .iter()
        .map(|lot| PriceHistoryEntry {
            price_base: lot.unit_cost_base.to_string(),
            invoice_number: None,
            purchase_date: Some(lot.purchase_date.to_rfc3339()),
            lot_id: lot.id.to_string(),
        })
        .collect();

    Ok(MaterialPriceHistoryResponse {
        first_cost_base,
        average_cost_base,
        last_cost_base,
        history,
    })
}
