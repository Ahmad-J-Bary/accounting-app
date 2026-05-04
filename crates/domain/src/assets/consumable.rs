use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;
use rust_decimal::Decimal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumableId(pub Uuid);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConsumableStatus {
    InStock,
    Exhausted,
    Damaged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Consumable {
    pub id: ConsumableId,
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub quantity_on_hand: Decimal,
    pub unit_cost: Money,
    pub fx_rate: Decimal,
    pub status: ConsumableStatus,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub asset_account_id: Uuid,
    pub expense_account_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Consumable {
    pub fn new(
        code: String,
        name: String,
        category_id: Uuid,
        unit_cost: Money,
        fx_rate: Decimal,
        asset_account_id: Uuid,
        expense_account_id: Uuid,
    ) -> Self {
        Self {
            id: ConsumableId(Uuid::new_v4()),
            code,
            name,
            category_id,
            quantity_on_hand: Decimal::ZERO,
            unit_cost,
            fx_rate,
            status: ConsumableStatus::InStock,
            location: None,
            notes: None,
            asset_account_id,
            expense_account_id,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    pub fn total_cost(&self) -> Money {
        self.unit_cost.clone() * self.quantity_on_hand
    }

    pub fn add_stock(&mut self, quantity: Decimal) {
        self.quantity_on_hand += quantity;
        self.status = ConsumableStatus::InStock;
        self.updated_at = Utc::now();
    }

    pub fn issue(&mut self, quantity: Decimal) -> Result<Money, String> {
        if self.quantity_on_hand < quantity {
            return Err("Insufficient quantity".to_string());
        }
        
        self.quantity_on_hand -= quantity;
        if self.quantity_on_hand == Decimal::ZERO {
            self.status = ConsumableStatus::Exhausted;
        }
        self.updated_at = Utc::now();
        
        Ok(self.unit_cost.clone() * quantity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::Currency;

    #[test]
    fn test_consumable_stock() {
        let mut item = Consumable::new(
            "C1".to_string(),
            "Paper".to_string(),
            Uuid::new_v4(),
            Money::new(Decimal::from(10), Currency::usd()),
            Decimal::ONE,
            Uuid::new_v4(),
            Uuid::new_v4(),
        );

        item.add_stock(Decimal::from(5));
        assert_eq!(item.quantity_on_hand, Decimal::from(5));
        assert_eq!(item.total_cost().amount(), Decimal::from(50));

        let cost = item.issue(Decimal::from(2)).unwrap();
        assert_eq!(cost.amount(), Decimal::from(20));
        assert_eq!(item.quantity_on_hand, Decimal::from(3));

        assert!(item.issue(Decimal::from(10)).is_err());
    }
}
