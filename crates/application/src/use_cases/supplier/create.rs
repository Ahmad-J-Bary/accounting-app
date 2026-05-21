use chrono::Utc;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::exchange_rate::RateType;
use domain::shared::ids::{AccountId, SupplierId};
use domain::shared::{Currency, MonetaryAmount, Money};
use domain::suppliers::Supplier;
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::dto::supplier_dto::{CreateSupplierRequest, SupplierDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::constants::PAYABLES_PARENT_ID;
use std::str::FromStr;

pub struct CreateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl CreateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self {
            supplier_repo,
            account_repo,
            journal_repo,
            rate_repo,
        }
    }

    pub async fn execute(&self, req: CreateSupplierRequest) -> Result<SupplierDto, AppError> {
        let supplier_id = SupplierId::new();

        // Get next sequential supplier number (starting from 1, as 0 is reserved for cash supplier)
        let next_supplier_num = self.supplier_repo.get_next_supplier_number().await?;
        let code = next_supplier_num.to_string();
        let code_for_account = code.clone();

        let debit = crate::utils::parse_decimal(req.debit.as_deref(), "المدين")?;
        let credit = crate::utils::parse_decimal(req.credit.as_deref(), "الدائن")?;
        let opening_balance =
            crate::utils::parse_decimal(req.opening_balance.as_deref(), "رصيد الافتتاح")?;

        // Use currency from request, default to SYP
        let is_usd = req.currency.as_deref() == Some("USD");
        let currency = if is_usd { Currency::usd() } else { Currency::syp() };
        let fx_rate = if !is_usd {
            self.rate_repo
                .find_latest("USD", "SYP", RateType::Middle)
                .await?
                .map(|r| r.rate)
                .unwrap_or(Decimal::ONE)
        } else {
            Decimal::ONE
        };

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
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.supplier_repo.save(&supplier).await?;

        // Find the parent account dynamically using its fixed System ID
        let parent_id = AccountId::from_str(PAYABLES_PARENT_ID).unwrap();
        let parent = self
            .account_repo
            .find_by_id(&parent_id)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("حساب ذمم الموردين الرئيسي غير موجود في النظام".into()))?;

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
            account_type: AccountType::Liabilities,
            parent_id: Some(parent.id),
            category: AccountCategory::Detail,
            level: parent.level + 1,
            opening_balance,
            balance: credit - debit,
            debit,
            credit,
            notes: None,
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: Some(supplier_id),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.account_repo
            .save(&new_account)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        supplier.link_account(new_account_id);
        self.supplier_repo.save(&supplier).await?;

        // --- Accounting Integration: Opening Balance ---
        let total_opening = credit - debit;
        let cash_account = self
            .account_repo
            .find_by_code("122")
            .await?
            .ok_or_else(|| {
                AppError::NotFound("حساب الصندوق غير موجود".into())
            })?;

        let amount_ma = MonetaryAmount::new(
            Money::new(total_opening.abs(), currency.clone()),
            fx_rate,
        );
        let zero_ma = MonetaryAmount::zero(currency.clone());

        let mut lines = Vec::new();
        if total_opening > Decimal::ZERO {
            // Cash Debit, Supplier Credit
            lines.push(JournalLine::new(
                cash_account.id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("رصيد افتتاحي للمورد: {}", supplier.name),
            ));
            lines.push(JournalLine::new(
                new_account_id,
                zero_ma,
                amount_ma,
                format!("رصيد افتتاحي دائن للمورد: {}", supplier.name),
            ));
        } else {
            // Supplier Debit, Cash Credit
            lines.push(JournalLine::new(
                new_account_id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("رصيد افتتاحي للمورد: {}", supplier.name),
            ));
            lines.push(JournalLine::new(
                cash_account.id,
                zero_ma,
                amount_ma,
                format!("رصيد افتتاحي مدين للمورد: {}", supplier.name),
            ));
        }

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::AccountOpeningBalance,
            lines,
            Utc::now(),
            format!("قيد افتتاح رصيد المورد: {}", supplier.name),
            Some(supplier.id.to_string()),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.journal_repo.save(&entry).await?;

        Ok(SupplierDto::from(supplier))
    }
}
