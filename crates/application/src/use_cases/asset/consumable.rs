use std::sync::Arc;
use crate::ports::consumable_repository::ConsumableRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::asset_repository::AssetRepository;
use domain::assets::{Consumable, ConsumableId, AssetMovement, AssetMovementType};
use domain::accounting::{JournalEntry, JournalLine};
use domain::shared::{Money, AccountId, MonetaryAmount};
use crate::errors::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;
use chrono::Utc;

pub struct ConsumableUseCases {
    repo: Arc<dyn ConsumableRepository>,
    asset_repo: Arc<dyn AssetRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

pub struct CreateConsumableRequest {
    pub code: String,
    pub name: String,
    pub category_id: Uuid,
    pub unit_cost: Money,
    pub fx_rate: Decimal,
    pub asset_account_id: Uuid,
    pub expense_account_id: Uuid,
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
        req: CreateConsumableRequest,
    ) -> Result<ConsumableId, AppError> {
        let item = Consumable::new(
            req.code,
            req.name,
            req.category_id,
            req.unit_cost,
            req.fx_rate,
            req.asset_account_id,
            req.expense_account_id,
        );
        self.repo.save(&item).await?;
        Ok(item.id)
    }

    pub async fn add_stock(&self, id: Uuid, quantity: Decimal) -> Result<(), AppError> {
        let mut item = self.repo.find_by_id(&ConsumableId(id)).await?
            .ok_or_else(|| AppError::NotFound("Item not found".to_string()))?;
        
        item.add_stock(quantity);
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

        let total_value = item.issue(quantity).map_err(AppError::Invalid)?;
        self.repo.save(&item).await?;

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
        let debit_ma = MonetaryAmount::new(total_value.clone(), item.fx_rate);
        let credit_zero = MonetaryAmount::zero(item.unit_cost.currency().clone());
        lines.push(JournalLine::new(
            AccountId(item.expense_account_id),
            debit_ma,
            credit_zero.clone(),
            format!("صرف مستهلكات: {} - {}", item.name, description),
        ));

        let debit_zero = MonetaryAmount::zero(item.unit_cost.currency().clone());
        let credit_ma = MonetaryAmount::new(total_value.clone(), item.fx_rate);
        lines.push(JournalLine::new(
            AccountId(item.asset_account_id),
            debit_zero,
            credit_ma,
            format!("تخفيض مخزون مستهلكات: {}", item.name),
        ));

        let entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            domain::accounting::JournalType::GeneralJournal,
            lines,
            Utc::now(),
            format!("صرف مستهلكات: {}", item.name),
            Some(item.id.0.to_string()),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        Ok(())
    }

    pub async fn list_items(&self) -> Result<Vec<Consumable>, AppError> {
        self.repo.list_all().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAssetRepository, MockJournalRepository};
    use domain::shared::Currency;
    use rust_decimal_macros::dec;

    pub struct MockConsumableRepo {
        pub items: std::sync::Mutex<Vec<Consumable>>,
    }
    
    #[async_trait::async_trait]
    impl ConsumableRepository for MockConsumableRepo {
        async fn save(&self, item: &Consumable) -> Result<(), AppError> {
            let mut items = self.items.lock().unwrap();
            items.retain(|i| i.id.0 != item.id.0);
            items.push(item.clone());
            Ok(())
        }
        async fn find_by_id(&self, id: &ConsumableId) -> Result<Option<Consumable>, AppError> {
            let items = self.items.lock().unwrap();
            Ok(items.iter().find(|i| i.id.0 == id.0).cloned())
        }
        async fn list_all(&self) -> Result<Vec<Consumable>, AppError> {
            Ok(self.items.lock().unwrap().clone())
        }
        async fn delete(&self, _id: &ConsumableId) -> Result<(), AppError> { Ok(()) }
    }

    #[tokio::test]
    async fn test_consumable_lifecycle() {
        let repo = Arc::new(MockConsumableRepo { items: std::sync::Mutex::new(Vec::new()) });
        let asset_repo = Arc::new(MockAssetRepository::default());
        let journal_repo = Arc::new(MockJournalRepository::default());
        let use_cases = ConsumableUseCases::new(repo, asset_repo.clone(), journal_repo.clone());

        // 1. Create
        let id = use_cases.create_item(CreateConsumableRequest {
            code: "C1".to_string(),
            name: "Ink".to_string(),
            category_id: Uuid::new_v4(),
            unit_cost: Money::new(dec!(50), Currency::syp()),
            fx_rate: dec!(1),
            asset_account_id: Uuid::new_v4(),
            expense_account_id: Uuid::new_v4(),
        }).await.unwrap();

        // 2. Add Stock
        use_cases.add_stock(id.0, dec!(10)).await.unwrap();
        
        let items = use_cases.list_items().await.unwrap();
        assert_eq!(items[0].quantity_on_hand, dec!(10));

        // 3. Issue
        use_cases.issue_item(id.0, dec!(2), "Printing".to_string()).await.unwrap();
        
        let updated = use_cases.list_items().await.unwrap();
        assert_eq!(updated[0].quantity_on_hand, dec!(8));

        // Check Accounting
        let entries = journal_repo.entries.lock().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].lines[0].debit.amount(), dec!(100)); // 2 * 50
    }
}
