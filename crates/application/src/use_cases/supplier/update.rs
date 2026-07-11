use std::sync::Arc;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::{AccountId, SupplierId};
use domain::shared::{Currency, MonetaryAmount};

use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::supplier_dto::{UpdateSupplierRequest, SupplierDto};
use crate::errors::AppError;

pub struct UpdateSupplierUseCase {
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateSupplierUseCase {
    pub fn new(
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: UpdateSupplierRequest) -> Result<SupplierDto, AppError> {
        let sid = req.id.parse::<SupplierId>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let mut supplier = self.supplier_repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

        let old_debit = supplier.debit;
        let old_credit = supplier.credit;

        supplier.update_info(req.name.clone(), req.phone.clone(), req.address.clone(), req.notes.clone())
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        supplier.code = crate::utils::ensure_code(Some(req.code), supplier.code);

        if let Some(ref acc_id_str) = req.account_id {
            let account_id = acc_id_str.parse::<AccountId>()
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

        let new_balance = supplier.credit - supplier.debit;
        let old_balance = old_credit - old_debit;
        let balance_change = new_balance - old_balance;

        if balance_change != Decimal::ZERO {
            if let Some(ref account_id) = &supplier.account_id {
                let adjustment_account = self.account_repo.find_by_code("53").await?
                    .ok_or_else(|| AppError::NotFound("حساب الرصيد الافتتاحي غير موجود: 53".into()))?;

                let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
                let amount = MonetaryAmount::from_base(balance_change.abs(), base_currency.clone());
                let zero = MonetaryAmount::zero(base_currency);

                let lines = if balance_change > Decimal::ZERO {
                    // We owe more: Dr 224, Cr supplier
                    vec![
                        JournalLine::new(
                            adjustment_account.id,
                            amount.clone(),
                            zero.clone(),
                            format!("تسوية رصيد المورد (مدين) - {}", supplier.name),
                        ),
                        JournalLine::new(
                            *account_id,
                            zero,
                            amount,
                            format!("تسوية رصيد المورد (دائن) - {}", supplier.name),
                        ),
                    ]
                } else {
                    // We owe less: Dr supplier, Cr 224
                    vec![
                        JournalLine::new(
                            *account_id,
                            amount.clone(),
                            zero.clone(),
                            format!("تسوية رصيد المورد (مدين) - {}", supplier.name),
                        ),
                        JournalLine::new(
                            adjustment_account.id,
                            zero,
                            amount,
                            format!("تسوية رصيد المورد (دائن) - {}", supplier.name),
                        ),
                    ]
                };

                let mut entry = JournalEntry::new(
                    self.journal_repo.get_next_entry_number().await?,
                    JournalType::AccountOpeningBalance,
                    lines,
                    Utc::now(),
                    format!("تعديل رصيد المورد: {}", supplier.name),
                    Some(supplier.id.to_string()),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                self.journal_repo.save(&entry).await?;
            }
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
