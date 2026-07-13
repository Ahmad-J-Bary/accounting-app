use domain::customers::Customer;
use domain::shared::ids::CustomerId;
use domain::shared::Currency;
use rust_decimal::Decimal;
use std::sync::Arc;
use std::str::FromStr;

use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::constants::RECEIVABLES_PARENT_ID;
use crate::use_cases::shared::partner_account::{
    PartnerAccountParams, PartnerKind,
    create_partner_account, create_opening_balance_entry,
};

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

        // Sequential code (0 is reserved for cash customer)
        let next_num = self.customer_repo.get_next_customer_number().await?;
        let code = next_num.to_string();

        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance = crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;

        let currency_code = req.currency.clone().unwrap_or_default();
        let currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
        let fx_rate = if currency.is_base {
            Decimal::ONE
        } else {
            req.exchange_rate
                .as_deref()
                .and_then(|s| Decimal::from_str(s).ok())
                .filter(|r| *r > Decimal::ZERO)
                .unwrap_or(Decimal::ONE)
        };

        let mut customer = Customer::new_with_id(
            customer_id,
            code.clone(),
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

        // Create linked ledger account
        let new_account_id = create_partner_account(
            PartnerAccountParams {
                partner_id_str: customer_id.to_string(),
                code: &code,
                code_for_account: &code,
                name: &req.name,
                opening_balance,
                debit,
                credit,
                currency: currency.clone(),
                fx_rate,
                parent_account_id: RECEIVABLES_PARENT_ID,
                kind: PartnerKind::Customer,
            },
            &self.account_repo,
        ).await?;

        customer.link_account(new_account_id);
        self.customer_repo.save(&customer).await?;

        // Create opening balance journal entry
        let net_balance = debit - credit;
        create_opening_balance_entry(
            new_account_id,
            &customer.name,
            &customer.id.to_string(),
            net_balance,
            currency,
            fx_rate,
            "53",
            PartnerKind::Customer,
            &self.account_repo,
            &self.journal_repo,
        ).await?;

        Ok(CustomerDto::from(customer))
    }
}
