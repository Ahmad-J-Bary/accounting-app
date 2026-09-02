use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::account::{Account, AccountCategory, AccountType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::{AccountId, CustomerId, SupplierId};
use domain::shared::{Currency, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;

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

/// Builds a linked ledger `Account` for a newly-created partner (customer/supplier)
/// entirely in memory. It performs NO write: the caller persists the account,
/// the partner row and any opening-balance journals through ONE atomic
/// repository call so a partial partner can never be committed (Sec 9).
/// Returns the built account together with its id.
pub async fn build_partner_account(
    params: PartnerAccountParams<'_>,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<(Account, AccountId), AppError> {
    let parent_id = params
        .parent_account_id
        .parse::<AccountId>()
        .map_err(|_| AppError::Invalid("معرف حساب الأب غير صالح".into()))?;

    let parent = account_repo
        .find_by_id(&parent_id)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "حساب {} الرئيسي غير موجود في النظام",
                params.kind.label()
            ))
        })?;

    let account_code = format!("{}{}", parent.code, params.code_for_account);
    let new_account_id = AccountId::new();
    let partner_uuid = params
        .partner_id_str
        .parse::<uuid::Uuid>()
        .map_err(|_| AppError::Invalid("معرف الشريك غير صالح".into()))?;

    let (linked_customer_id, linked_supplier_id) = match params.kind {
        PartnerKind::Customer => (Some(CustomerId(partner_uuid)), None),
        PartnerKind::Supplier => (None, Some(SupplierId(partner_uuid))),
    };

    let purpose = match params.kind {
        PartnerKind::Customer => domain::accounting::account::AccountPurpose::Receivable,
        PartnerKind::Supplier => domain::accounting::account::AccountPurpose::Payable,
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
        balance: match params.kind {
            PartnerKind::Customer => params.debit - params.credit,
            PartnerKind::Supplier => params.credit - params.debit,
        },
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
        purpose,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    Ok((new_account, new_account_id))
}

/// Builds an opening-balance journal entry for a partner account, in memory
/// only (never persists). Returns `None` when the net balance is zero (no
/// journal is required). The `balance_sign` convention:
/// - Customer: positive means debit (receivable), negative means credit.
/// - Supplier: positive means credit (payable), negative means debit.
#[allow(clippy::too_many_arguments)]
pub async fn build_opening_balance_entry(
    account_id: AccountId,
    partner_name: &str,
    partner_entity_id: &str,
    net_balance: Decimal, // debit − credit for customer; credit − debit for supplier
    currency: Currency,
    fx_rate: Decimal,
    equity_account_code: &str,
    kind: PartnerKind,
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
) -> Result<Option<JournalEntry>, AppError> {
    if net_balance == Decimal::ZERO {
        return Ok(None);
    }

    let equity_account = account_repo
        .find_by_code(equity_account_code)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!(
                "حساب الرصيد الافتتاحي غير موجود: {equity_account_code}"
            ))
        })?;

    let amount_ma = MonetaryAmount::new(Money::new(net_balance.abs(), currency.clone()), fx_rate);
    let zero_ma = MonetaryAmount::zero(currency);

    let label = kind.label();
    let lines = match (kind, net_balance > Decimal::ZERO) {
        (PartnerKind::Customer, true) | (PartnerKind::Supplier, false) => vec![
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
        ],
        _ => vec![
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
        ],
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

    Ok(Some(entry))
}

/// Builds a balance-adjustment journal entry when a partner's balance changes
/// during update, in memory only (never persists). Returns `None` when nothing
/// changed. `balance_change` = new_balance − old_balance.
/// For customers: positive = Dr partner account, Cr equity.
/// For suppliers: positive = Dr equity, Cr partner account.
#[allow(clippy::too_many_arguments)]
pub async fn build_balance_adjustment_entry(
    account_id: AccountId,
    partner_name: &str,
    partner_entity_id: &str,
    balance_change: Decimal,
    kind: PartnerKind,
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
    currency_repo: &Arc<dyn CurrencyRepository>,
) -> Result<Option<JournalEntry>, AppError> {
    if balance_change == Decimal::ZERO {
        return Ok(None);
    }

    let adjustment_account = account_repo
        .find_by_code("53")
        .await?
        .ok_or_else(|| AppError::NotFound("حساب الرصيد الافتتاحي غير موجود: 53".into()))?;

    let base_currency = currency_repo
        .get_base_currency()
        .await?
        .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
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

    Ok(Some(entry))
}
