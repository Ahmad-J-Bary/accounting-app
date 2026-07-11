use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DepreciationStatus {
    Pending,
    Posted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepreciationSchedule {
    pub id: Uuid,
    pub fixed_asset_id: Uuid,
    pub period_date: DateTime<Utc>,
    pub depreciation_amount: Money,
    pub accumulated_depreciation: Money,
    pub remaining_value: Money,
    pub status: DepreciationStatus,
    pub journal_entry_id: Option<Uuid>,
}

// ── Depreciation Method Enum ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DepreciationMethod {
    StraightLine,
    DecliningBalance,
}

// ── Strategy Trait ──

pub trait DepreciationStrategy {
    fn calculate(
        &self,
        cost: &Money,
        salvage: &Option<Money>,
        useful_life_months: u32,
        current_period: u32,
        accumulated: &Money,
    ) -> Money;
}

// ── Straight-Line Strategy ──

pub struct StraightLineStrategy;

impl DepreciationStrategy for StraightLineStrategy {
    fn calculate(
        &self,
        cost: &Money,
        salvage: &Option<Money>,
        useful_life_months: u32,
        _current_period: u32,
        _accumulated: &Money,
    ) -> Money {
        if useful_life_months == 0 {
            return Money::new(Decimal::ZERO, cost.currency().clone());
        }
        let c = cost.amount();
        let s = salvage.as_ref().map(|m| m.amount()).unwrap_or(Decimal::ZERO);
        let depreciable = c - s;
        let monthly = depreciable / Decimal::from(useful_life_months);
        Money::new(monthly.round_dp(2), cost.currency().clone())
    }
}

// ── Declining Balance Strategy (10% yearly) ──

pub struct DecliningBalanceStrategy;

impl DepreciationStrategy for DecliningBalanceStrategy {
    fn calculate(
        &self,
        cost: &Money,
        salvage: &Option<Money>,
        useful_life_months: u32,
        _current_period: u32,
        accumulated: &Money,
    ) -> Money {
        let zero = Money::new(Decimal::ZERO, cost.currency().clone());
        if useful_life_months == 0 {
            return zero;
        }

        let nbv = cost.amount() - accumulated.amount();
        let salvage_amount = salvage.as_ref().map(|m| m.amount()).unwrap_or(Decimal::ZERO);

        if nbv <= salvage_amount {
            return zero;
        }

        let depreciation = nbv * dec!(0.10);
        let max_depreciable = nbv - salvage_amount;
        let actual = if depreciation > max_depreciable { max_depreciable } else { depreciation };

        if actual <= Decimal::ZERO {
            zero
        } else {
            Money::new(actual.round_dp(2), cost.currency().clone())
        }
    }
}

// ── Dispatcher ──

pub fn calculate_depreciation(
    method: &DepreciationMethod,
    cost: &Money,
    salvage: &Option<Money>,
    useful_life_months: u32,
    current_period: u32,
    accumulated: &Money,
) -> Money {
    match method {
        DepreciationMethod::StraightLine => {
            StraightLineStrategy.calculate(cost, salvage, useful_life_months, current_period, accumulated)
        }
        DepreciationMethod::DecliningBalance => {
            DecliningBalanceStrategy.calculate(cost, salvage, useful_life_months, current_period, accumulated)
        }
    }
}
