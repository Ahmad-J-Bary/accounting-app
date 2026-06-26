use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId};
use domain::shared::{Currency, Money, MonetaryAmount};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::errors::AppError;

pub struct SettlePartnerBalanceUseCase {
    payment_repo: Arc<dyn PaymentRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
}

impl SettlePartnerBalanceUseCase {
    pub fn new(
        payment_repo: Arc<dyn PaymentRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
    ) -> Self {
        Self { payment_repo, journal_repo, account_repo, customer_repo, supplier_repo, currency_repo }
    }

    pub async fn execute(
        &self,
        partner_type: String,
        partner_id: String,
    ) -> Result<String, AppError> {
        let base_currency = self.currency_repo.get_base_currency().await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        let doc_currency = Currency::new(&base_currency.code, &base_currency.code, &base_currency.code, "", 2, false);
        let fx_rate = Decimal::ONE;

        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

        match partner_type.as_str() {
            "customer" => {
                let cid = CustomerId::from_str(&partner_id)
                    .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
                let customer = self.customer_repo.find_by_id(&cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                let cust_acc_id = customer.account_id
                    .ok_or_else(|| AppError::NotFound("العميل ليس له حساب مالي".into()))?;

                if customer.debit <= Decimal::ZERO && customer.credit <= Decimal::ZERO {
                    return Ok("0".to_string());
                }

                let (payment_type, jtype, amount, lines) = if customer.debit > Decimal::ZERO {
                    let amount = customer.debit;
                    (
                        PaymentType::Receipt,
                        JournalType::CashReceipt,
                        amount,
                        vec![
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("قبض من العميل: {}", customer.name),
                            ),
                            JournalLine::new(
                                cust_acc_id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                format!("دفعة من العميل: {}", customer.name),
                            ).with_partner(cid.0),
                        ],
                    )
                } else {
                    let amount = customer.credit;
                    (
                        PaymentType::CustomerPayment,
                        JournalType::CustomerPaymentJournal,
                        amount,
                        vec![
                            JournalLine::new(
                                cust_acc_id,
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("دفع للعميل: {}", customer.name),
                            ).with_partner(cid.0),
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                format!("دفعة للعميل: {}", customer.name),
                            ),
                        ],
                    )
                };

                let voucher_prefix = match payment_type {
                    PaymentType::Receipt => "RCV",
                    PaymentType::CustomerPayment => "CPY",
                    _ => unreachable!(),
                };
                let voucher_number = format!("{}-{}", voucher_prefix, Utc::now().timestamp());

                let mut payment = Payment::new(
                    voucher_number,
                    payment_type,
                    amount,
                    base_currency.code.clone(),
                    fx_rate,
                    Utc::now(),
                    None,
                    None,
                    Some(cid),
                    None,
                    None,
                    None,
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                match payment.payment_type {
                    PaymentType::Receipt => {
                        payment.debit_account_id = Some(cash_account.id);
                        payment.credit_account_id = Some(cust_acc_id);
                    }
                    PaymentType::CustomerPayment => {
                        payment.debit_account_id = Some(cust_acc_id);
                        payment.credit_account_id = Some(cash_account.id);
                    }
                    _ => {}
                }

                let entry_number = self.journal_repo.get_next_entry_number().await?;
                let mut entry = JournalEntry::new(
                    entry_number.clone(),
                    jtype,
                    lines,
                    Utc::now(),
                    "سند مالي".to_string(),
                    Some(payment.id.to_string()),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                self.journal_repo.save(&entry).await?;
                payment.journal_entry_number = Some(entry_number.clone());
                self.payment_repo.save(&payment).await?;

                let mut updated = customer;
                updated.debit = Decimal::ZERO;
                updated.credit = Decimal::ZERO;
                updated.balance = Decimal::ZERO;
                self.customer_repo.update(&updated).await?;

                Ok(entry_number)
            }
            "supplier" => {
                let sid = SupplierId::from_str(&partner_id)
                    .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
                let supplier = self.supplier_repo.find_by_id(&sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                let supp_acc_id = supplier.account_id
                    .ok_or_else(|| AppError::NotFound("المورد ليس له حساب مالي".into()))?;

                if supplier.debit <= Decimal::ZERO && supplier.credit <= Decimal::ZERO {
                    return Ok("0".to_string());
                }

                let (payment_type, jtype, amount, lines) = if supplier.credit > Decimal::ZERO {
                    let amount = supplier.credit;
                    (
                        PaymentType::SupplierPayment,
                        JournalType::CashPayment,
                        amount,
                        vec![
                            JournalLine::new(
                                supp_acc_id,
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                MonetaryAmount::zero(doc_currency.clone()),
                                "دفعة على الحساب".to_string(),
                            ).with_partner(sid.0),
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                "دفعة على الحساب".to_string(),
                            ),
                        ],
                    )
                } else {
                    let amount = supplier.debit;
                    (
                        PaymentType::SupplierReceipt,
                        JournalType::SupplierReceiptJournal,
                        amount,
                        vec![
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("قبض من المورد: {}", supplier.name),
                            ),
                            JournalLine::new(
                                supp_acc_id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(Money::new(amount, doc_currency.clone()), fx_rate),
                                format!("مقبوضات من مورد: {}", supplier.name),
                            ).with_partner(sid.0),
                        ],
                    )
                };

                let voucher_prefix = match payment_type {
                    PaymentType::SupplierPayment => "PAY",
                    PaymentType::SupplierReceipt => "SRC",
                    _ => unreachable!(),
                };
                let voucher_number = format!("{}-{}", voucher_prefix, Utc::now().timestamp());

                let mut payment = Payment::new(
                    voucher_number,
                    payment_type,
                    amount,
                    base_currency.code.clone(),
                    fx_rate,
                    Utc::now(),
                    None,
                    None,
                    None,
                    Some(sid),
                    None,
                    None,
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                match payment.payment_type {
                    PaymentType::SupplierPayment => {
                        payment.debit_account_id = Some(supp_acc_id);
                        payment.credit_account_id = Some(cash_account.id);
                    }
                    PaymentType::SupplierReceipt => {
                        payment.debit_account_id = Some(cash_account.id);
                        payment.credit_account_id = Some(supp_acc_id);
                    }
                    _ => {}
                }

                let entry_number = self.journal_repo.get_next_entry_number().await?;
                let mut entry = JournalEntry::new(
                    entry_number.clone(),
                    jtype,
                    lines,
                    Utc::now(),
                    "سند مالي".to_string(),
                    Some(payment.id.to_string()),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                self.journal_repo.save(&entry).await?;
                payment.journal_entry_number = Some(entry_number.clone());
                self.payment_repo.save(&payment).await?;

                let mut updated = supplier;
                updated.debit = Decimal::ZERO;
                updated.credit = Decimal::ZERO;
                updated.balance = Decimal::ZERO;
                self.supplier_repo.update(&updated).await?;

                Ok(entry_number)
            }
            _ => Err(AppError::Invalid("نوع الشريك غير صالح: استخدم customer أو supplier".into()))
        }
    }
}
