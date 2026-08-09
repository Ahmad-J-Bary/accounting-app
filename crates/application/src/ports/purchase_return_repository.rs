use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::inventory::stock_movement::StockMovement;
use domain::payments::Payment;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;
use domain::suppliers::Supplier;
use crate::errors::AppError;

#[async_trait]
pub trait PurchaseReturnRepository: Send + Sync {
    async fn save(&self, ret: &PurchaseReturn) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &PurchaseReturnId) -> Result<Option<PurchaseReturn>, AppError>;
    async fn list_all(&self) -> Result<Vec<PurchaseReturn>, AppError>;
    async fn get_next_return_number(&self) -> Result<String, AppError>;
    async fn delete(&self, id: &PurchaseReturnId) -> Result<(), AppError>;
    async fn post_with_accounting(
        &self,
        movements: &[StockMovement],
        entries: &[JournalEntry],
        payment: Option<&Payment>,
        customers: &[Customer],
        suppliers: &[Supplier],
    ) -> Result<(), AppError>;
}