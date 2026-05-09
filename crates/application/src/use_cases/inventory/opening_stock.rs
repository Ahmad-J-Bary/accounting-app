use crate::dto::stock_dto::RecordOpeningStockRequest;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;

pub struct RecordOpeningStockUseCase {
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl RecordOpeningStockUseCase {
    pub fn new(
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            material_repo,
            movement_repo,
            journal_repo,
            account_repo,
        }
    }

    pub async fn execute(&self, req: RecordOpeningStockRequest) -> Result<(), AppError> {
        let mut total_value = Decimal::ZERO;
        let mut total_value_base = Decimal::ZERO;
        let entry_date = DateTime::parse_from_rfc3339(&req.date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        
        let currency = Currency::from_code(&req.currency_code);
        let fx_rate = Decimal::from_str(&req.exchange_rate).unwrap_or(Decimal::ONE);

        // 1. Process items
        for item in &req.items {
            let pid = item
                .material_id
                .parse()
                .map_err(|_| AppError::Invalid("معرف مادة غير صالح".into()))?;
            let material = self.material_repo.find_by_id(&pid).await?.ok_or_else(|| {
                AppError::NotFound(format!("المادة {} غير موجودة", item.material_id))
            })?;

            let quantity = Decimal::from_str(&item.quantity)
                .map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;
            let unit_cost = Decimal::from_str(&item.unit_cost)
                .map_err(|_| AppError::Invalid("سعر تكلفة غير صالح".into()))?;
            let unit_cost_base = Decimal::from_str(&item.unit_cost_base)
                .map_err(|_| AppError::Invalid("سعر تكلفة (أساسي) غير صالح".into()))?;

            let movement = StockMovement::new(
                material.id,
                MovementType::OpeningBalance,
                quantity,
                unit_cost,
                quantity * unit_cost,
                "OP-STOCK".to_string(),
                req.notes.clone().unwrap_or_default(),
                entry_date,
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            // Record movement (dynamic balance)
            self.movement_repo.save(&movement).await?;

            total_value += quantity * unit_cost;
            total_value_base += quantity * unit_cost_base;
        }

        // 2. Create Journal Entry if value > 0
        if total_value > Decimal::ZERO {
            let inventory_account =
                self.account_repo
                    .find_by_code("1201")
                    .await?
                    .ok_or_else(|| {
                        AppError::NotFound("حساب بضاعة أول المدة (1201) غير موجود".into())
                    })?;

            let equity_account = self
                .account_repo
                .find_by_code("2202")
                .await?
                .ok_or_else(|| AppError::NotFound("حساب رأس المال (2202) غير موجود".into()))?;

            let lines = vec![
                JournalLine::new(
                    inventory_account.id,
                    domain::shared::monetary_amount::MonetaryAmount::new(Money::new(total_value, currency.clone()), fx_rate),
                    domain::shared::monetary_amount::MonetaryAmount::zero(currency.clone()),
                    "رصيد مخزون أول المدة".to_string(),
                ),
                JournalLine::new(
                    equity_account.id,
                    domain::shared::monetary_amount::MonetaryAmount::zero(currency.clone()),
                    domain::shared::monetary_amount::MonetaryAmount::new(Money::new(total_value, currency.clone()), fx_rate),
                    "رصيد افتتاحي مقابل بضاعة أول المدة".to_string(),
                ),
            ];

            let mut entry = JournalEntry::new(
                format!("JE-OP-{}", Utc::now().timestamp()),
                domain::accounting::JournalType::CashOpeningBalance,
                lines,
                entry_date,
                req.notes
                    .unwrap_or_else(|| "قيد بضاعة أول المدة".to_string()),
                None,
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(())
    }
}
