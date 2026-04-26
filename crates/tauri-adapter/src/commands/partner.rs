use crate::bootstrap::container::AppState;
use application::use_cases::partner_use_cases::PartnerDto;
use rust_decimal::Decimal;
use tauri::State;
use std::str::FromStr;

#[tauri::command]
pub async fn add_partner(
    state: State<'_, AppState>,
    name: String,
    exchange_rate: String,
    amount: String,
    is_amount_in_usd: bool,
    sharing_type: String,
    manual_ratio: Option<String>,
) -> Result<u64, String> {
    let rate = Decimal::from_str(&exchange_rate).map_err(|e| e.to_string())?;
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    let ratio = manual_ratio.and_then(|r| Decimal::from_str(&r).ok());

    state.partner_use_cases.add_partner(
        name,
        rate,
        amt,
        is_amount_in_usd,
        sharing_type,
        ratio
    ).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_partners(
    state: State<'_, AppState>
) -> Result<Vec<PartnerDto>, String> {
    state.partner_use_cases.list_partners().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_partner(
    state: State<'_, AppState>,
    id: u64
) -> Result<(), String> {
    state.partner_use_cases.delete_partner(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_partner(
    state: State<'_, AppState>,
    id: u64,
    name: String,
    exchange_rate: String,
    amount: String,
    is_amount_in_usd: bool,
    sharing_type: String,
    manual_ratio: Option<String>,
) -> Result<(), String> {
    let rate = Decimal::from_str(&exchange_rate).map_err(|e| e.to_string())?;
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    let ratio = manual_ratio.and_then(|r| Decimal::from_str(&r).ok());

    state.partner_use_cases.update_partner(
        id,
        name,
        rate,
        amt,
        is_amount_in_usd,
        sharing_type,
        ratio
    ).await.map_err(|e| e.to_string())
}
