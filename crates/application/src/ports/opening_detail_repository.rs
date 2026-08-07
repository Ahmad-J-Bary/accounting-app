use async_trait::async_trait;

use crate::errors::AppError;
use crate::use_cases::opening_balance::types::OpeningDetailsDto;

/// Persists the sub-ledger detail items (AR / AP / Inventory / Fixed Assets)
/// of an opening balance migration. All four categories for a migration are
/// replaced atomically.
#[async_trait]
pub trait OpeningDetailRepository: Send + Sync {
    async fn replace_details(&self, migration_id: &str, details: &OpeningDetailsDto) -> Result<(), AppError>;
    async fn load_details(&self, migration_id: &str) -> Result<OpeningDetailsDto, AppError>;
}