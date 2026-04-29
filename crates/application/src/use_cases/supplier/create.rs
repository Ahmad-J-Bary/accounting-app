use std::sync::Arc;
use domain::suppliers::Supplier;
use domain::shared::ids::{AccountId, SupplierId};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use chrono::Utc;

use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::supplier_dto::{CreateSupplierRequest, SupplierDto};
use crate::errors::AppError;

pub struct CreateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo }
    }

    pub async fn execute(&self, req: CreateSupplierRequest) -> Result<SupplierDto, AppError> {
        let supplier_id = SupplierId::new();
        let code = crate::utils::ensure_code(Some(req.code), supplier_id.to_string());
        
        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;
        let currency = crate::utils::parse_currency(req.currency.as_deref());

        let mut supplier = Supplier::new_with_id(
            supplier_id,
            code,
            req.name.clone(),
            req.phone.clone(),
            req.address.clone(),
            None,
            debit,
            credit,
            opening_balance,
            currency,
            req.notes.clone(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.supplier_repo.save(&supplier).await?;

        let account_code = self.account_repo.get_next_child_code("223").await?;

        let parent = self.account_repo.find_by_code("223").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(parent) = parent {
            let existing_account = self.account_repo.find_by_code(&account_code).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            if let Some(existing) = existing_account {
                supplier.link_account(existing.id.clone());
                self.supplier_repo.save(&supplier).await?;
            } else {
                let new_account = Account {
                    id: AccountId::new(),
                    code: account_code.clone(),
                    name_ar: req.name.clone(),
                    name_en: req.name.clone(),
                    account_type: AccountType::Liabilities,
                    parent_id: Some(parent.id),
                    category: AccountCategory::Detail,
                    level: parent.level + 1,
                    opening_balance,
                    balance: credit - debit,
                    notes: None,
                    is_active: true,
                    is_default: false,
                    is_final: true,
                    linked_customer_id: None,
                    linked_supplier_id: Some(supplier_id),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                self.account_repo.save(&new_account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                let new_account_id = new_account.id.clone();
                supplier.link_account(new_account_id);
                self.supplier_repo.save(&supplier).await?;
            }
        }

        Ok(SupplierDto::from(supplier))
    }
}
