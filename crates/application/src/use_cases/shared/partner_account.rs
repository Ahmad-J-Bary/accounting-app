use std::sync::Arc;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::{AccountId, CustomerId, SupplierId};
use domain::shared::{Currency, MonetaryAmount, Money};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;

/// Determines the debit/credit balance sign convention for a partner type.
/// For customers: balance = debit − credit (receivable).
/// For suppliers: balance = credit − debit (payable).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PartnerKind {
    Customer,
    Supplier,
}

impl PartnerKind {
    /// Returns the `AccountType` for the linked ledger account.
    pub fn account_type(self) -> AccountType {
        match self {
            PartnerKind::Customer => AccountType::Assets,
            PartnerKind::Supplier => AccountType::Liabilities,
        }
    }

    /// Returns the label used in journal entry descriptions.
    pub fn label(self) -> &'static str {
        match self {
            PartnerKind::Customer => "العميل",
            PartnerKind::Supplier => "المورد",
        }
    }
}

/// Parameters needed to create a partner-linked account.
pub struct PartnerAccountParams<'a> {
    pub partner_id_str: String,
    pub code: &'a str,
    pub code_for_account: &'a str,
    pub name: &'a str,
    pub opening_balance: Decimal,
    pub debit: Decimal,
    pub credit: Decimal,
    pub currency: Currency,
    pub fx_rate: Decimal,
    pub parent_account_id: &'a str,
    pub kind: PartnerKind,
}

/// Creates a linked ledger `Account` for a newly-created partner (customer/supplier).
/// Returns the new `AccountId` after saving.
pub async fn create_partner_account(
    params: PartnerAccountParams<'_>,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<AccountId, AppError> {
    let parent_id = params.parent_account_id
        .parse::<AccountId>()
        .map_err(|_| AppError::Invalid("معرف حساب الأب غير صالح".into()))?;

    let parent = account_repo
        .find_by_id(&parent_id)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?
        .ok_or_else(|| AppError::NotFound(
            format!("حساب {} الرئيسي غير موجود في النظام", params.kind.label())
        ))?;

    let account_code = format!("{}{}", parent.code, params.code_for_account);
    let new_account_id = AccountId::new();
    let partner_uuid = params.partner_id_str
        .parse::<uuid::Uuid>()
        .map_err(|_| AppError::Invalid("معرف الشريك غير صالح".into()))?;

    let (linked_customer_id, linked_supplier_id) = match params.kind {
        PartnerKind::Customer => (
            Some(CustomerId(partner_uuid)),
            None,
        ),
        PartnerKind::Supplier => (
            None,
            Some(SupplierId(partner_uuid)),
        ),
    };

    let new_account = Account {
        id: new_account_id,
        code: account_code,
        name_ar: params.name.to_string(),
        name_en: params.name.to_string(),
        account_type: params.kind.account_type(),
        parent_id: Some(parent.id),
        category: AccountCategory::Detail,
        level: parent.level + 1,
        opening_balance: params.opening_balance,
        balance: params.debit - params.credit,
        debit: params.debit,
        credit: params.credit,
        currency: params.currency,
        exchange_rate: params.fx_rate,
        notes: None,
        is_active: true,
        is_default: false,
        is_final: true,
        linked_customer_id,
        linked_supplier_id,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    account_repo
        .save(&new_account)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(new_account_id)
}

/// Creates an opening-balance journal entry for a partner account.
/// The `balance_sign` convention:
/// - Customer: positive means debit (receivable), negative means credit.
/// - Supplier: positive means credit (payable), negative means debit.
pub async fn create_opening_balance_entry(
    account_id: AccountId,
    partner_name: &str,
    partner_entity_id: &str,
    net_balance: Decimal,     // debit − credit for customer; credit − debit for supplier
    currency: Currency,
    fx_rate: Decimal,
    equity_account_code: &str,
    kind: PartnerKind,
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
) -> Result<(), AppError> {
    if net_balance == Decimal::ZERO {
        return Ok(());
    }

    let equity_account = account_repo
        .find_by_code(equity_account_code)
        .await?
        .ok_or_else(|| AppError::NotFound(
            format!("حساب الرصيد الافتتاحي غير موجود: {equity_account_code}")
        ))?;

    let amount_ma = MonetaryAmount::new(
        Money::new(net_balance.abs(), currency.clone()),
        fx_rate,
    );
    let zero_ma = MonetaryAmount::zero(currency);

    let label = kind.label();
    let lines = if net_balance > Decimal::ZERO {
        // Partner is a debtor (customer) or we owe less (supplier reversal)
        vec![
            JournalLine::new(
                account_id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("رصيد افتتاحي مدين لـ{label}: {partner_name}"),
            ),
            JournalLine::new(
                equity_account.id,
                zero_ma,
                amount_ma,
                format!("رصيد افتتاحي لـ{label}: {partner_name}"),
            ),
        ]
    } else {
        // Partner is a creditor (supplier) or customer overpaid
        vec![
            JournalLine::new(
                equity_account.id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("رصيد افتتاحي دائن لـ{label}: {partner_name}"),
            ),
            JournalLine::new(
                account_id,
                zero_ma,
                amount_ma,
                format!("رصيد افتتاحي لـ{label}: {partner_name}"),
            ),
        ]
    };

    let mut entry = JournalEntry::new(
        journal_repo.get_next_entry_number().await?,
        JournalType::AccountOpeningBalance,
        lines,
        Utc::now(),
        format!("قيد افتتاح رصيد {label}: {partner_name}"),
        Some(partner_entity_id.to_string()),
    )
    .map_err(|e| AppError::Invalid(e.to_string()))?;

    entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
    journal_repo.save(&entry).await?;

    Ok(())
}

/// Creates a balance-adjustment journal entry when a partner's balance changes during update.
/// `balance_change` = new_balance − old_balance.
/// For customers: positive = Dr partner account, Cr equity.
/// For suppliers: positive = Dr equity, Cr partner account.
pub async fn create_balance_adjustment_entry(
    account_id: AccountId,
    partner_name: &str,
    partner_entity_id: &str,
    balance_change: Decimal,
    kind: PartnerKind,
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
) -> Result<(), AppError> {
    if balance_change == Decimal::ZERO {
        return Ok(());
    }

    let adjustment_account = account_repo
        .find_by_code("53")
        .await?
        .ok_or_else(|| AppError::NotFound("حساب الرصيد الافتتاحي غير موجود: 53".into()))?;

    let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
    let amount = MonetaryAmount::from_base(balance_change.abs(), base_currency.clone());
    let zero = MonetaryAmount::zero(base_currency);
    let label = kind.label();

    // For Customer:  +change → Dr partner (more receivable), Cr equity
    // For Customer:  -change → Dr equity (less receivable), Cr partner
    // For Supplier:  +change → Dr equity (more payable), Cr partner
    // For Supplier:  -change → Dr partner (less payable), Cr equity
    let lines = match (kind, balance_change > Decimal::ZERO) {
        (PartnerKind::Customer, true) | (PartnerKind::Supplier, false) => vec![
            JournalLine::new(
                account_id,
                amount.clone(),
                zero.clone(),
                format!("تسوية رصيد {label} (مدين) - {partner_name}"),
            ),
            JournalLine::new(
                adjustment_account.id,
                zero,
                amount,
                format!("تسوية رصيد {label} (دائن) - {partner_name}"),
            ),
        ],
        _ => vec![
            JournalLine::new(
                adjustment_account.id,
                amount.clone(),
                zero.clone(),
                format!("تسوية رصيد {label} (مدين) - {partner_name}"),
            ),
            JournalLine::new(
                account_id,
                zero,
                amount,
                format!("تسوية رصيد {label} (دائن) - {partner_name}"),
            ),
        ],
    };

    let mut entry = JournalEntry::new(
        journal_repo.get_next_entry_number().await?,
        JournalType::AccountOpeningBalance,
        lines,
        Utc::now(),
        format!("تعديل رصيد {label}: {partner_name}"),
        Some(partner_entity_id.to_string()),
    )
    .map_err(|e| AppError::Invalid(e.to_string()))?;

    entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
    journal_repo.save(&entry).await?;

    Ok(())
}
