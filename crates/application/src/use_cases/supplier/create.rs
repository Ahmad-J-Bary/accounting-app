use std::sync::Arc;
use domain::suppliers::Supplier;
use domain::shared::ids::{AccountId, SupplierId};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, Money, MonetaryAmount};
use chrono::Utc;
use rust_decimal::Decimal;

use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::supplier_dto::{CreateSupplierRequest, SupplierDto};
use crate::errors::AppError;

pub struct CreateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: CreateSupplierRequest) -> Result<SupplierDto, AppError> {
        let supplier_id = SupplierId::new();
        let code = crate::utils::ensure_code(Some(req.code), supplier_id.to_string());
        
        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;
        let currency = Currency::syp();

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
            currency.clone(),
            req.notes.clone(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.supplier_repo.save(&supplier).await?;

        let account_code = self.account_repo.get_next_child_code("223").await?;
        let parent = self.account_repo.find_by_code("223").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("حساب ذمم الموردين (223) غير موجود".into()))?;

        let new_account_id = AccountId::new();
        let new_account = Account {
            id: new_account_id,
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

        supplier.link_account(new_account_id);
        self.supplier_repo.save(&supplier).await?;

        // --- Accounting Integration: Opening Balance ---
        let total_opening = credit - debit;
        if total_opening != Decimal::ZERO {
            let opening_equity = self.account_repo.find_by_code("122").await?
                .ok_or_else(|| AppError::NotFound("حساب الصندوق (الخزينة) (122) غير موجود".into()))?;

            let amount_ma = MonetaryAmount::new(Money::new(total_opening.abs(), currency.clone()), Decimal::ONE);
            let zero_ma = MonetaryAmount::zero(currency.clone());

            let mut lines = Vec::new();
            if total_opening > Decimal::ZERO {
                // Equity Debit, Supplier Credit
                lines.push(JournalLine::new(opening_equity.id, amount_ma.clone(), zero_ma.clone(), format!("رصيد افتتاحي للمورد: {}", supplier.name)));
                lines.push(JournalLine::new(new_account_id, zero_ma, amount_ma, format!("رصيد افتتاحي دائن للمورد: {}", supplier.name)));
            } else {
                // Supplier Debit, Equity Credit
                lines.push(JournalLine::new(new_account_id, amount_ma.clone(), zero_ma.clone(), format!("رصيد افتتاحي للمورد: {}", supplier.name)));
                lines.push(JournalLine::new(opening_equity.id, zero_ma, amount_ma, format!("رصيد افتتاحي مدين للمورد: {}", supplier.name)));
            }

            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                JournalType::AccountOpeningBalance,
                lines,
                Utc::now(),
                format!("قيد افتتاح رصيد المورد: {}", supplier.name),
                Some(supplier.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(SupplierDto::from(supplier))
    }
}
