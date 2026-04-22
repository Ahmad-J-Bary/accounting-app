use std::sync::Arc;
use crate::ports::consumable_repository::ConsumableRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::asset_repository::AssetRepository;
use domain::assets::{Consumable, ConsumableId, AssetMovement, AssetMovementType};
use domain::accounting::{JournalEntry, JournalLine};
use domain::shared::{Money, AccountId};
use crate::errors::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;
use chrono::Utc;

pub struct ConsumableUseCases {
    repo: Arc<dyn ConsumableRepository>,
    asset_repo: Arc<dyn AssetRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl ConsumableUseCases {
    pub fn new(
        repo: Arc<dyn ConsumableRepository>,
        asset_repo: Arc<dyn AssetRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, asset_repo, journal_repo }
    }

    pub async fn create_item(
        &self,
        code: String,
        name: String,
        category_id: Uuid,
        unit_cost: Money,
        fx_rate: Decimal,
        asset_account_id: Uuid,
        expense_account_id: Uuid,
    ) -> Result<ConsumableId, AppError> {
        let item = Consumable::new(code, name, category_id, unit_cost, fx_rate, asset_account_id, expense_account_id);
        self.repo.save(&item).await?;
        Ok(item.id)
    }

    pub async fn add_stock(&self, id: Uuid, quantity: Decimal) -> Result<(), AppError> {
        let mut item = self.repo.find_by_id(&ConsumableId(id)).await?
            .ok_or_else(|| AppError::NotFound("Item not found".to_string()))?;
        
        item.quantity_on_hand += quantity;
        item.updated_at = Utc::now();
        self.repo.save(&item).await?;

        // Log movement
        let movement = AssetMovement::new(
            item.id.0,
            AssetMovementType::Adjustment,
            Utc::now(),
            item.unit_cost.clone() * quantity,
            format!("زيادة الكمية: {}", quantity),
        );
        self.asset_repo.save_movement(&movement).await?;

        Ok(())
    }

    pub async fn issue_item(&self, id: Uuid, quantity: Decimal, description: String) -> Result<(), AppError> {
        let mut item = self.repo.find_by_id(&ConsumableId(id)).await?
            .ok_or_else(|| AppError::NotFound("Item not found".to_string()))?;

        if item.quantity_on_hand < quantity {
            return Err(AppError::Invalid("Insufficient quantity".to_string()));
        }

        item.quantity_on_hand -= quantity;
        item.updated_at = Utc::now();
        self.repo.save(&item).await?;

        let total_value = item.unit_cost.clone() * quantity;

        // Log movement
        let movement = AssetMovement::new(
            item.id.0,
            AssetMovementType::Issue,
            Utc::now(),
            total_value.clone(),
            description.clone(),
        );
        self.asset_repo.save_movement(&movement).await?;

        // Journal Entry
        let mut lines = Vec::new();
        
        // Debit: Expense Account
        lines.push(JournalLine::new(
            AccountId(item.expense_account_id),
            item.unit_cost.currency(),
            item.fx_rate,
            total_value.clone(),
            Money::new(Decimal::ZERO, item.unit_cost.currency()),
            format!("صرف مستهلكات: {} - {}", item.name, description),
        ));

        // Credit: Asset (Inventory) Account
        lines.push(JournalLine::new(
            AccountId(item.asset_account_id),
            item.unit_cost.currency(),
            item.fx_rate,
            Money::new(Decimal::ZERO, item.unit_cost.currency()),
            total_value.clone(),
            format!("تخفيض مخزون مستهلكات: {}", item.name),
        ));

        let entry = JournalEntry::new(
            format!("CON-ISS-{}", Utc::now().timestamp()),
            lines,
            Utc::now(),
            format!("صرف مستهلكات: {}", item.name),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(())
    }

    pub async fn list_items(&self) -> Result<Vec<Consumable>, AppError> {
        self.repo.list_all().await
    }
}
