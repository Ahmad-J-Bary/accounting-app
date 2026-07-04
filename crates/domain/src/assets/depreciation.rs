use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;
use rust_decimal::Decimal;

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
    // Future: DoubleDeclining,
    // Future: SumOfYearsDigits,
    // Future: UnitsOfProduction,
}

// ── Strategy Trait ──

pub trait DepreciationStrategy {
    fn calculate(
        &self,
        cost: &Money,
        salvage: &Option<Money>,
        useful_life_months: u32,
        current_period: u32,
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

// ── Dispatcher ──

pub fn calculate_depreciation(
    method: &DepreciationMethod,
    cost: &Money,
    salvage: &Option<Money>,
    useful_life_months: u32,
    current_period: u32,
) -> Money {
    match method {
        DepreciationMethod::StraightLine => {
            StraightLineStrategy.calculate(cost, salvage, useful_life_months, current_period)
        }
    }
}
