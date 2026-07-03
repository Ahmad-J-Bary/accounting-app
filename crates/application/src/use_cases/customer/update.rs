use std::sync::Arc;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::{AccountId, CustomerId};
use domain::shared::{Currency, MonetaryAmount};

use crate::ports::customer_repository::CustomerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::customer_dto::{UpdateCustomerRequest, CustomerDto};
use crate::errors::AppError;

pub struct UpdateCustomerUseCase {
    customer_repo: Arc<dyn CustomerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateCustomerUseCase {
    pub fn new(
        customer_repo: Arc<dyn CustomerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { customer_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: UpdateCustomerRequest) -> Result<CustomerDto, AppError> {
        let cid = req.id.parse::<CustomerId>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let mut customer = self.customer_repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        let old_debit = customer.debit;
        let old_credit = customer.credit;

        customer.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        customer.code = crate::utils::ensure_code(Some(req.code), customer.code);

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = acc_id_str.parse::<AccountId>()
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            customer.link_account(account_id);
        }

        if let Some(ref d) = req.debit {
            customer.debit = crate::utils::parse_decimal(Some(d), "المدين")?;
            customer.balance = customer.debit - customer.credit;
        }
        if let Some(ref c) = req.credit {
            customer.credit = crate::utils::parse_decimal(Some(c), "الدائن")?;
            customer.balance = customer.debit - customer.credit;
        }

        if let Some(ref ob) = req.opening_balance {
            customer.opening_balance = crate::utils::parse_decimal(Some(ob), "رصيد الافتتاح")?;
        }

        if let Some(ref cur) = req.currency {
            customer.currency = crate::utils::parse_currency(Some(cur));
        }

        if req.is_active {
            customer.activate();
        } else {
            customer.deactivate();
        }

        let new_balance = customer.debit - customer.credit;
        let old_balance = old_debit - old_credit;
        let balance_change = new_balance - old_balance;

        // Create journal entry if balance changed
        if balance_change != Decimal::ZERO {
            if let Some(ref account_id) = &customer.account_id {
                let adjustment_account = self.account_repo.find_by_code("222").await?
                    .ok_or_else(|| AppError::NotFound("حساب رأس المال غير موجود: 222".into()))?;

                let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
                let amount = MonetaryAmount::from_base(balance_change.abs(), base_currency.clone());
                let zero = MonetaryAmount::zero(base_currency);

                let lines = if balance_change > Decimal::ZERO {
                    vec![
                        JournalLine::new(
                            *account_id,
                            amount.clone(),
                            zero.clone(),
                            format!("تسوية رصيد العميل (مدين) - {}", customer.name),
                        ),
                        JournalLine::new(
                            adjustment_account.id,
                            zero,
                            amount,
                            format!("تسوية رصيد العميل (دائن) - {}", customer.name),
                        ),
                    ]
                } else {
                    vec![
                        JournalLine::new(
                            adjustment_account.id,
                            amount.clone(),
                            zero.clone(),
                            format!("تسوية رصيد العميل (مدين) - {}", customer.name),
                        ),
                        JournalLine::new(
                            *account_id,
                            zero,
                            amount,
                            format!("تسوية رصيد العميل (دائن) - {}", customer.name),
                        ),
                    ]
                };

                let mut entry = JournalEntry::new(
                    self.journal_repo.get_next_entry_number().await?,
                    JournalType::AccountOpeningBalance,
                    lines,
                    Utc::now(),
                    format!("تعديل رصيد العميل: {}", customer.name),
                    Some(customer.id.to_string()),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                self.journal_repo.save(&entry).await?;
            }
        }

        self.customer_repo.update(&customer).await?;

        if let Some(ref account_id) = &customer.account_id {
            if let Some(mut account) = self.account_repo.find_by_id(account_id).await
                .map_err(|e| AppError::Infrastructure(e.to_string()))? {
                account.name_ar = customer.name.clone();
                account.name_en = customer.name.clone();
                account.balance = customer.balance;
                account.updated_at = Utc::now();
                self.account_repo.save(&account).await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
            }
        }

        Ok(CustomerDto::from(customer))
    }
}
