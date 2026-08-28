use std::sync::Arc;
use domain::accounting::journal_entry::{JournalLine, JournalType};
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::AccountId;
use domain::shared::MonetaryAmount;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;

/// Maps a PaymentType to the corresponding JournalType.
pub fn payment_type_to_journal_type(payment_type: &PaymentType) -> JournalType {
    match payment_type {
        PaymentType::Receipt => JournalType::CashReceipt,
        PaymentType::SupplierPayment => JournalType::CashPayment,
        PaymentType::CustomerPayment => JournalType::CustomerPaymentJournal,
        PaymentType::SupplierReceipt => JournalType::SupplierReceiptJournal,
        PaymentType::ExpenseVoucher => JournalType::ExpenseVoucher,
        PaymentType::DrawingsVoucher => JournalType::DrawingsVoucher,
        _ => JournalType::CashJournal,
    }
}

/// Parses a PaymentType from its string representation.
pub fn parse_payment_type(s: &str) -> PaymentType {
    match s {
        "Receipt" => PaymentType::Receipt,
        "SupplierPayment" => PaymentType::SupplierPayment,
        "CustomerPayment" => PaymentType::CustomerPayment,
        "SupplierReceipt" => PaymentType::SupplierReceipt,
        "ExpenseVoucher" => PaymentType::ExpenseVoucher,
        "DrawingsVoucher" => PaymentType::DrawingsVoucher,
        "CashIn" => PaymentType::CashIn,
        "CashOut" => PaymentType::CashOut,
        _ => PaymentType::Other,
    }
}

/// Generates the voucher number prefix for a given PaymentType.
pub fn voucher_prefix(payment_type: &PaymentType) -> &'static str {
    match payment_type {
        PaymentType::Receipt => "RCV",
        PaymentType::SupplierPayment => "PAY",
        PaymentType::CustomerPayment => "CPY",
        PaymentType::SupplierReceipt => "SRC",
        PaymentType::ExpenseVoucher => "EXP",
        PaymentType::DrawingsVoucher => "DRW",
        _ => "VCH",
    }
}

/// Builds journal lines for a payment based on its type.
/// Returns the updated debit/credit account IDs alongside the journal lines.
pub async fn build_journal_lines(
    payment: &mut Payment,
    cash_account_id: AccountId,
    amount_ma: MonetaryAmount,
    zero_ma: MonetaryAmount,
    customer_repo: &Arc<dyn CustomerRepository>,
    supplier_repo: &Arc<dyn SupplierRepository>,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<Vec<JournalLine>, AppError> {
    let _ = account_repo; // reserved for future use
    let mut lines = Vec::new();

    match payment.payment_type {
        PaymentType::Receipt => {
            if let Some(cid) = &payment.customer_id {
                let customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                let p_acc_id = customer.account_id
                    .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;
                let debit_cash = payment.debit_account_id.unwrap_or(cash_account_id);
                payment.debit_account_id = Some(debit_cash);
                payment.credit_account_id = Some(p_acc_id);
                lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من العميل: {}", customer.name)));
                lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("دفعة من العميل: {}", customer.name)).with_partner(cid.0));
            }
        }
        PaymentType::SupplierPayment => {
            if let Some(sid) = &payment.supplier_id {
                let supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                let p_acc_id = supplier.account_id
                    .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;
                let credit_cash = payment.credit_account_id.unwrap_or(cash_account_id);
                payment.debit_account_id = Some(p_acc_id);
                payment.credit_account_id = Some(credit_cash);
                lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), "دفعة على الحساب".to_string()).with_partner(sid.0));
                lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, "دفعة على الحساب".to_string()));
            }
        }
        PaymentType::ExpenseVoucher => {
            let debit_expense = payment.debit_account_id
                .ok_or_else(|| AppError::Invalid("يجب اختيار حساب المصروف لسند المصاريف".into()))?;
            let credit_cash = payment.credit_account_id.unwrap_or(cash_account_id);
            payment.credit_account_id = Some(credit_cash);
            lines.push(JournalLine::new(debit_expense, amount_ma.clone(), zero_ma.clone(), "سند مصاريف".to_string()));
            lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, "صرف من الصندوق لسند مصاريف".to_string()));
        }
        PaymentType::DrawingsVoucher => {
            let debit_drawings = payment.debit_account_id
                .ok_or_else(|| AppError::Invalid("حساب المدين (المسحوبات) مفقود — تأكد من ربط الشريك بحساب مسحوبات صحيح".into()))?;
            let credit_cash = payment.credit_account_id.unwrap_or(cash_account_id);
            payment.credit_account_id = Some(credit_cash);
            lines.push(JournalLine::new(debit_drawings, amount_ma.clone(), zero_ma.clone(), "سند مسحوبات".to_string()));
            lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, "صرف من الصندوق لسند مسحوبات".to_string()));
        }
        PaymentType::CustomerPayment => {
            if let Some(cid) = &payment.customer_id {
                let customer = customer_repo.find_by_id(cid).await?
                    .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
                let p_acc_id = customer.account_id
                    .ok_or_else(|| AppError::Invalid("العميل لا يملك حساباً محاسبياً".into()))?;
                let credit_cash = payment.credit_account_id.unwrap_or(cash_account_id);
                payment.debit_account_id = Some(p_acc_id);
                payment.credit_account_id = Some(credit_cash);
                lines.push(JournalLine::new(p_acc_id, amount_ma.clone(), zero_ma.clone(), format!("دفع للعميل: {}", customer.name)).with_partner(cid.0));
                lines.push(JournalLine::new(credit_cash, zero_ma, amount_ma, format!("دفعة للعميل: {}", customer.name)));
            }
        }
        PaymentType::SupplierReceipt => {
            if let Some(sid) = &payment.supplier_id {
                let supplier = supplier_repo.find_by_id(sid).await?
                    .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
                let p_acc_id = supplier.account_id
                    .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;
                let debit_cash = payment.debit_account_id.unwrap_or(cash_account_id);
                payment.debit_account_id = Some(debit_cash);
                payment.credit_account_id = Some(p_acc_id);
                lines.push(JournalLine::new(debit_cash, amount_ma.clone(), zero_ma.clone(), format!("قبض من المورد: {}", supplier.name)));
                lines.push(JournalLine::new(p_acc_id, zero_ma, amount_ma, format!("مقبوضات من مورد: {}", supplier.name)).with_partner(sid.0));
            }
        }
        _ => {}
    }

    Ok(lines)
}
