// Accounting policies and business rules
// This module will contain validation rules for accounting operations

use crate::shared::errors::DomainError;
use crate::accounting::journal_entry::JournalLine;
use rust_decimal::Decimal;

pub struct DoubleEntryPolicy;

impl DoubleEntryPolicy {
    pub fn validate(lines: &[JournalLine]) -> Result<(), DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Invalid("يجب وجود سطر واحد على الأقل".into()));
        }

        let total_base_debit: Decimal = lines.iter().map(|l| l.base_debit()).sum();
        let total_base_credit: Decimal = lines.iter().map(|l| l.base_credit()).sum();

        if total_base_debit != total_base_credit {
            return Err(DomainError::Invalid(format!(
                "القيد غير متوازن بالعملة الأساسية. مدين: {} ، دائن: {}",
                total_base_debit, total_base_credit
            )));
        }

        for line in lines {
            if !line.debit.is_zero() && !line.credit.is_zero() {
                return Err(DomainError::Invalid(
                    "لا يمكن لسطر واحد أن يحتوي على قيمة مدين ودائن معاً".into(),
                ));
            }
            if line.debit.is_zero() && line.credit.is_zero() {
                return Err(DomainError::Invalid(
                    "يجب أن يكون السطر إما مديناً أو دائناً".into(),
                ));
            }
            if line.debit.fx_rate <= Decimal::ZERO || line.credit.fx_rate <= Decimal::ZERO {
                return Err(DomainError::Invalid(
                    "سعر الصرف يجب أن يكون أكبر من الصفر".into(),
                ));
            }
        }

        Ok(())
    }
}

pub fn validate_journal_entry_balance(debit: Decimal, credit: Decimal) -> Result<(), DomainError> {
    if debit != credit {
        return Err(DomainError::Invalid(format!(
            "القيد غير متوازن بالقيمة الأساسية (USD). مدين: {} ، دائن: {}",
            debit, credit
        )));
    }
    Ok(())
}

pub fn validate_account_hierarchy() -> Result<(), DomainError> {
    // Placeholder for account hierarchy validation
    Ok(())
}
