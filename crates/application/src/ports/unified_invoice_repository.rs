use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::inventory::inventory_lot::InventoryLot;
use domain::inventory::material::Material;
use domain::inventory::stock_movement::StockMovement;
use domain::payments::Payment;
use domain::sales::unified_invoice::{InvoiceType, UnifiedInvoice};
use domain::shared::ids::InvoiceId;
use domain::suppliers::Supplier;

#[async_trait]
pub trait UnifiedInvoiceRepository: Send + Sync {
    async fn save(&self, invoice: &UnifiedInvoice) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<UnifiedInvoice>, AppError>;
    async fn list_all(&self) -> Result<Vec<UnifiedInvoice>, AppError>;
    async fn list_by_type(
        &self,
        invoice_type: InvoiceType,
    ) -> Result<Vec<UnifiedInvoice>, AppError>;
    async fn update(&self, invoice: &UnifiedInvoice) -> Result<(), AppError>;
    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError>;
    async fn get_last_original_prices(
        &self,
        material_id: &str,
    ) -> Result<(String, String), AppError>;
    async fn get_next_invoice_number(&self, invoice_type: InvoiceType) -> Result<String, AppError>;

    /// Atomically posts a unified invoice: header status, stock movements, new
    /// lots, lot remaining updates, auto-updated materials, journal entries,
    /// payment vouchers and partner balance changes all commit in ONE
    /// transaction (Sec 9 atomicity).
    #[allow(clippy::too_many_arguments)]
    async fn post_with_accounting(
        &self,
        invoice: &UnifiedInvoice,
        movements: &[StockMovement],
        new_lots: &[InventoryLot],
        lot_updates: &[(String, String)],
        material_updates: &[Material],
        entries: &[JournalEntry],
        payments: &[Payment],
        customers: &[Customer],
        suppliers: &[Supplier],
    ) -> Result<(), AppError>;
}
