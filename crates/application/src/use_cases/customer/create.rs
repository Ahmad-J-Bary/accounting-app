use chrono::Utc;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::customers::Customer;
use domain::shared::ids::{AccountId, CustomerId};
use domain::shared::{Currency, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::constants::{RECEIVABLES_PARENT_ID, OPENING_EQUITY_ID};
use std::str::FromStr;

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
        Self {
            customer_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, req: CreateCustomerRequest) -> Result<CustomerDto, AppError> {
        let customer_id = CustomerId::new();

        // Get next sequential customer number (starting from 1, as 0 is reserved for cash customer)
        let next_customer_num = self.customer_repo.get_next_customer_number().await?;
        let code = next_customer_num.to_string();
        let code_for_account = code.clone();

        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance =
            crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;
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
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.customer_repo.save(&customer).await?;

        // Find the parent account dynamically using its fixed System ID
        let parent_id = AccountId::from_str(RECEIVABLES_PARENT_ID).unwrap();
        let parent = self
            .account_repo
            .find_by_id(&parent_id)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("حساب ذمم العملاء الرئيسي غير موجود في النظام".into()))?;

        // Generate account code dynamically based on the CURRENT parent code
        let account_code = format!("{}{}", parent.code, code_for_account);

        // Add "رقم الحساب" suffix to the account name
        let account_name = req.name.clone();

        let new_account_id = AccountId::new();
        let new_account = Account {
            id: new_account_id,
            code: account_code.clone(),
            name_ar: account_name,
            name_en: req.name,
            account_type: AccountType::Assets,
            parent_id: Some(parent.id),
            category: AccountCategory::Detail,
            level: parent.level + 1,
            opening_balance,
            balance: debit - credit,
            debit,
            credit,
            notes: None,
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: Some(customer_id),
            linked_supplier_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo
            .save(&new_account)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        customer.link_account(new_account_id);
        self.customer_repo.save(&customer).await?;

        // --- Accounting Integration: Opening Balance ---
        let total_opening = debit - credit;
        if total_opening != Decimal::ZERO {
            let equity_id = AccountId::from_str(OPENING_EQUITY_ID).unwrap();
            let opening_equity = self
                .account_repo
                .find_by_id(&equity_id)
                .await?
                .ok_or_else(|| {
                    AppError::NotFound("حساب رأس المال / رصيد افتتاحي غير موجود".into())
                })?;

            let amount_ma = MonetaryAmount::new(
                Money::new(total_opening.abs(), currency.clone()),
                Decimal::ONE,
            );
            let zero_ma = MonetaryAmount::zero(currency.clone());

            let mut lines = Vec::new();
            if total_opening > Decimal::ZERO {
                // Customer Debit, Equity Credit
                lines.push(JournalLine::new(
                    new_account_id,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    format!("رصيد افتتاحي مدين للعميل: {}", customer.name),
                ));
                lines.push(JournalLine::new(
                    opening_equity.id,
                    zero_ma,
                    amount_ma,
                    format!("رصيد افتتاحي للعميل: {}", customer.name),
                ));
            } else {
                // Equity Debit, Customer Credit
                lines.push(JournalLine::new(
                    opening_equity.id,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    format!("رصيد افتتاحي دائن للعميل: {}", customer.name),
                ));
                lines.push(JournalLine::new(
                    new_account_id,
                    zero_ma,
                    amount_ma,
                    format!("رصيد افتتاحي للعميل: {}", customer.name),
                ));
            }

            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                JournalType::AccountOpeningBalance,
                lines,
                Utc::now(),
                format!("قيد افتتاح رصيد العميل: {}", customer.name),
                Some(customer.id.to_string()),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(CustomerDto::from(customer))
    }
}
