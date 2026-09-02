use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::inventory::stock_movement::StockMovement;
use domain::payments::Payment;
use domain::returns::SalesReturn;
use domain::shared::ids::SalesReturnId;
use domain::suppliers::Supplier;

#[async_trait]
pub trait SalesReturnRepository: Send + Sync {
    async fn save(&self, ret: &SalesReturn) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &SalesReturnId) -> Result<Option<SalesReturn>, AppError>;
    async fn list_all(&self) -> Result<Vec<SalesReturn>, AppError>;
    async fn get_next_return_number(&self) -> Result<String, AppError>;
    async fn delete(&self, id: &SalesReturnId) -> Result<(), AppError>;
    async fn post_with_accounting(
        &self,
        movements: &[StockMovement],
        entries: &[JournalEntry],
        payment: Option<&Payment>,
        customers: &[Customer],
        suppliers: &[Supplier],
    ) -> Result<(), AppError>;
}
