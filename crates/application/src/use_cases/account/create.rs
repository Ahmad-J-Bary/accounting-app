use std::sync::Arc;
use std::str::FromStr;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::shared::currency::Currency;
use domain::shared::ids::{CustomerId, SupplierId};
use domain::customers::Customer;
use domain::suppliers::Supplier;

use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;

use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::constants::{RECEIVABLES_PARENT_ID, PAYABLES_PARENT_ID};
use crate::use_cases::opening_balance::opening_window_active;

use super::error::AccountUseCaseError;
use super::types::CreateAccountCommand;
use super::validation::AccountValidation;

pub struct CreateAccountUseCase {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    customer_repo: Option<Arc<dyn CustomerRepository>>,
    supplier_repo: Option<Arc<dyn SupplierRepository>>,
    currency_repo: Arc<dyn CurrencyRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl CreateAccountUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        customer_repo: Option<Arc<dyn CustomerRepository>>,
        supplier_repo: Option<Arc<dyn SupplierRepository>>,
        currency_repo: Arc<dyn CurrencyRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo,
            customer_repo,
            supplier_repo,
            currency_repo,
            opening_migration_repo,
        }
    }

    pub async fn execute(
        &self,
        cmd: CreateAccountCommand,
    ) -> Result<Account, AccountUseCaseError> {
        let opening_balance = Decimal::from_str(&cmd.opening_balance)
            .map_err(|e| AccountUseCaseError::InvalidDecimal(e.to_string()))?;

        AccountValidation::validate_names_and_code(&cmd)?;
        AccountValidation::ensure_code_not_exists(&*self.account_repo, &cmd.code, None).await?;
        AccountValidation::validate_parent_and_level(&*self.account_repo, &cmd).await?;
        AccountValidation::validate_type_hierarchy(&*self.account_repo, &cmd).await?;
        AccountValidation::protect_root_policy_on_create(&cmd)?;

        let _linked_customer_id = cmd.linked_customer_id
            .as_deref()
            .and_then(|s| s.parse::<CustomerId>().ok());

        let _linked_supplier_id = cmd.linked_supplier_id
            .as_deref()
            .and_then(|s| s.parse::<SupplierId>().ok());

        let final_name_ar = cmd.name_ar.trim().to_string();

        // Get currency and exchange rate
        let base_currency = self.currency_repo.get_base_currency().await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
            .unwrap_or(Currency::new("USD", "دولار أمريكي", "US Dollar", "$", 2, true));
        
        let currency_code = cmd.currency.as_deref().unwrap_or(&base_currency.code);
        let currency = if currency_code == base_currency.code {
            base_currency
        } else {
            self.currency_repo.find_by_code(currency_code).await
                .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?
                .unwrap_or(Currency::new(currency_code, currency_code, currency_code, "", 2, false))
        };

        let exchange_rate = cmd.exchange_rate.as_deref()
            .and_then(|s| Decimal::from_str(s).ok())
            .filter(|r| *r > Decimal::ZERO)
            .unwrap_or(Decimal::ONE);

        let debit = cmd.debit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO);
        let credit = cmd.credit.as_deref().and_then(|s| Decimal::from_str(s).ok()).unwrap_or(Decimal::ZERO);

        // While an opening-balance migration window is open (ExistingCompany),
        // the migration's aggregate journal owns the ledger. New CoA accounts
        // are created with a static zero opening balance and the per-account
        // AccountOpeningBalance journal below is deferred — the same treatment
        // the company lifecycle applies to customer/supplier create, so the same balance can
        // never be posted twice (R1).
        let opening_window = opening_window_active(&self.opening_migration_repo)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;
        let (opening_balance, debit, credit) = if opening_window {
            (Decimal::ZERO, Decimal::ZERO, Decimal::ZERO)
        } else {
            (opening_balance, debit, credit)
        };

        let _is_final = cmd.category == domain::accounting::account::AccountCategory::Detail;

        let mut account = Account::new(
            cmd.code.trim().to_string(),
            final_name_ar,
            cmd.name_en.trim().to_string(),
            cmd.account_type,
            cmd.parent_id,
            cmd.category,
            cmd.level,
            opening_balance,
            debit,
            credit,
            currency,
            exchange_rate,
            cmd.notes.as_ref().map(|n| n.trim().to_string()),
        ).map_err(AccountUseCaseError::from)?;

        // Account::new() computes balance = opening_balance + debit - credit.
        // After the direction-toggle refactoring, debit/credit may represent
        // the same amount as opening_balance (direction-toggle pattern),
        // causing double-counting. Detect and fix: if one of debit/credit
        // equals opening_balance and the other is zero, subtract the duplicate.
        if (debit > Decimal::ZERO && debit == opening_balance && credit == Decimal::ZERO)
            || (credit > Decimal::ZERO && credit == opening_balance && debit == Decimal::ZERO)
        {
            account.balance -= opening_balance;
        }

        self.account_repo
            .save(&account)
            .await
            .map_err(|e| AccountUseCaseError::RepositoryError(e.to_string()))?;

        let debit = cmd.debit.as_deref()
            .and_then(|s| Decimal::from_str(s).ok())
            .unwrap_or(Decimal::ZERO);
        let credit = cmd.credit.as_deref()
            .and_then(|s| Decimal::from_str(s).ok())
            .unwrap_or(Decimal::ZERO);

        // Create AccountOpeningBalance journal entry for every new account
        // (skip for auto-created customer/supplier accounts, their entries are
        // handled separately; skip while an opening-migration window is open,
        // the migration's aggregate journal owns the ledger).
        let is_receivable_or_payable = cmd.parent_id.as_ref().map(|p| {
            let pid = p.to_string();
            pid == RECEIVABLES_PARENT_ID || pid == PAYABLES_PARENT_ID
        }).unwrap_or(false);

        if !is_receivable_or_payable && !opening_window {
            let total_opening = debit - credit;

            // Single-sided entry: the COA account form records only
            // `opening_balance` (no direction pair). Derive the leg from the
            // account's normal balance so the opening journal actually books
            // the balance — otherwise the tree, which feeds off posted
            // journals, stays zero after the opening window closes.
            let (opening_amount, debit_nature) =
                if total_opening == Decimal::ZERO && opening_balance > Decimal::ZERO {
                    (
                        opening_balance,
                        matches!(
                            account.normal_balance(),
                            domain::accounting::account::NormalBalance::Debit
                        ),
                    )
                } else {
                    (total_opening.abs(), total_opening > Decimal::ZERO)
                };

            super::opening_journal::book_opening_journal(
                &account,
                opening_amount,
                debit_nature,
                &self.account_repo,
                &self.journal_repo,
            )
            .await?;
        }

        // Auto-create customer if account is under Receivables Parent
        let is_receivable = cmd.parent_id.as_ref().map(|p| p.to_string() == RECEIVABLES_PARENT_ID).unwrap_or(false);
        if is_receivable {
            if let Some(ref customer_repo) = self.customer_repo {
                // Extract customer number: suffix of the code
                let parent_code = self.account_repo.find_by_id(cmd.parent_id.as_ref().unwrap()).await.ok().flatten().map(|p| p.code).unwrap_or_default();
                let customer_num = if account.code.starts_with(&parent_code) { &account.code[parent_code.len()..] } else { &account.code };
                
                let customer_id = CustomerId::new();

                let customer = Customer::new_with_id(
                    customer_id,
                    customer_num.to_string(),
                    account.name_ar.clone(),
                    cmd.phone.clone(),
                    cmd.address.clone(),
                    Some(account.id),
                    debit,
                    credit,
                    account.opening_balance,
                    account.currency.clone(),
                    cmd.notes.clone(),
                );

                if let Ok(customer) = customer {
                    let _ = customer_repo.save(&customer).await;
                    let mut updated_account = account.clone();
                    updated_account.linked_customer_id = Some(customer.id);
                    let _ = self.account_repo.save(&updated_account).await;
                }
            }
        }

        // Auto-create supplier if account is under Payables Parent
        let is_payable = cmd.parent_id.as_ref().map(|p| p.to_string() == PAYABLES_PARENT_ID).unwrap_or(false);
        if is_payable {
            if let Some(ref supplier_repo) = self.supplier_repo {
                // Extract supplier number: suffix of the code
                let parent_code = self.account_repo.find_by_id(cmd.parent_id.as_ref().unwrap()).await.ok().flatten().map(|p| p.code).unwrap_or_default();
                let supplier_num = if account.code.starts_with(&parent_code) { &account.code[parent_code.len()..] } else { &account.code };
                
                let supplier_id = SupplierId::new();

                let supplier = Supplier::new_with_id(
                    supplier_id,
                    supplier_num.to_string(),
                    account.name_ar.clone(),
                    cmd.phone.clone(),
                    cmd.address.clone(),
                    Some(account.id),
                    debit,
                    credit,
                    account.opening_balance,
                    account.currency.clone(),
                    cmd.notes.clone(),
                );

                if let Ok(supplier) = supplier {
                    let _ = supplier_repo.save(&supplier).await;
                    let mut updated_account = account.clone();
                    updated_account.linked_supplier_id = Some(supplier.id);
                    let _ = self.account_repo.save(&updated_account).await;
                }
            }
        }

        Ok(account)
    }
}
