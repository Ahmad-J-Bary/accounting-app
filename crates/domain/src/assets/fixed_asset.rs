use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedAssetId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AssetStatus {
    Active,
    Disposed,
    Sold,
    Damaged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixedAsset {
    pub id: FixedAssetId,
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub purchase_date: DateTime<Utc>,
    pub purchase_cost: Money,
    pub fx_rate: rust_decimal::Decimal,
    pub useful_life_months: u32,
    pub salvage_value: Option<Money>,
    pub accumulated_depreciation: Money,
    pub status: AssetStatus,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub asset_account_id: Uuid,
    pub depreciation_account_id: Uuid,
    pub accumulated_depreciation_account_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FixedAsset {
    pub fn new(
        code: String,
        name: String,
        category_id: Uuid,
        purchase_date: DateTime<Utc>,
        purchase_cost: Money,
        fx_rate: rust_decimal::Decimal,
        useful_life_months: u32,
        asset_account_id: Uuid,
        depreciation_account_id: Uuid,
        accumulated_depreciation_account_id: Uuid,
    ) -> Self {
        Self {
            id: FixedAssetId(Uuid::new_v4()),
            code,
            name,
            category_id,
            purchase_date,
            purchase_cost: purchase_cost.clone(),
            fx_rate,
            useful_life_months,
            salvage_value: None,
            accumulated_depreciation: Money::new(rust_decimal::Decimal::ZERO, purchase_cost.currency()),
            status: AssetStatus::Active,
            location: None,
            notes: None,
            asset_account_id,
            depreciation_account_id,
            accumulated_depreciation_account_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn net_book_value(&self) -> Money {
        self.purchase_cost.clone() - self.accumulated_depreciation.clone()
    }
}
