use std::sync::Arc;
use rust_decimal::Decimal;
use domain::accounting::account::Account;
use domain::customers::Customer;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{CustomerId, SupplierId, AccountId};
use domain::shared::{Currency, Money, MonetaryAmount};
use domain::suppliers::Supplier;
use crate::dto::payment_dto::PaymentDto;
use crate::errors::AppError;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::account_repository::AccountRepository;

/// Accumulated customer / supplier / account balance mutations for a payment
/// accounting event. The mutations are applied by the repository composite in
/// ONE transaction together with the journal + payment writes (Sec 9).
#[derive(Debug, Default)]
pub struct BalanceChanges {
    pub customers: Vec<Customer>,
    pub suppliers: Vec<Supplier>,
    pub accounts: Vec<Account>,
}

impl BalanceChanges {
    fn push_customer(&mut self, c: Customer) {
        self.customers.push(c);
    }
    fn push_supplier(&mut self, s: Supplier) {
        self.suppliers.push(s);
    }
    fn push_account(&mut self, a: Account) {
        self.accounts.push(a);
    }
}

/// Enriches a Payment domain object into a PaymentDto by resolving
/// customer/supplier names from the respective repositories.
pub async fn enrich_payment(
    p: Payment,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
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

/// Converts a monetary amount from a currency string and exchange rate.
/// Returns both the `MonetaryAmount` and the `Currency` so callers can build
/// a zero `MonetaryAmount` for the same currency without recreating it.
pub fn build_monetary_amount(amount: Decimal, currency_code: &str, exchange_rate: Decimal) -> (MonetaryAmount, Currency) {
    let currency = Currency::new(currency_code, currency_code, currency_code, "", 2, false);
    let ma = MonetaryAmount::new(Money::new(amount, currency.clone()), exchange_rate);
    (ma, currency)
}

/// Computes entity balance changes (increase) for a payment event **without
/// persisting** them. The returned mutations are written by the repository
/// composite together with the journal + payment in one transaction.
#[allow(clippy::too_many_arguments)]
pub async fn compute_apply_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    debit_account_id: &Option<AccountId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<BalanceChanges, AppError> {
    let mut changes = BalanceChanges::default();
    match payment_type {
        PaymentType::Receipt => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.increase_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_customer(customer);
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.increase_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_supplier(supplier);
            }
        }
        PaymentType::ExpenseVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                account.debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit += base_amount;
                changes.push_account(account);
            }
        }
        PaymentType::DrawingsVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                account.debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit += base_amount;
                changes.push_account(account);
            }
        }
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_customer(customer);
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.decrease_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_supplier(supplier);
            }
        }
        _ => {}
    }
    Ok(changes)
}

/// Computes reversed entity balance changes (from a previous payment event)
/// **without persisting** them. `is_settlement` controls special settlement
/// logic for CustomerPayment / SupplierReceipt.
#[allow(clippy::too_many_arguments)]
pub async fn compute_reverse_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    debit_account_id: &Option<AccountId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
    account_repo: &Arc<dyn AccountRepository>,
    is_settlement: bool,
) -> Result<BalanceChanges, AppError> {
    let mut changes = BalanceChanges::default();
    match payment_type {
        PaymentType::Receipt => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.decrease_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_customer(customer);
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_supplier(supplier);
            }
        }
        PaymentType::ExpenseVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?;
                account.credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit -= base_amount;
                changes.push_account(account);
            }
        }
        PaymentType::DrawingsVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = account_repo.find_by_id(acc_id).await?
                    .ok_or_else(|| AppError::NotFound("حساب المسحوبات غير موجود".into()))?;
                account.credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit -= base_amount;
                changes.push_account(account);
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
                changes.push_customer(customer);
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
                changes.push_supplier(supplier);
            }
        }
        _ => {}
    }
    Ok(changes)
}

/// Applies a balance mutation onto an already-computed `BalanceChanges` set:
/// if an entity of the same id is already present (e.g. after a reverse step)
/// it is mutated in place, preserving sequential semantics; otherwise it is
/// loaded from the repository and added. Nothing is persisted here.
#[allow(clippy::too_many_arguments)]
pub async fn apply_balance_onto(
    changes: &mut BalanceChanges,
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
                let mut customer = if let Some(c) = changes.customers.iter().find(|c| c.id == *cid).cloned() {
                    c
                } else {
                    customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?
                };
                customer.increase_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                if let Some(c) = changes.customers.iter_mut().find(|c| c.id == *cid) {
                    *c = customer;
                } else {
                    changes.customers.push(customer);
                }
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = supplier_id {
                let mut supplier = if let Some(s) = changes.suppliers.iter().find(|s| s.id == *sid).cloned() {
                    s
                } else {
                    supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?
                };
                supplier.increase_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                if let Some(s) = changes.suppliers.iter_mut().find(|s| s.id == *sid) {
                    *s = supplier;
                } else {
                    changes.suppliers.push(supplier);
                }
            }
        }
        PaymentType::ExpenseVoucher | PaymentType::DrawingsVoucher => {
            if let Some(acc_id) = debit_account_id {
                let mut account = if let Some(a) = changes.accounts.iter().find(|a| a.id == *acc_id).cloned() {
                    a
                } else {
                    account_repo.find_by_id(acc_id).await?
                        .ok_or_else(|| AppError::NotFound("حساب المصروف غير موجود".into()))?
                };
                account.debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                account.debit += base_amount;
                if let Some(a) = changes.accounts.iter_mut().find(|a| a.id == *acc_id) {
                    *a = account;
                } else {
                    changes.accounts.push(account);
                }
            }
        }
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = if let Some(c) = changes.customers.iter().find(|c| c.id == *cid).cloned() {
                    c
                } else {
                    customer_repo.find_by_id(cid).await?
                        .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?
                };
                customer.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                if let Some(c) = changes.customers.iter_mut().find(|c| c.id == *cid) {
                    *c = customer;
                } else {
                    changes.customers.push(customer);
                }
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = if let Some(s) = changes.suppliers.iter().find(|s| s.id == *sid).cloned() {
                    s
                } else {
                    supplier_repo.find_by_id(sid).await?
                        .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?
                };
                supplier.decrease_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                if let Some(s) = changes.suppliers.iter_mut().find(|s| s.id == *sid) {
                    *s = supplier;
                } else {
                    changes.suppliers.push(supplier);
                }
            }
        }
        _ => {}
    }
    Ok(())
}

/// Computes the reversed balance for a return-linked CustomerPayment or
/// SupplierReceipt **without persisting**.
pub async fn compute_reverse_return_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
) -> Result<BalanceChanges, AppError> {
    let mut changes = BalanceChanges::default();
    match payment_type {
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.decrease_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_customer(customer);
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.decrease_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_supplier(supplier);
            }
        }
        _ => {}
    }
    Ok(changes)
}

/// Computes the applied balance for a return-linked CustomerPayment or
/// SupplierReceipt **without persisting**.
pub async fn compute_apply_return_balances(
    payment_type: &PaymentType,
    base_amount: Decimal,
    customer_id: &Option<CustomerId>,
    supplier_id: &Option<SupplierId>,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
) -> Result<BalanceChanges, AppError> {
    let mut changes = BalanceChanges::default();
    match payment_type {
        PaymentType::CustomerPayment => {
            if let Some(cid) = customer_id {
                let mut customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                customer.increase_debit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_customer(customer);
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = supplier_id {
                let mut supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                supplier.increase_credit(base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                changes.push_supplier(supplier);
            }
        }
        _ => {}
    }
    Ok(changes)
}
