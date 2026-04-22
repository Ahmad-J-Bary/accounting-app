use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::shared::Money;

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
