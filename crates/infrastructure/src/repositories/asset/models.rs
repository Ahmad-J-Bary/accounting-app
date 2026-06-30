#[derive(sqlx::FromRow)]
pub struct AssetRow {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category_id: String,
    pub warehouse_id: Option<String>,
    pub purchase_date: String,
    pub purchase_cost: String,
    pub currency: String,
    pub fx_rate: String,
    pub useful_life_months: i64,
    pub salvage_value: Option<String>,
    pub accumulated_depreciation: String,
    pub status: String,
    pub location: String,
    pub notes: Option<String>,
    pub asset_account_id: String,
    pub depreciation_account_id: String,
    pub accumulated_depreciation_account_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
pub struct AssetCategoryRow {
    pub id: String,
    pub name: String,
    pub asset_type: String,
}

#[derive(sqlx::FromRow)]
pub struct AssetMovementRow {
    pub id: String,
    pub asset_id: String,
    pub movement_type: String,
    pub movement_date: String,
    pub quantity: Option<String>,
    pub amount: String,
    pub currency: Option<String>, // May be missing in some rows, handles in mapper
    pub description: Option<String>,
    pub reference_no: Option<String>,
    pub journal_entry_id: Option<String>,
    pub created_at: String,
}

#[derive(sqlx::FromRow)]
pub struct DepreciationScheduleRow {
    pub id: String,
    pub fixed_asset_id: String,
    pub period_date: String,
    pub depreciation_amount: String,
    pub accumulated_depreciation: String,
    pub remaining_value: String,
    pub currency: Option<String>,
    pub status: String,
    pub journal_entry_id: Option<String>,
}
