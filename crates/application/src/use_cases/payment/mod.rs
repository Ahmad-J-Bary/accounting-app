use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId, PaymentId, AccountId};
use crate::ports::payment_repository::PaymentRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, Money, MonetaryAmount};
use crate::dto::payment_dto::{CreatePaymentRequest, PaymentDto};
use crate::errors::AppError;

async fn enrich_payment(
    p: Payment, 
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>
) -> PaymentDto {
    let mut customer_name = None;
    if let Some(cid) = &p.customer_id {
        if let Ok(Some(customer)) = customer_repo.find_by_id(cid).await {
            customer_name = Some(customer.name.clone());
        }
    }

    let mut supplier_name = None;
    if let Some(sid) = &p.supplier_id {
        if let Ok(Some(supplier)) = supplier_repo.find_by_id(sid).await {
            supplier_name = Some(supplier.name.clone());
        }
    }

    PaymentDto {
        id: p.id.to_string(),
        voucher_number: p.voucher_number,
        payment_type: format!("{:?}", p.payment_type),
        amount: p.amount.to_string(),
        currency_code: p.currency_code,
        exchange_rate: p.exchange_rate.to_string(),
        payment_date: p.payment_date.to_rfc3339(),
        debit_account_id: p.debit_account_id.map(|a| a.to_string()),
        credit_account_id: p.credit_account_id.map(|a| a.to_string()),
        journal_entry_number: p.journal_entry_number,
        customer_id: p.customer_id.map(|c| c.to_string()),
        customer_name,
        supplier_id: p.supplier_id.map(|s| s.to_string()),
        supplier_name,
        reference: p.reference,
        notes: p.notes,
        created_at: p.created_at.to_rfc3339(),
    }
}

#[allow(clippy::too_many_arguments)]
async fn reverse_entity_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    debit_account_id: &Option<AccountId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
    account_repo: &Arc<dyn AccountRepository>,
    is_settlement: bool,
) -> Result<(), AppError> {
    match payment_type {
        PaymentType::Receipt => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.decrease_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                customer_repo.update(&customer).await?;
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                supplier_repo.update(&supplier).await?;
            }
        }
        PaymentType::ExpenseVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                account.credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit -= base_amount;
                account_repo.save(&account).await?;
            }
        }
        PaymentType::DrawingsVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                account.credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit -= base_amount;
                account_repo.save(&account).await?;
            }
        }
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                if is_settlement {
                    if customer.debit.is_zero() && customer.credit.is_zero() {
                        customer.credit += base_amount;
                    } else if customer.debit >= base_amount {
                        customer.debit -= base_amount;
                    } else {
                        customer.credit += base_amount - customer.debit;
                        customer.debit = Decimal::ZERO;
                    }
                    customer.balance = customer.debit - customer.credit;
                } else {
                    customer.increase_debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                }
                customer_repo.update(&customer).await?;
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                if is_settlement {
                    if supplier.debit.is_zero() && supplier.credit.is_zero() {
                        supplier.debit += base_amount;
                    } else if supplier.credit >= base_amount {
                        supplier.credit -= base_amount;
                    } else {
                        supplier.debit += base_amount - supplier.credit;
                        supplier.credit = Decimal::ZERO;
                    }
                    supplier.balance = supplier.credit - supplier.debit;
                } else {
                    supplier.increase_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                }
                supplier_repo.update(&supplier).await?;
            }
        }
        _ => {}
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn apply_entity_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    debit_account_id: &Option<AccountId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<(), AppError> {
    match payment_type {
        PaymentType::Receipt => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.increase_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                customer_repo.update(&customer).await?;
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.increase_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                supplier_repo.update(&supplier).await?;
            }
        }
        PaymentType::ExpenseVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                account.debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit += base_amount;
                account_repo.save(&account).await?;
            }
        }
        PaymentType::DrawingsVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                account.debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit += base_amount;
                account_repo.save(&account).await?;
            }
        }
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                customer_repo.update(&customer).await?;
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.decrease_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                supplier_repo.update(&supplier).await?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub struct CreatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreatePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, journal_repo, account_repo }
    }

    pub async fn execute(&self, req: CreatePaymentRequest) -> Result<PaymentDto, AppError> {
        let payment_type = match req.payment_type.as_str() {
            "Receipt" => PaymentType::Receipt,
            "SupplierPayment" => PaymentType::SupplierPayment,
            "CustomerPayment" => PaymentType::CustomerPayment,
            "SupplierReceipt" => PaymentType::SupplierReceipt,
            "ExpenseVoucher" => PaymentType::ExpenseVoucher,
            "DrawingsVoucher" => PaymentType::DrawingsVoucher,
            "CashIn" => PaymentType::CashIn,
            "CashOut" => PaymentType::CashOut,
            _ => PaymentType::Other,
        };

        let amount = Decimal::try_from(req.amount)
            .map_err(|_| AppError::Invalid("المبلغ غير صالح".into()))?;
        let exchange_rate = req.exchange_rate
            .and_then(|v| Decimal::try_from(v).ok())
            .unwrap_or(Decimal::ONE);
        let currency_code = req.currency_code.unwrap_or_default();

        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let customer_id = req.customer_id.map(|id| {
            id.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))
        }).transpose()?;

        let supplier_id = req.supplier_id.map(|id| {
            id.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))
        }).transpose()?;

        let debit_account_id = req.debit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب المدين غير صالح".into()))?;
        let credit_account_id = req.credit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب الدائن غير صالح".into()))?;

        let voucher_number = req.voucher_number.unwrap_or_else(|| {
            let prefix = match payment_type {
                PaymentType::Receipt => "RCV",
                PaymentType::SupplierPayment => "PAY",
                PaymentType::CustomerPayment => "CPY",
                PaymentType::SupplierReceipt => "SRC",
                PaymentType::ExpenseVoucher => "EXP",
                PaymentType::DrawingsVoucher => "DRW",
                _ => "VCH",
            };
            format!("{}-{}", prefix, chrono::Utc::now().timestamp())
        });

        let mut payment = Payment::new(
            voucher_number,
            payment_type,
            amount,
            currency_code.clone(),
            exchange_rate,
            payment_date,
            debit_account_id,
            credit_account_id,
            customer_id,
            supplier_id,
            req.reference,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        // --- Accounting Integration ---
        let mut journal_lines = Vec::new();
        let currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
        let amount_ma = MonetaryAmount::new(
            Money::new(payment.amount, currency.clone()),
            exchange_rate,
        );
        let base_amount = amount_ma.base_amount;
        let zero_ma = MonetaryAmount::zero(currency.clone());

        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود".into()))?;

        let journal_type = match payment.payment_type {
            PaymentType::Receipt => JournalType::CashReceipt,
            PaymentType::SupplierPayment => JournalType::CashPayment,
            PaymentType::CustomerPayment => JournalType::CustomerPaymentJournal,
            PaymentType::SupplierReceipt => JournalType::SupplierReceiptJournal,
            PaymentType::ExpenseVoucher => JournalType::ExpenseVoucher,
            PaymentType::DrawingsVoucher => JournalType::DrawingsVoucher,
            _ => JournalType::CashJournal,
        };

        match payment.payment_type {
            PaymentType::Receipt => {
                if let Some(cid) = &payment.customer_id {
                    let customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    
                    let p_acc_id = customer.account_id
                        .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;

                    let debit_cash = payment.debit_account_id.unwrap_or(cash_account.id);
                    payment.debit_account_id = Some(debit_cash);
                    payment.credit_account_id = Some(p_acc_id);
                    // Debit Cash, Credit Customer
                    journal_lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من العميل: {}", customer.name)));
                    journal_lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("دفعة من العميل: {}", customer.name)).with_partner(cid.0));
                }
            },
            PaymentType::SupplierPayment => {
                if let Some(sid) = &payment.supplier_id {
                    let supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    
                    let p_acc_id = supplier.account_id
                        .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;

                    let credit_cash = payment.credit_account_id.unwrap_or(cash_account.id);
                    payment.debit_account_id = Some(p_acc_id);
                    payment.credit_account_id = Some(credit_cash);
                    // Debit Supplier, Credit Cash
                    journal_lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), "دفعة على الحساب".to_string()).with_partner(sid.0));
                    journal_lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, "دفعة على الحساب".to_string()));
                }
            },
            PaymentType::ExpenseVoucher => {
                let debit_expense = payment.debit_account_id
                    .ok_or_else(|| AppError::Invalid("يجب اختيار حساب المصروف لسند المصاريف".into()))?;
                let credit_cash = payment.credit_account_id.unwrap_or(cash_account.id);
                payment.credit_account_id = Some(credit_cash);
                journal_lines.push(JournalLine::new(
                    debit_expense,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    "سند مصاريف".to_string(),
                ));
                journal_lines.push(JournalLine::new(
                    credit_cash,
                    zero_ma,
                    amount_ma,
                    "صرف من الصندوق لسند مصاريف".to_string(),
                ));
            }
            PaymentType::DrawingsVoucher => {
                let debit_drawings = payment.debit_account_id
                    .ok_or_else(|| AppError::Invalid("يجب اختيار حساب المسحوبات لسند المسحوبات".into()))?;
                let credit_cash = payment.credit_account_id.unwrap_or(cash_account.id);
                payment.credit_account_id = Some(credit_cash);
                journal_lines.push(JournalLine::new(
                    debit_drawings,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    "سند مسحوبات".to_string(),
                ));
                journal_lines.push(JournalLine::new(
                    credit_cash,
                    zero_ma,
                    amount_ma,
                    "صرف من الصندوق لسند مسحوبات".to_string(),
                ));
            }
            PaymentType::CustomerPayment => {
                if let Some(cid) = &payment.customer_id {
                    let customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    let p_acc_id = customer.account_id
                        .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;
                    let credit_cash = payment.credit_account_id.unwrap_or(cash_account.id);
                    payment.debit_account_id = Some(p_acc_id);
                    payment.credit_account_id = Some(credit_cash);
                    journal_lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), format!("دفع للعميل: {}", customer.name)).with_partner(cid.0));
                    journal_lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, format!("دفعة للعميل: {}", customer.name)));
                }
            }
            PaymentType::SupplierReceipt => {
                if let Some(sid) = &payment.supplier_id {
                    let supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    let p_acc_id = supplier.account_id
                        .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;
                    let debit_cash = payment.debit_account_id.unwrap_or(cash_account.id);
                    payment.debit_account_id = Some(debit_cash);
                    payment.credit_account_id = Some(p_acc_id);
                    journal_lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من المورد: {}", supplier.name)));
                    journal_lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("مقبوضات من مورد: {}", supplier.name)).with_partner(sid.0));
                }
            }
            _ => {}
        }

        if !journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut entry = JournalEntry::new(
                entry_number.clone(),
                journal_type,
                journal_lines,
                payment.payment_date,
                payment.notes.clone().unwrap_or_else(|| "سند مالي".to_string()),
                Some(payment.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
            payment.journal_entry_number = Some(entry_number);
        }

        self.repo.save(&payment).await?;

        // Update entity balances so Customer/Supplier/Expense tables reflect the payment
        match payment.payment_type {
            PaymentType::Receipt => {
                if let Some(cid) = &payment.customer_id {
                    let mut customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    customer.increase_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.customer_repo.update(&customer).await?;
                }
            }
            PaymentType::SupplierPayment => {
                if let Some(sid) = &payment.supplier_id {
                    let mut supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    supplier.increase_debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.supplier_repo.update(&supplier).await?;
                }
            }
            PaymentType::ExpenseVoucher => {
                if let Some(debit_acc_id) = payment.debit_account_id {
                    let mut expense_account = self.account_repo.find_by_id(&debit_acc_id).await?
                        .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                    expense_account.debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    expense_account.debit += base_amount;
                    self.account_repo.save(&expense_account).await?;
                }
            }
            PaymentType::DrawingsVoucher => {
                if let Some(debit_acc_id) = payment.debit_account_id {
                    let mut drawings_account = self.account_repo.find_by_id(&debit_acc_id).await?
                        .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                    drawings_account.debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    drawings_account.debit += base_amount;
                    self.account_repo.save(&drawings_account).await?;
                }
            }
            PaymentType::CustomerPayment => {
                if let Some(cid) = &payment.customer_id {
                    let mut customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    customer.decrease_debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.customer_repo.update(&customer).await?;
                }
            }
            PaymentType::SupplierReceipt => {
                if let Some(sid) = &payment.supplier_id {
                    let mut supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    supplier.decrease_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.supplier_repo.update(&supplier).await?;
                }
            }
            _ => {}
        }

        Ok(enrich_payment(payment, &self.customer_repo, &self.supplier_repo).await)
    }
}

pub struct ListPaymentsUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl ListPaymentsUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo }
    }

    pub async fn execute(&self, customer_id: Option<String>, supplier_id: Option<String>) -> Result<Vec<PaymentDto>, AppError> {
        let payments = if let Some(cid) = customer_id {
            let id = cid.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;
            self.repo.list_by_customer(&id).await?
        } else if let Some(sid) = supplier_id {
            let id = sid.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
            self.repo.list_by_supplier(&id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for p in payments {
            dtos.push(enrich_payment(p, &self.customer_repo, &self.supplier_repo).await);
        }
        Ok(dtos)
    }
}

pub struct DeletePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeletePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let pid = id.parse::<PaymentId>()
            .map_err(|_| AppError::Invalid("معرف السند غير صالح".into()))?;

        // Find the payment first to know its type, amount and linked entities
        let payment = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("السند غير موجود".into()))?;

        let currency = Currency::new(&payment.currency_code, &payment.currency_code, &payment.currency_code, "", 2, false);
        let amount_ma = MonetaryAmount::new(
            Money::new(payment.amount, currency),
            payment.exchange_rate,
        );
        let base_amount = amount_ma.base_amount;

        let is_return = payment.reference.as_deref().is_some_and(|r| r.starts_with("return:"));

        // Reverse entity balances (skip for return-related payments — balance is managed by return flow)
        if !is_return {
        match payment.payment_type {
            PaymentType::Receipt => {
                if let Some(cid) = &payment.customer_id {
                    let mut customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    customer.decrease_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.customer_repo.update(&customer).await?;
                }
            }
            PaymentType::SupplierPayment => {
                if let Some(sid) = &payment.supplier_id {
                    let mut supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    supplier.decrease_debit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.supplier_repo.update(&supplier).await?;
                }
            }
            PaymentType::ExpenseVoucher => {
                if let Some(debit_acc_id) = &payment.debit_account_id {
                    let mut expense_account = self.account_repo.find_by_id(debit_acc_id).await?
                        .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                    expense_account.credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    expense_account.debit -= base_amount;
                    self.account_repo.save(&expense_account).await?;
                }
            }
            PaymentType::DrawingsVoucher => {
                if let Some(debit_acc_id) = &payment.debit_account_id {
                    let mut drawings_account = self.account_repo.find_by_id(debit_acc_id).await?
                        .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                    drawings_account.credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    drawings_account.debit -= base_amount;
                    self.account_repo.save(&drawings_account).await?;
                }
            }
            PaymentType::CustomerPayment => {
                if let Some(cid) = &payment.customer_id {
                    let mut customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    if payment.reference.as_deref() == Some("settlement") {
                        if customer.debit.is_zero() && customer.credit.is_zero() {
                            customer.credit += base_amount;
                        } else if customer.debit >= base_amount {
                            customer.debit -= base_amount;
                        } else {
                            customer.credit += base_amount - customer.debit;
                            customer.debit = Decimal::ZERO;
                        }
                        customer.balance = customer.debit - customer.credit;
                    } else {
                        customer.increase_debit(base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                    }
                    self.customer_repo.update(&customer).await?;
                }
            }
            PaymentType::SupplierReceipt => {
                if let Some(sid) = &payment.supplier_id {
                    let mut supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    if payment.reference.as_deref() == Some("settlement") {
                        if supplier.debit.is_zero() && supplier.credit.is_zero() {
                            supplier.debit += base_amount;
                        } else if supplier.credit >= base_amount {
                            supplier.credit -= base_amount;
                        } else {
                            supplier.debit += base_amount - supplier.credit;
                            supplier.credit = Decimal::ZERO;
                        }
                        supplier.balance = supplier.credit - supplier.debit;
                    } else {
                        supplier.increase_credit(base_amount)
                        .map_err(|e| AppError::Invalid(e.to_string()))?;
                    }
                    self.supplier_repo.update(&supplier).await?;
                }
            }
            _ => {}
        }
        } else {
            // Reverse cash portion for return-related payments
            match payment.payment_type {
                PaymentType::CustomerPayment => {
                    if let Some(cid) = &payment.customer_id {
                        let mut customer = self.customer_repo.find_by_id(cid).await?
                            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                        customer.decrease_debit(base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.customer_repo.update(&customer).await?;
                    }
                }
                PaymentType::SupplierReceipt => {
                    if let Some(sid) = &payment.supplier_id {
                        let mut supplier = self.supplier_repo.find_by_id(sid).await?
                            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                        supplier.decrease_credit(base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.supplier_repo.update(&supplier).await?;
                    }
                }
                _ => {}
            }
        }

        // Find associated journal entry and delete it
        if payment.reference.as_deref().is_some_and(|r| r.starts_with("return:")) {
            if let Some(ref entry_number) = payment.journal_entry_number {
                if let Ok(Some(entry)) = self.journal_repo.find_by_number(entry_number).await {
                    let _ = self.journal_repo.delete(&entry.id).await;
                }
            }
        } else if let Ok(Some(entry)) = self.journal_repo.find_by_source_id(&pid.to_string()).await {
            let _ = self.journal_repo.delete(&entry.id).await;
        }

        self.repo.delete(&pid).await
    }
}

pub struct UpdatePaymentUseCase {
    repo: Arc<dyn PaymentRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl UpdatePaymentUseCase {
    pub fn new(
        repo: Arc<dyn PaymentRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, customer_repo, supplier_repo, journal_repo, account_repo }
    }

    pub async fn execute(&self, req: crate::dto::payment_dto::UpdatePaymentRequest) -> Result<PaymentDto, AppError> {
        let pid = req.id.parse::<PaymentId>()
            .map_err(|_| AppError::Invalid("معرف السند غير صالح".into()))?;

        let existing_payment = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("السند غير موجود".into()))?;

        // Save old state to reverse entity balances
        let old_type = existing_payment.payment_type;
        let old_amount = existing_payment.amount;
        let old_exchange_rate = existing_payment.exchange_rate;
        let old_currency = Currency::new(&existing_payment.currency_code, &existing_payment.currency_code, &existing_payment.currency_code, "", 2, false);
        let old_amount_ma = MonetaryAmount::new(
            Money::new(old_amount, old_currency),
            old_exchange_rate,
        );
        let old_base_amount = old_amount_ma.base_amount;
        let old_customer_id = existing_payment.customer_id;
        let old_supplier_id = existing_payment.supplier_id;
        let old_debit_account_id = existing_payment.debit_account_id;
        let is_return = existing_payment.reference.as_deref().is_some_and(|r| r.starts_with("return:"));

        // 1. Reverse old entity balances
        if !is_return {
        let is_settlement = existing_payment.reference.as_deref() == Some("settlement");
        reverse_entity_balances(
            &old_type,
            old_base_amount,
            &old_customer_id,
            &old_supplier_id,
            &old_debit_account_id,
            &self.customer_repo,
            &self.supplier_repo,
            &self.account_repo,
            is_settlement,
        ).await?;
        } else {
            // Reverse cash portion for return-related payments
            match old_type {
                PaymentType::CustomerPayment => {
                    if let Some(cid) = &old_customer_id {
                        let mut customer = self.customer_repo.find_by_id(cid).await?
                            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                        customer.decrease_debit(old_base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.customer_repo.update(&customer).await?;
                    }
                }
                PaymentType::SupplierReceipt => {
                    if let Some(sid) = &old_supplier_id {
                        let mut supplier = self.supplier_repo.find_by_id(sid).await?
                            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                        supplier.decrease_credit(old_base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.supplier_repo.update(&supplier).await?;
                    }
                }
                _ => {}
            }
        }

        // 2. Delete associated journal entry if it exists
        if existing_payment.reference.as_deref().is_some_and(|r| r.starts_with("return:")) {
            if let Some(ref entry_number) = existing_payment.journal_entry_number {
                if let Ok(Some(entry)) = self.journal_repo.find_by_number(entry_number).await {
                    let _ = self.journal_repo.delete(&entry.id).await;
                }
            }
        } else if let Ok(Some(entry)) = self.journal_repo.find_by_source_id(&pid.to_string()).await {
            let _ = self.journal_repo.delete(&entry.id).await;
        }

        let payment_type = match req.payment_type.as_str() {
            "Receipt" => PaymentType::Receipt,
            "SupplierPayment" => PaymentType::SupplierPayment,
            "CustomerPayment" => PaymentType::CustomerPayment,
            "SupplierReceipt" => PaymentType::SupplierReceipt,
            "ExpenseVoucher" => PaymentType::ExpenseVoucher,
            "DrawingsVoucher" => PaymentType::DrawingsVoucher,
            "CashIn" => PaymentType::CashIn,
            "CashOut" => PaymentType::CashOut,
            _ => PaymentType::Other,
        };

        let amount = Decimal::try_from(req.amount)
            .map_err(|_| AppError::Invalid("المبلغ غير صالح".into()))?;
        let exchange_rate = req.exchange_rate
            .and_then(|v| Decimal::try_from(v).ok())
            .unwrap_or(Decimal::ONE);
        let currency_code = req.currency_code.unwrap_or_default();
        let payment_date = DateTime::parse_from_rfc3339(&req.payment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let customer_id = req.customer_id.map(|id| {
            id.parse::<CustomerId>().map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))
        }).transpose()?;

        let supplier_id = req.supplier_id.map(|id| {
            id.parse::<SupplierId>().map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))
        }).transpose()?;

        let debit_account_id = req.debit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب المدين غير صالح".into()))?;
        let credit_account_id = req.credit_account_id
            .as_deref()
            .map(str::parse::<AccountId>)
            .transpose()
            .map_err(|_| AppError::Invalid("معرف حساب الدائن غير صالح".into()))?;

        // Reconstruct payment with updated values, preserving original id and voucher_number
        let mut updated_payment = Payment::new(
            existing_payment.voucher_number.clone(),
            payment_type,
            amount,
            currency_code.clone(),
            exchange_rate,
            payment_date,
            debit_account_id,
            credit_account_id,
            customer_id,
            supplier_id,
            req.reference.or(existing_payment.reference.clone()),
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        // Preserve original id and timestamps
        updated_payment.id = existing_payment.id;
        updated_payment.created_at = existing_payment.created_at;

        // --- Accounting Integration ---
        let mut journal_lines = Vec::new();
        let currency = Currency::new(&currency_code, &currency_code, &currency_code, "", 2, false);
        let amount_ma = MonetaryAmount::new(
            Money::new(updated_payment.amount, currency.clone()),
            exchange_rate,
        );
        let zero_ma = MonetaryAmount::zero(currency.clone());

        let cash_account = self.account_repo.find_by_code("122").await?
            .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود".into()))?;

        let journal_type = match updated_payment.payment_type {
            PaymentType::Receipt => JournalType::CashReceipt,
            PaymentType::SupplierPayment => JournalType::CashPayment,
            PaymentType::CustomerPayment => JournalType::CustomerPaymentJournal,
            PaymentType::SupplierReceipt => JournalType::SupplierReceiptJournal,
            PaymentType::ExpenseVoucher => JournalType::ExpenseVoucher,
            PaymentType::DrawingsVoucher => JournalType::DrawingsVoucher,
            _ => JournalType::CashJournal,
        };

        match updated_payment.payment_type {
            PaymentType::Receipt => {
                if let Some(cid) = &updated_payment.customer_id {
                    let customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

                    let p_acc_id = customer.account_id
                        .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;

                    let debit_cash = updated_payment.debit_account_id.unwrap_or(cash_account.id);
                    updated_payment.debit_account_id = Some(debit_cash);
                    updated_payment.credit_account_id = Some(p_acc_id);
                    journal_lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من العميل: {}", customer.name)));
                    journal_lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("دفعة من العميل: {}", customer.name)).with_partner(cid.0));
                }
            },
            PaymentType::SupplierPayment => {
                if let Some(sid) = &updated_payment.supplier_id {
                    let supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

                    let p_acc_id = supplier.account_id
                        .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;

                    let credit_cash = updated_payment.credit_account_id.unwrap_or(cash_account.id);
                    updated_payment.debit_account_id = Some(p_acc_id);
                    updated_payment.credit_account_id = Some(credit_cash);
                    journal_lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), format!("دفع للمورد: {}", supplier.name)).with_partner(sid.0));
                    journal_lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, format!("دفعة للمورد: {}", supplier.name)));
                }
            },
            PaymentType::ExpenseVoucher => {
                let debit_expense = updated_payment.debit_account_id
                    .ok_or_else(|| AppError::Invalid("يجب اختيار حساب المصروف لسند المصاريف".into()))?;
                let credit_cash = updated_payment.credit_account_id.unwrap_or(cash_account.id);
                updated_payment.credit_account_id = Some(credit_cash);
                journal_lines.push(JournalLine::new(
                    debit_expense,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    "سند مصاريف".to_string(),
                ));
                journal_lines.push(JournalLine::new(
                    credit_cash,
                    zero_ma,
                    amount_ma,
                    "صرف من الصندوق لسند مصاريف".to_string(),
                ));
            }
            PaymentType::DrawingsVoucher => {
                let debit_drawings = updated_payment.debit_account_id
                    .ok_or_else(|| AppError::Invalid("يجب اختيار حساب المسحوبات لسند المسحوبات".into()))?;
                let credit_cash = updated_payment.credit_account_id.unwrap_or(cash_account.id);
                updated_payment.credit_account_id = Some(credit_cash);
                journal_lines.push(JournalLine::new(
                    debit_drawings,
                    amount_ma.clone(),
                    zero_ma.clone(),
                    "سند مسحوبات".to_string(),
                ));
                journal_lines.push(JournalLine::new(
                    credit_cash,
                    zero_ma,
                    amount_ma,
                    "صرف من الصندوق لسند مسحوبات".to_string(),
                ));
            }
            PaymentType::CustomerPayment => {
                if let Some(cid) = &updated_payment.customer_id {
                    let customer = self.customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                    let p_acc_id = customer.account_id
                        .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;
                    let credit_cash = updated_payment.credit_account_id.unwrap_or(cash_account.id);
                    updated_payment.debit_account_id = Some(p_acc_id);
                    updated_payment.credit_account_id = Some(credit_cash);
                    journal_lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), format!("دفع للعميل: {}", customer.name)).with_partner(cid.0));
                    journal_lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, format!("دفعة للعميل: {}", customer.name)));
                }
            }
            PaymentType::SupplierReceipt => {
                if let Some(sid) = &updated_payment.supplier_id {
                    let supplier = self.supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                    let p_acc_id = supplier.account_id
                        .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;
                    let debit_cash = updated_payment.debit_account_id.unwrap_or(cash_account.id);
                    updated_payment.debit_account_id = Some(debit_cash);
                    updated_payment.credit_account_id = Some(p_acc_id);
                    journal_lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من المورد: {}", supplier.name)));
                    journal_lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("مقبوضات من مورد: {}", supplier.name)).with_partner(sid.0));
                }
            }
            _ => {}
        }

        if !journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut entry = JournalEntry::new(
                entry_number.clone(),
                journal_type,
                journal_lines,
                updated_payment.payment_date,
                updated_payment.notes.clone().unwrap_or_else(|| "سند مالي".to_string()),
                Some(updated_payment.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
            updated_payment.journal_entry_number = Some(entry_number);
        } else {
            updated_payment.journal_entry_number = None;
        }

        self.repo.save(&updated_payment).await?;

        // 3. Apply new entity balances
        let new_currency = Currency::new(&updated_payment.currency_code, &updated_payment.currency_code, &updated_payment.currency_code, "", 2, false);
        let new_amount_ma = MonetaryAmount::new(
            Money::new(updated_payment.amount, new_currency),
            updated_payment.exchange_rate,
        );
        let new_base_amount = new_amount_ma.base_amount;
        if !is_return {
        apply_entity_balances(
            &updated_payment.payment_type,
            new_base_amount,
            &updated_payment.customer_id,
            &updated_payment.supplier_id,
            &updated_payment.debit_account_id,
            &self.customer_repo,
            &self.supplier_repo,
            &self.account_repo,
        ).await?;
        } else {
            // Apply new cash portion for return-related payments
            match updated_payment.payment_type {
                PaymentType::CustomerPayment => {
                    if let Some(cid) = &updated_payment.customer_id {
                        let mut customer = self.customer_repo.find_by_id(cid).await?
                            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                        customer.increase_debit(new_base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.customer_repo.update(&customer).await?;
                    }
                }
                PaymentType::SupplierReceipt => {
                    if let Some(sid) = &updated_payment.supplier_id {
                        let mut supplier = self.supplier_repo.find_by_id(sid).await?
                            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                        supplier.increase_credit(new_base_amount)
                            .map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.supplier_repo.update(&supplier).await?;
                    }
                }
                _ => {}
            }
        }

        Ok(enrich_payment(updated_payment, &self.customer_repo, &self.supplier_repo).await)
    }
}
