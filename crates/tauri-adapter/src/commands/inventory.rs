use crate::bootstrap::container::AppState;
use application::dto::stock_dto::{StockMovementDto, StockMovementDetailDto};
use tauri::State;

#[tauri::command]
pub async fn list_stock_movements(
    state: State<'_, AppState>,
) -> Result<Vec<StockMovementDto>, String> {
    let movements = state.stock_movement_repo
        .list_all()
        .await
        .map_err(|e| e.to_string())?;

    Ok(movements.into_iter().map(|m| StockMovementDto {
        id: m.id.to_string(),
        material_id: m.material_id.to_string(),
        material_name: None,
        quantity: m.quantity.to_string(),
        movement_type: format!("{:?}", m.movement_type),
        reason: if m.notes.is_empty() { None } else { Some(m.notes) },
        reference: if m.reference.is_empty() { None } else { Some(m.reference) },
        movement_date: m.movement_date.to_rfc3339(),
        created_at: m.created_at.to_rfc3339(),
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
