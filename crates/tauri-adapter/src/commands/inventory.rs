use std::collections::HashMap;
use crate::bootstrap::container::AppState;
use application::dto::stock_dto::{StockMovementDto, StockMovementDetailDto};
use application::dto::inventory_lot_dto::InventoryLotDto;
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

    Ok(movements.into_iter().map(|m| {
        let mat_id = m.material_id.to_string();
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
            reference: if m.reference.is_empty() { None } else { Some(m.reference) },
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
pub async fn get_material_costing_method(
    state: State<'_, AppState>,
    material_id: String,
) -> Result<String, String> {
    state.inventory_lot_repo
        .get_costing_method(&material_id)
        .await
        .map_err(|e| e.to_string())
}
