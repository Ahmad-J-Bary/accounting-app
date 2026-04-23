use std::sync::Arc;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::money::Money;
use domain::shared::currency::Currency;
use crate::ports::product_repository::ProductRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::stock_dto::RecordOpeningStockRequest;
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};

pub struct RecordOpeningStockUseCase {
    product_repo: Arc<dyn ProductRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl RecordOpeningStockUseCase {
    pub fn new(
        product_repo: Arc<dyn ProductRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            product_repo,
            movement_repo,
            journal_repo,
            account_repo,
        }
    }

    pub async fn execute(&self, req: RecordOpeningStockRequest) -> Result<(), AppError> {
        let mut total_value = Decimal::ZERO;
        let entry_date = DateTime::parse_from_rfc3339(&req.date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        // 1. Process items
        for item in &req.items {
            let pid = item.product_id.parse().map_err(|_| AppError::Invalid("معرف منتج غير صالح".into()))?;
            let mut product = self.product_repo.find_by_id(&pid).await?
                .ok_or_else(|| AppError::NotFound(format!("المنتج {} غير موجود", item.product_id)))?;
            
            let quantity = Decimal::from_str(&item.quantity).map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;
            let unit_cost = Decimal::from_str(&item.unit_cost).map_err(|_| AppError::Invalid("سعر تكلفة غير صالح".into()))?;
            
            let movement = StockMovement::new(
                product.id.clone(),
                MovementType::OpeningBalance,
                quantity,
                "OP-STOCK".to_string(),
                req.notes.clone().unwrap_or_default(),
                entry_date,
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            // Update product stock snapshot
            product.adjust_stock(quantity).map_err(|e| AppError::Invalid(e.to_string()))?;
            
            self.product_repo.update(&product).await?;
            self.movement_repo.save(&movement).await?;
            
            total_value += quantity * unit_cost;
        }

        // 2. Create Journal Entry if value > 0
        if total_value > Decimal::ZERO {
            let inventory_account = self.account_repo.find_by_code("1201").await? 
                .ok_or_else(|| AppError::NotFound("حساب المخزون (1201) غير موجود".into()))?;
            
            let equity_account = self.account_repo.find_by_code("3002").await? 
                .ok_or_else(|| AppError::NotFound("حساب رصيد أول المدة (3002) غير موجود".into()))?;

            let lines = vec![
                JournalLine::new(
                    inventory_account.id.clone(),
                    Currency::SYP,
                    Decimal::ONE,
                    Money::syp(total_value),
                    Money::zero(),
                    "رصيد مخزون أول المدة".to_string(),
                ),
                JournalLine::new(
                    equity_account.id.clone(),
                    Currency::SYP,
                    Decimal::ONE,
                    Money::zero(),
                    Money::syp(total_value),
                    "رصيد افتتاحي مقابل بضاعة أول المدة".to_string(),
                ),
            ];

            let mut entry = JournalEntry::new(
                format!("JE-OP-{}", Utc::now().timestamp()),
                lines,
                entry_date,
                req.notes.unwrap_or_else(|| "قيد بضاعة أول المدة".to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(())
    }
}
