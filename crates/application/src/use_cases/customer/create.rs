use std::sync::Arc;
use domain::customers::Customer;
use domain::shared::ids::{AccountId, CustomerId};
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, Money, MonetaryAmount};
use chrono::Utc;
use rust_decimal::Decimal;

use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;

pub struct CreateCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { customer_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: CreateCustomerRequest) -> Result<CustomerDto, AppError> {
        let customer_id = CustomerId::new();
        let code = crate::utils::ensure_code(Some(req.code), customer_id.to_string());
        
        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;
        let currency = Currency::syp(); // For now, assume SYP as base

        let mut customer = Customer::new_with_id(
            customer_id,
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

        self.customer_repo.save(&customer).await?;

        let account_code = self.account_repo.get_next_child_code("123").await?;
        let parent = self.account_repo.find_by_code("123").await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("حساب ذمم العملاء (123) غير موجود".into()))?;

        let new_account_id = AccountId::new();
        let new_account = Account {
            id: new_account_id,
            code: account_code.clone(),
            name_ar: req.name.clone(),
            name_en: req.name.clone(),
            account_type: AccountType::Assets,
            parent_id: Some(parent.id),
            category: AccountCategory::Detail,
            level: parent.level + 1,
            opening_balance,
            balance: debit - credit,
            notes: None,
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: Some(customer_id),
            linked_supplier_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo.save(&new_account).await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        customer.link_account(new_account_id);
        self.customer_repo.save(&customer).await?;

        // --- Accounting Integration: Opening Balance ---
        let total_opening = debit - credit;
        if total_opening != Decimal::ZERO {
            let opening_equity = self.account_repo.find_by_code("3002").await?
                .ok_or_else(|| AppError::NotFound("حساب الأرصدة الافتتاحية (3002) غير موجود".into()))?;

            let amount_ma = MonetaryAmount::new(Money::new(total_opening.abs(), currency.clone()), Decimal::ONE);
            let zero_ma = MonetaryAmount::zero(currency.clone());

            let mut lines = Vec::new();
            if total_opening > Decimal::ZERO {
                // Customer Debit, Equity Credit
                lines.push(JournalLine::new(new_account_id, amount_ma.clone(), zero_ma.clone(), format!("رصيد افتتاحي مدين للعميل: {}", customer.name)));
                lines.push(JournalLine::new(opening_equity.id, zero_ma, amount_ma, format!("رصيد افتتاحي للعميل: {}", customer.name)));
            } else {
                // Equity Debit, Customer Credit
                lines.push(JournalLine::new(opening_equity.id, amount_ma.clone(), zero_ma.clone(), format!("رصيد افتتاحي دائن للعميل: {}", customer.name)));
                lines.push(JournalLine::new(new_account_id, zero_ma, amount_ma, format!("رصيد افتتاحي للعميل: {}", customer.name)));
            }

            let mut entry = JournalEntry::new(
                format!("OP-CUST-{}", customer.id.0.simple()),
                JournalType::AccountOpeningBalance,
                lines,
                Utc::now(),
                format!("قيد افتتاح رصيد العميل: {}", customer.name),
                Some(customer.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(CustomerDto::from(customer))
    }
}


