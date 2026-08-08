use crate::bootstrap::container::AppState;
use application::use_cases::equity::GetPartnerEquityStatementUseCase;
use application::use_cases::partner::{
    CreatePartnerUseCase, CreateCapitalContributionUseCase, CreatePartnerDrawingUseCase,
    CapitalizeRetainedEarningsUseCase, PartnerQueries, UpdatePartnerUseCase, UpdatePartnerRequest, DeletePartnerUseCase, PartnerDto
};
use rust_decimal::Decimal;
use tauri::State;
use std::str::FromStr;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn add_partner(
    state: State<'_, AppState>,
    name: String,
    currency: String,
    exchange_rate: String,
    amount: String,
    is_amount_in_original: bool,
    sharing_type: String,
    manual_ratio: Option<String>,
    accounting_start_mode: String,
) -> Result<String, String> {
    let rate = Decimal::from_str(&exchange_rate).map_err(|e| e.to_string())?;
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    let ratio = manual_ratio.and_then(|r| Decimal::from_str(&r).ok());

    CreatePartnerUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.currency_repo.clone(),
    ).execute(
        name,
        currency,
        rate,
        amt,
        is_amount_in_original,
        sharing_type,
        ratio,
        accounting_start_mode,
    ).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_capital_contribution(
    state: State<'_, AppState>,
    partner_id: String,
    funding_account_id: String,
    amount: String,
    is_amount_in_original: bool,
) -> Result<String, String> {
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    CreateCapitalContributionUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    ).execute(partner_id, funding_account_id, amt, is_amount_in_original)
        .await
        .map_err(|e| e.to_string())
}

/// Explicit partner-drawing event: Dr partner drawings account / Cr cash-bank
/// (Sec 11 / Sec 34). Drawings are contra-equity and never reduce net profit.
#[tauri::command]
pub async fn create_partner_drawing(
    state: State<'_, AppState>,
    partner_id: String,
    funding_account_id: String,
    amount: String,
    effective_date: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    CreatePartnerDrawingUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(partner_id, funding_account_id, amt, effective_date, description)
    .await
    .map_err(|e| e.to_string())
}

/// Moves retained earnings (52) into a partner's capital account through an
/// explicit, auditable capitalization journal (Sec 10).
#[tauri::command]
pub async fn capitalize_retained_earnings(
    state: State<'_, AppState>,
    partner_id: String,
    amount: String,
    effective_date: Option<String>,
) -> Result<String, String> {
    let amt = Decimal::from_str(&amount).map_err(|e| e.to_string())?;
    CapitalizeRetainedEarningsUseCase::new(
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(partner_id, amt, effective_date)
    .await
    .map_err(|e| e.to_string())
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
pub async fn get_partner_equity_statement(
    state: State<'_, AppState>,
) -> Result<application::use_cases::equity::PartnerEquityStatementDto, String> {
    GetPartnerEquityStatementUseCase::new(
        state.partner_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute()
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
#[allow(clippy::too_many_arguments)]
pub async fn update_partner(
    state: State<'_, AppState>,
    id: String,
    name: String,
    currency: String,
    exchange_rate: String,
    amount: String,
    is_amount_in_original: bool,
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
        state.currency_repo.clone(),
    ).execute(UpdatePartnerRequest {
        id,
        name,
        currency_code: currency,
        exchange_rate: rate,
        amount: amt,
        is_amount_in_original,
        sharing_type,
        manual_ratio: ratio,
    }).await.map_err(|e| e.to_string())
}
