use async_trait::async_trait;

use crate::errors::AppError;
use crate::use_cases::opening_balance::types::OpeningItemInput;

/// Persists the sub-ledger item links (AR / AP / Inventory / Fixed Assets) of
/// an opening balance migration. Each item references a REAL entity created
/// through the same module. All items for a migration are replaced atomically.
#[async_trait]
pub trait OpeningItemRepository: Send + Sync {
    async fn replace_items(&self, migration_id: &str, items: &[OpeningItemInput]) -> Result<(), AppError>;
    async fn load_items(&self, migration_id: &str) -> Result<Vec<OpeningItemInput>, AppError>;
}
