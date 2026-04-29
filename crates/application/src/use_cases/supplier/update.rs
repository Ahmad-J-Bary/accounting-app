use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;
use domain::shared::ids::{AccountId, SupplierId};

use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::supplier_dto::{UpdateSupplierRequest, SupplierDto};
use crate::errors::AppError;

pub struct UpdateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl UpdateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo }
    }

    pub async fn execute(&self, req: UpdateSupplierRequest) -> Result<SupplierDto, AppError> {
        let sid = req.id.parse::<SupplierId>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let mut supplier = self.supplier_repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

        supplier.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        supplier.code = crate::utils::ensure_code(Some(req.code), supplier.code);

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = Uuid::parse_str(acc_id_str)
                .map(AccountId)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            supplier.link_account(account_id);
        }

        if let Some(ref d) = req.debit {
            supplier.debit = crate::utils::parse_decimal(Some(d), "المدين")?;
            supplier.balance = supplier.credit - supplier.debit;
        }
        if let Some(ref c) = req.credit {
            supplier.credit = crate::utils::parse_decimal(Some(c), "الدائن")?;
            supplier.balance = supplier.credit - supplier.debit;
        }

        if let Some(ref ob) = req.opening_balance {
            supplier.opening_balance = crate::utils::parse_decimal(Some(ob), "رصيد الافتتاح")?;
        }

        if let Some(ref cur) = req.currency {
            supplier.currency = crate::utils::parse_currency(Some(cur));
        }

        self.supplier_repo.update(&supplier).await?;

        if let Some(ref account_id) = &supplier.account_id {
            if let Some(mut account) = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))? {
                account.name_ar = supplier.name.clone();
                account.name_en = supplier.name.clone();
                account.balance = supplier.balance;
                account.updated_at = Utc::now();
                self.account_repo.save(&account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        Ok(SupplierDto::from(supplier))
    }
}
