use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::supplier_repository::SupplierRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId};
use domain::shared::{Currency, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;

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
        Self {
            payment_repo,
            journal_repo,
            account_repo,
            customer_repo,
            supplier_repo,
            currency_repo,
        }
    }

    pub async fn execute(
        &self,
        partner_type: String,
        partner_id: String,
    ) -> Result<String, AppError> {
        let base_currency = self
            .currency_repo
            .get_base_currency()
            .await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        let doc_currency = Currency::new(
            &base_currency.code,
            &base_currency.code,
            &base_currency.code,
            "",
            2,
            false,
        );
        let fx_rate = Decimal::ONE;

        let cash_account = self
            .account_repo
            .find_by_code("122")
            .await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

        match partner_type.as_str() {
            "customer" => {
                let cid = CustomerId::from_str(&partner_id)
                    .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
                let mut customer = self
                    .customer_repo
                    .find_by_id(&cid)
                    .await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                let cust_acc_id = customer
                    .account_id
                    .ok_or_else(|| AppError::NotFound("العميل ليس له حساب مالي".into()))?;

                let effective = customer.debit - customer.credit;
                if effective == Decimal::ZERO {
                    return Ok("0".to_string());
                }

                let (payment_type, jtype, amount, lines) = if effective > Decimal::ZERO {
                    (
                        PaymentType::Receipt,
                        JournalType::CashReceipt,
                        effective,
                        vec![
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::new(
                                    Money::new(effective, doc_currency.clone()),
                                    fx_rate,
                                ),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("قبض من العميل: {}", customer.name),
                            ),
                            JournalLine::new(
                                cust_acc_id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(
                                    Money::new(effective, doc_currency.clone()),
                                    fx_rate,
                                ),
                                format!("دفعة من العميل: {}", customer.name),
                            )
                            .with_partner(cid.0),
                        ],
                    )
                } else {
                    let amount = -effective;
                    (
                        PaymentType::CustomerPayment,
                        JournalType::CustomerPaymentJournal,
                        amount,
                        vec![
                            JournalLine::new(
                                cust_acc_id,
                                MonetaryAmount::new(
                                    Money::new(amount, doc_currency.clone()),
                                    fx_rate,
                                ),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("دفع للعميل: {}", customer.name),
                            )
                            .with_partner(cid.0),
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(
                                    Money::new(amount, doc_currency.clone()),
                                    fx_rate,
                                ),
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
                )
                .map_err(|e| AppError::Invalid(e.to_string()))?;

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
                )
                .map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                payment.journal_entry_number = Some(entry_number.clone());
                payment.reference = Some("settlement".to_string());

                if effective > Decimal::ZERO {
                    customer
                        .increase_credit(effective)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                } else {
                    customer
                        .decrease_credit(-effective)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                }

                // Journal + payment + counter-party balance change committed in
                // ONE transaction (Sec 9 atomicity). No partial settlement can
                // survive a failure.
                self.payment_repo
                    .save_settlement(&payment, &entry, Some(&customer), None)
                    .await?;

                Ok(entry_number)
            }
            "supplier" => {
                let sid = SupplierId::from_str(&partner_id)
                    .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
                let mut supplier = self
                    .supplier_repo
                    .find_by_id(&sid)
                    .await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                let supp_acc_id = supplier
                    .account_id
                    .ok_or_else(|| AppError::NotFound("المورد ليس له حساب مالي".into()))?;

                let effective = supplier.credit - supplier.debit;
                if effective == Decimal::ZERO {
                    return Ok("0".to_string());
                }

                let (payment_type, jtype, amount, lines) = if effective > Decimal::ZERO {
                    (
                        PaymentType::SupplierPayment,
                        JournalType::CashPayment,
                        effective,
                        vec![
                            JournalLine::new(
                                supp_acc_id,
                                MonetaryAmount::new(
                                    Money::new(effective, doc_currency.clone()),
                                    fx_rate,
                                ),
                                MonetaryAmount::zero(doc_currency.clone()),
                                "دفعة على الحساب".to_string(),
                            )
                            .with_partner(sid.0),
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(
                                    Money::new(effective, doc_currency.clone()),
                                    fx_rate,
                                ),
                                "دفعة على الحساب".to_string(),
                            ),
                        ],
                    )
                } else {
                    let amount = -effective;
                    (
                        PaymentType::SupplierReceipt,
                        JournalType::SupplierReceiptJournal,
                        amount,
                        vec![
                            JournalLine::new(
                                cash_account.id,
                                MonetaryAmount::new(
                                    Money::new(amount, doc_currency.clone()),
                                    fx_rate,
                                ),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("قبض من المورد: {}", supplier.name),
                            ),
                            JournalLine::new(
                                supp_acc_id,
                                MonetaryAmount::zero(doc_currency.clone()),
                                MonetaryAmount::new(
                                    Money::new(amount, doc_currency.clone()),
                                    fx_rate,
                                ),
                                format!("مقبوضات من مورد: {}", supplier.name),
                            )
                            .with_partner(sid.0),
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
                )
                .map_err(|e| AppError::Invalid(e.to_string()))?;

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
                )
                .map_err(|e| AppError::Invalid(e.to_string()))?;

                entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                payment.journal_entry_number = Some(entry_number.clone());
                payment.reference = Some("settlement".to_string());

                if effective > Decimal::ZERO {
                    supplier
                        .increase_debit(effective)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                } else {
                    supplier
                        .decrease_debit(-effective)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                }

                // Journal + payment + counter-party balance change committed in
                // ONE transaction (Sec 9 atomicity).
                self.payment_repo
                    .save_settlement(&payment, &entry, None, Some(&supplier))
                    .await?;

                Ok(entry_number)
            }
            _ => Err(AppError::Invalid(
                "نوع الشريك غير صالح: استخدم customer أو supplier".into(),
            )),
        }
    }
}
