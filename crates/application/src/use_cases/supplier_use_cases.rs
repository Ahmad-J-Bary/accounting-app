use std::sync::Arc;
use uuid::Uuid;
use domain::suppliers::Supplier;
use domain::shared::ids::{AccountId, SupplierId};
use domain::shared::Currency;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::dto::supplier_dto::{CreateSupplierRequest, UpdateSupplierRequest, SupplierDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

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
        // Pre-generate supplier ID so we can use it as the code
        let supplier_id = SupplierId::new();

        // Code = numeric ID (always > 1, never "SUP-*")
        let code = if req.code.trim().is_empty() {
            supplier_id.0.to_string()
        } else {
            req.code.clone()
        };

        let debit = req.debit
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("قيمة المدين غير صالحة: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let credit = req.credit
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("قيمة الدائن غير صالحة: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let opening_balance = req.opening_balance
            .as_deref()
            .map(Decimal::from_str)
            .transpose()
            .map_err(|e| AppError::Invalid(format!("رصيد الافتتاح غير صالح: {}", e)))?
            .unwrap_or(Decimal::ZERO);

        let currency = match req.currency.as_deref() {
            Some("USD") => Currency::USD,
            _ => Currency::SYP,
        };

        // Create supplier with pre-generated ID
        let mut supplier = Supplier::new_with_id(
            supplier_id,
            code,
            req.name.clone(),
            req.phone.clone(),
            req.address.clone(),
            None, // account_id will be set after account creation
            debit,
            credit,
            opening_balance,
            currency,
            req.notes.clone(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.supplier_repo.save(&supplier).await?;

        // Account code = "223" + supplier_id  (e.g. supplier_id=2 → account code=2232)
        let account_code = format!("223{}", supplier_id);

        // Find parent account "223" (الدائنون (الموردون))
        let parent = self.account_repo.find_by_code("223").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(parent) = parent {
            let existing_account = self.account_repo.find_by_code(&account_code).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))?;

            if let Some(existing) = existing_account {
                // Link existing account to supplier
                supplier.link_account(existing.id.clone());
                self.supplier_repo.save(&supplier).await?;
            } else {
                // Create new account named exactly like the supplier (no prefix)
                let new_account = domain::accounting::account::Account {
                    id: domain::shared::ids::AccountId::new(),
                    code: account_code.clone(),
                    name_ar: req.name.clone(),
                    name_en: req.name.clone(),
                    account_type: domain::accounting::account::AccountType::Liabilities,
                    parent_id: Some(parent.id),
                    category: domain::accounting::account::AccountCategory::Detail,
                    level: parent.level + 1,
                    opening_balance,
                    balance: credit - debit,
                    notes: None,
                    is_active: true,
                    is_default: false,
                    is_final: true,
                    linked_customer_id: None,
                    linked_supplier_id: Some(supplier_id),
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
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

pub struct ListSuppliersUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl ListSuppliersUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<SupplierDto>, AppError> {
        let suppliers = self.repo.list_all().await?;
        Ok(suppliers.into_iter().map(SupplierDto::from).collect())
    }
}

pub struct GetSupplierUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl GetSupplierUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<SupplierDto, AppError> {
        let sid = id.parse::<u64>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let sid = SupplierId::from_u64(sid);
        let supplier = self.repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
        Ok(SupplierDto::from(supplier))
    }
}

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
        let sid = req.id.parse::<u64>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let sid = SupplierId::from_u64(sid);
        let mut supplier = self.supplier_repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

        supplier.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        // Update code if provided
        if !req.code.trim().is_empty() {
            supplier.code = req.code;
        }

        // Update account_id if provided
        if let Some(ref acc_id_str) = req.account_id {
            let account_id = Uuid::parse_str(acc_id_str)
                .map(AccountId)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            supplier.link_account(account_id);
        }

        // Update debit/credit if provided
        if let Some(ref d) = req.debit {
            let debit = Decimal::from_str(d)
                .map_err(|e| AppError::Invalid(format!("قيمة المدين غير صالحة: {}", e)))?;
            supplier.debit = debit;
            supplier.balance = supplier.credit - supplier.debit;
        }
        if let Some(ref c) = req.credit {
            let credit = Decimal::from_str(c)
                .map_err(|e| AppError::Invalid(format!("قيمة الدائن غير صالحة: {}", e)))?;
            supplier.credit = credit;
            supplier.balance = supplier.credit - supplier.debit;
        }

        // Update opening balance if provided
        if let Some(ref ob) = req.opening_balance {
            supplier.opening_balance = Decimal::from_str(ob)
                .map_err(|e| AppError::Invalid(format!("رصيد الافتتاح غير صالح: {}", e)))?;
        }

        // Update currency if provided
        if let Some(ref cur) = req.currency {
            supplier.currency = match cur.as_str() {
                "USD" => Currency::USD,
                _ => Currency::SYP,
            };
        }

        self.supplier_repo.update(&supplier).await?;

        // Sync account name and balance when supplier info changes
        if let Some(ref acct_id) = &supplier.account_id {
            if let Some(mut account) = self.account_repo.find_by_id(acct_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))? {
                account.name_ar = supplier.name.clone();
                account.name_en = supplier.name.clone();
                account.balance = supplier.balance;
                account.updated_at = chrono::Utc::now();
                self.account_repo.save(&account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        Ok(SupplierDto::from(supplier))
    }
}

pub struct DeleteSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl DeleteSupplierUseCase {
    pub fn new(supplier_repo: Arc<dyn SupplierRepository>, account_repo: Arc<dyn AccountRepository>) -> Self {
        Self { supplier_repo, account_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let sid = id.parse::<u64>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let sid = SupplierId::from_u64(sid);

        // Get supplier to find linked account
        let supplier = self.supplier_repo.find_by_id(&sid).await?;

        // Delete linked account if exists (cascade delete from CoA)
        if let Some(ref supplier) = supplier {
            if let Some(ref account_id) = &supplier.account_id {
                let _ = self.account_repo.delete(account_id).await;
            }
        }

        self.supplier_repo.delete(&sid).await
    }
}
