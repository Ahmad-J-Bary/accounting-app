use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;
use rust_decimal::Decimal;

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
    pub fx_rate: Decimal,
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
        fx_rate: Decimal,
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
            accumulated_depreciation: Money::new(Decimal::ZERO, purchase_cost.currency().clone()),
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

    pub fn calculate_monthly_depreciation(&self) -> Money {
        if self.useful_life_months == 0 {
            return Money::new(Decimal::ZERO, self.purchase_cost.currency().clone());
        }
        
        let cost = self.purchase_cost.amount();
        let salvage = self.salvage_value.as_ref().map(|m| m.amount()).unwrap_or(Decimal::ZERO);
        let depreciable_amount = cost - salvage;
        
        let monthly = depreciable_amount / Decimal::from(self.useful_life_months);
        Money::new(monthly.round_dp(2), self.purchase_cost.currency().clone())
    }

    pub fn depreciate(&mut self) -> Money {
        let amount = self.calculate_monthly_depreciation();
        self.accumulated_depreciation = self.accumulated_depreciation.clone() + amount.clone();
        self.updated_at = Utc::now();
        amount
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::Currency;

    #[test]
    fn test_calculate_depreciation() {
        let cost = Money::new(Decimal::from(1200), Currency::usd());
        let mut asset = FixedAsset::new(
            "CODE".to_string(),
            "NAME".to_string(),
            Uuid::new_v4(),
            Utc::now(),
            cost,
            Decimal::ONE,
            12, // 1 year
            Uuid::new_v4(),
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        let dep = asset.calculate_monthly_depreciation();
        assert_eq!(dep.amount(), Decimal::from(100));

        asset.depreciate();
        assert_eq!(asset.accumulated_depreciation.amount(), Decimal::from(100));
        assert_eq!(asset.net_book_value().amount(), Decimal::from(1100));
    }
}
