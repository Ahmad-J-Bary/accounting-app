use crate::bootstrap::container::AppState;
use application::use_cases::partner::{
    CreatePartnerUseCase, PartnerQueries, UpdatePartnerUseCase, UpdatePartnerRequest, DeletePartnerUseCase, PartnerDto
};
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
) -> Result<String, String> {
    let rate = Decimal::from_str(&exchange_rate).map_err(|e| e.to_string())?;
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    let ratio = manual_ratio.and_then(|r| Decimal::from_str(&r).ok());

    CreatePartnerUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        state.uow.clone(),
    ).execute(
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
    PartnerQueries::new(state.partner_repo.clone())
        .list_partners()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_partner(
    state: State<'_, AppState>,
    id: String
) -> Result<(), String> {
    DeletePartnerUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.uow.clone(),
    ).execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_partner(
    state: State<'_, AppState>,
    id: String,
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

    UpdatePartnerUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.uow.clone(),
    ).execute(UpdatePartnerRequest {
        id,
        name,
        exchange_rate: rate,
        amount: amt,
        is_amount_in_usd,
        sharing_type,
        manual_ratio: ratio,
    }).await.map_err(|e| e.to_string())
}
