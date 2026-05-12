use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::asset::{FixedAssetUseCases, ConsumableUseCases, CreateAssetRequest, CreateConsumableRequest};
use domain::assets::{FixedAsset, Consumable, AssetType, AssetCategory};
use domain::shared::Money;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_fixed_asset(
    code: String,
    name: String,
    category_id: String,
    purchase_date: String,
    purchase_cost: String,
    currency: String,
    fx_rate: String,
    useful_life_months: u32,
    asset_account_id: String,
    depreciation_account_id: String,
    accumulated_depreciation_account_id: String,
    payment_account_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let category_uuid = Uuid::parse_str(&category_id).map_err(|e| e.to_string())?;
    let purchase_dt = chrono::DateTime::parse_from_rfc3339(&purchase_date)
        .map(|d| d.with_timezone(&chrono::Utc))
        .map_err(|e| e.to_string())?;
    
    let amount = Decimal::from_str(&purchase_cost).map_err(|e: rust_decimal::Error| e.to_string())?;
    let curr = match currency.as_str() {
        "USD" => domain::shared::Currency::usd(),
        _ => domain::shared::Currency::syp(),
    };
    let money = Money::new(amount, curr);
    let fx = Decimal::from_str(&fx_rate).map_err(|e: rust_decimal::Error| e.to_string())?;
    
    let asset_acc = Uuid::parse_str(&asset_account_id).map_err(|e| e.to_string())?;
    let dep_acc = Uuid::parse_str(&depreciation_account_id).map_err(|e| e.to_string())?;
    let acc_dep_acc = Uuid::parse_str(&accumulated_depreciation_account_id).map_err(|e| e.to_string())?;
    let pay_acc = Uuid::parse_str(&payment_account_id).map_err(|e| e.to_string())?;

    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    let id = use_case.create_asset(CreateAssetRequest {
        code,
        name,
        category_id: category_uuid,
        purchase_date: purchase_dt,
        purchase_cost: money,
        fx_rate: fx,
        useful_life_months,
        asset_account_id: asset_acc,
        depreciation_account_id: dep_acc,
        accumulated_depreciation_account_id: acc_dep_acc,
        payment_account_id: pay_acc,
    }).await.map_err(|e| e.to_string())?;

    Ok(id.0.to_string())
}

#[tauri::command]
pub async fn list_fixed_assets(
    state: State<'_, AppState>,
) -> Result<Vec<FixedAsset>, String> {
    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.list_assets().await.map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_consumable(
    code: String,
    name: String,
    category_id: String,
    unit_cost: String,
    currency: String,
    fx_rate: String,
    asset_account_id: String,
    expense_account_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let category_uuid = Uuid::parse_str(&category_id).map_err(|e| e.to_string())?;
    let amount = Decimal::from_str(&unit_cost).map_err(|e: rust_decimal::Error| e.to_string())?;
    let curr = match currency.as_str() {
        "USD" => domain::shared::Currency::usd(),
        _ => domain::shared::Currency::syp(),
    };
    let money = Money::new(amount, curr);
    let fx = Decimal::from_str(&fx_rate).map_err(|e: rust_decimal::Error| e.to_string())?;
    let asset_acc = Uuid::parse_str(&asset_account_id).map_err(|e| e.to_string())?;
    let exp_acc = Uuid::parse_str(&expense_account_id).map_err(|e| e.to_string())?;

    let use_case = ConsumableUseCases::new(state.consumable_repo.clone(), state.asset_repo.clone(), state.journal_entry_repo.clone());
    let id = use_case.create_item(CreateConsumableRequest {
        code,
        name,
        category_id: category_uuid,
        unit_cost: money,
        fx_rate: fx,
        asset_account_id: asset_acc,
        expense_account_id: exp_acc,
    })
    .await.map_err(|e| e.to_string())?;

    Ok(id.0.to_string())
}

#[tauri::command]
pub async fn list_consumables(
    state: State<'_, AppState>,
) -> Result<Vec<Consumable>, String> {
    let use_case = ConsumableUseCases::new(state.consumable_repo.clone(), state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.list_items().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_consumable_stock(
    id: String,
    quantity: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let qty = Decimal::from_str(&quantity).map_err(|e| e.to_string())?;
    let use_case = ConsumableUseCases::new(state.consumable_repo.clone(), state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.add_stock(uuid, qty).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn issue_consumable(
    id: String,
    quantity: String,
    description: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let qty = Decimal::from_str(&quantity).map_err(|e| e.to_string())?;
    let use_case = ConsumableUseCases::new(state.consumable_repo.clone(), state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.issue_item(uuid, qty, description).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_asset_category(
    name: String,
    asset_type: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let atype = match asset_type.as_str() {
        "Fixed" => AssetType::Fixed,
        _ => AssetType::Consumable,
    };
    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    let id = use_case.create_category(name, atype).await.map_err(|e| e.to_string())?;
    Ok(id.to_string())
}

#[tauri::command]
pub async fn list_asset_categories(
    asset_type: String,
    state: State<'_, AppState>,
) -> Result<Vec<AssetCategory>, String> {
    let atype = match asset_type.as_str() {
        "Fixed" => AssetType::Fixed,
        _ => AssetType::Consumable,
    };
    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.list_categories(atype).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_asset_depreciation(
    asset_id: String,
    date: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = Uuid::parse_str(&asset_id).map_err(|e| e.to_string())?;
    let dt = chrono::DateTime::parse_from_rfc3339(&date)
        .map(|d| d.with_timezone(&chrono::Utc))
        .map_err(|e| e.to_string())?;

    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.post_depreciation(id, dt).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_asset_movements(
    asset_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<domain::assets::AssetMovement>, String> {
    let id = Uuid::parse_str(&asset_id).map_err(|e| e.to_string())?;
    let use_case = FixedAssetUseCases::new(state.asset_repo.clone(), state.journal_entry_repo.clone());
    use_case.list_movements(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_asset_movements(
    state: State<'_, AppState>,
) -> Result<Vec<domain::assets::AssetMovement>, String> {
    state.asset_repo.list_all_movements().await.map_err(|e| e.to_string())
}
