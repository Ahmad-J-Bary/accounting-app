use std::collections::HashMap;
use crate::bootstrap::container::AppState;
use application::dto::stock_dto::{StockMovementDto, StockMovementDetailDto};
use application::dto::inventory_lot_dto::InventoryLotDto;
use serde::Serialize;
use tauri::State;

#[tauri::command]
pub async fn list_stock_movements(
    state: State<'_, AppState>,
) -> Result<Vec<StockMovementDto>, String> {
    let movements = state.stock_movement_repo
        .list_all()
        .await
        .map_err(|e| e.to_string())?;

    let mut material_names: HashMap<String, String> = HashMap::new();
    if let Ok(all_materials) = state.material_repo.list_all().await {
        for mat in all_materials {
            material_names.insert(mat.id.to_string(), mat.name);
        }
    }

    let mut source_ids: HashMap<String, String> = HashMap::new();
    if let Ok(all_invoices) = state.unified_invoice_repo.list_all().await {
        for inv in all_invoices {
            source_ids.insert(inv.invoice_number, inv.id.to_string());
        }
    }
    // Fallback: also look up legacy sales_invoices table
    if let Ok(all_invoices) = state.invoice_repo.list_all().await {
        for inv in all_invoices {
            source_ids.entry(inv.invoice_number).or_insert_with(|| inv.id.to_string());
        }
    }
    if let Ok(all_returns) = state.sales_return_repo.list_all().await {
        for ret in all_returns {
            source_ids.insert(ret.return_number, ret.id.to_string());
        }
    }
    if let Ok(all_returns) = state.purchase_return_repo.list_all().await {
        for ret in all_returns {
            source_ids.insert(ret.return_number, ret.id.to_string());
        }
    }

    Ok(movements.into_iter().map(|m| {
        let mat_id = m.material_id.to_string();
        let doc_num = m.document_number.unwrap_or_else(|| m.reference.clone());
        let ref_str = m.reference.clone();
        let source_document_id = if doc_num.is_empty() {
            None
        } else {
            source_ids.get(&doc_num).cloned()
        };
        StockMovementDto {
            id: m.id.to_string(),
            material_id: mat_id.clone(),
            material_name: material_names.get(&mat_id).cloned(),
            quantity: m.quantity.to_string(),
            movement_type: format!("{:?}", m.movement_type),
            unit_cost: Some(m.unit_cost.to_string()),
            unit_cost_base: Some(m.unit_cost_base.to_string()),
            total_cost: Some(m.total_cost.to_string()),
            total_cost_base: Some(m.total_cost_base.to_string()),
            original_currency: m.original_currency.clone(),
            fx_rate: Some(m.fx_rate.to_string()),
            reason: if m.notes.is_empty() { None } else { Some(m.notes) },
            reference: if ref_str.is_empty() { None } else { Some(ref_str) },
            source_document_id,
            warehouse_id: m.warehouse_id.map(|id| id.to_string()),
            movement_date: m.movement_date.to_rfc3339(),
            created_at: m.created_at.to_rfc3339(),
            signed_quantity: m.signed_quantity.map(|v| v.to_string()),
        }
    }).collect())
}

#[tauri::command]
pub async fn list_movements_by_material(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<StockMovementDetailDto>, String> {
    let mid = material_id.parse()
        .map_err(|_| "معرّف المادة غير صالح".to_string())?;
    
    state.stock_movement_repo
        .list_detailed_by_material(&mid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material_available_lots(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<InventoryLotDto>, String> {
    let lots = state.inventory_lot_repo
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
    let mid = material_id.parse()
        .map_err(|_| "معرّف المادة غير صالح".to_string())?;
    let balance = state.stock_movement_repo
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
    state.inventory_lot_repo
        .get_costing_method(&material_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material_lots(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<Vec<InventoryLotDto>, String> {
    let lots = state.inventory_lot_repo
        .find_by_material(&material_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(lots.into_iter()
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
    state.inventory_lot_repo
        .update_sale_prices(&lot_id, retail_price_base.as_deref(), semi_wholesale_price_base.as_deref(), wholesale_price_base.as_deref())
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
    let mid = material_id.parse().map_err(|_| "معرّف المادة غير صالح".to_string())?;
    let material = state.material_repo.find_by_id(&mid)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "المادة غير موجودة".to_string())?;

    let summary = state.stock_movement_repo
        .get_material_summary(&mid)
        .await
        .map_err(|e| e.to_string())?;

    let all_lots = state.inventory_lot_repo
        .find_by_material(&material_id)
        .await
        .map_err(|e| e.to_string())?;

    let average_cost_base = summary.average_cost_base.to_string();

    let last_cost_base = if let Some(ref uid) = unit_id {
        material.purchase_prices.iter()
            .find(|p| p.unit_id.to_string() == *uid)
            .map(|p| p.price_base.to_string())
            .or_else(|| all_lots.first().map(|l| l.unit_cost_base.to_string()))
    } else {
        all_lots.first().map(|l| l.unit_cost_base.to_string())
    };

    let first_cost_base = all_lots.last().map(|l| l.unit_cost_base.to_string());

    let history: Vec<PriceHistoryEntry> = all_lots.iter().map(|lot| {
        PriceHistoryEntry {
            price_base: lot.unit_cost_base.to_string(),
            invoice_number: None,
            purchase_date: Some(lot.purchase_date.to_rfc3339()),
            lot_id: lot.id.to_string(),
        }
    }).collect();

    Ok(MaterialPriceHistoryResponse {
        first_cost_base,
        average_cost_base,
        last_cost_base,
        history,
    })
}
