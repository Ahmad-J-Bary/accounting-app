use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::ids::{SalesReturnId, CustomerId};
use domain::shared::{Currency, Money, MonetaryAmount};
use domain::payments::{Payment, PaymentType};
use crate::ports::sales_return_repository::SalesReturnRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::payment_repository::PaymentRepository;
use crate::dto::returns_dto::SalesReturnDto;
use crate::errors::AppError;

use super::SalesReturnQueries;

pub struct PostSalesReturnUseCase {
    repo: Arc<dyn SalesReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    payment_repo: Arc<dyn PaymentRepository>,
}

impl PostSalesReturnUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        repo: Arc<dyn SalesReturnRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
        payment_repo: Arc<dyn PaymentRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo, account_repo, customer_repo, material_repo, currency_repo, exchange_rate_repo, payment_repo }
    }

    pub async fn execute(&self, id: String, settlement_mode: Option<String>, settlement_amount: Option<String>, is_paid: Option<bool>) -> Result<SalesReturnDto, AppError> {
        let rid = SalesReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let ret = self.repo.find_by_id(&rid).await?
            .ok_or_else(|| AppError::NotFound("مرتجع المبيعات غير موجود".into()))?;

        let base_currency = self.currency_repo.get_base_currency().await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        let doc_currency = Currency::new(&base_currency.code, &base_currency.code, &base_currency.code, "", 2, false);
        let fx_rate = Decimal::ONE;

        // 1. Create stock movements (INFLOW - goods return to inventory)
        for line in &ret.lines {
            let material = self.material_repo.find_by_id(&line.material_id).await?
                .ok_or_else(|| AppError::NotFound(format!("المادة مع المعرف {} غير موجودة", line.material_id)))?;
            
            let conversion_factor = if let Some(ref unit_id) = line.unit_id {
                material.units.iter()
                    .find(|u| u.id.to_string() == *unit_id)
                    .map(|u| u.conversion_factor)
                    .unwrap_or(Decimal::ONE)
            } else {
                Decimal::ONE
            };
            
            let effective_quantity = line.quantity * conversion_factor;
            
            let summary = self.movement_repo.get_material_summary(&line.material_id).await
                .unwrap_or(crate::ports::stock_movement_repository::MaterialInventorySummary {
                    total_received: Decimal::ZERO,
                    total_sold: Decimal::ZERO,
                    total_available: Decimal::ZERO,
                    total_damaged: Decimal::ZERO,
                    last_purchase_price: Decimal::ZERO,
                    last_purchase_price_base: Decimal::ZERO,
                    last_sale_price: Decimal::ZERO,
                    last_sale_price_base: Decimal::ZERO,
                    average_cost: Decimal::ZERO,
                    average_cost_base: Decimal::ZERO,
                    average_raw_price_base: Decimal::ZERO,
                });

            let unit_cost = summary.average_cost;
            let total_cost = unit_cost * effective_quantity;
            let unit_cost_base = summary.average_cost_base;
            let total_cost_base = unit_cost_base * effective_quantity;
            
            let custom_notes = line.notes.clone()
                .filter(|n| !n.trim().is_empty())
                .or_else(|| {
                    ret.notes.clone().filter(|n| !n.trim().is_empty())
                })
                .unwrap_or_default();

            let mut movement = StockMovement::new(
                line.material_id,
                MovementType::SalesReturn,
                effective_quantity,
                unit_cost,
                total_cost,
                ret.return_number.clone(),
                format!("مرتجع مبيعات رقم {} - {}", ret.return_number, custom_notes),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.unit_cost_base = unit_cost_base;
            movement.total_cost_base = total_cost_base;
            self.movement_repo.save(&movement).await?;
        }

        // 2. Determine settlement amounts
        let total = ret.total_amount;
        let (_partner_settlement, cash_amount) = self.compute_settlement(
            &settlement_mode,
            &settlement_amount,
            total,
            &ret.customer_id,
        ).await?;

        // 3. Create RETURN journal entry (always credits customer by full total)
        let mut return_journal_lines = Vec::new();

        let sales_return_account = self.account_repo.find_by_code("42").await?
            .ok_or_else(|| AppError::NotFound("حساب مرتجع المبيعات غير موجود: 42".into()))?;

        // Debit: Sales Returns account — total
        return_journal_lines.push(JournalLine::new(
            sales_return_account.id,
            MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
            MonetaryAmount::zero(doc_currency.clone()),
            format!("مرتجع مبيعات رقم {}", ret.return_number),
        ));

        // Credit: Customer account — total (full return value credited to customer)
        if let Some(customer) = self.customer_repo.find_by_id(&ret.customer_id).await? {
            if let Some(acc_id) = customer.account_id {
                return_journal_lines.push(JournalLine::new(
                    acc_id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
                    format!("مرتجع مبيعات رقم {}", ret.return_number),
                ).with_partner(ret.customer_id.0));
            }
        }

        if !return_journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut entry = JournalEntry::new(
                entry_number,
                domain::accounting::JournalType::SalesReturnJournal,
                return_journal_lines,
                Utc::now(),
                format!("قيد آلي لمرتجع المبيعات رقم {}", ret.return_number),
                Some(ret.id.0.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        // 4. Create CASH journal entry (separate — only if cash_amount > 0 and paid now)
        //    CustomerPaymentJournal: Debit(customer, cash), Credit(cash, cash)
        let cash_actually_paid = cash_amount > Decimal::ZERO && is_paid.unwrap_or(true);
        if cash_actually_paid {
            let cash_account = self.account_repo.find_by_code("122").await?
                .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

            let mut cash_journal_lines = Vec::new();

            if let Some(customer) = self.customer_repo.find_by_id(&ret.customer_id).await? {
                if let Some(cust_acc_id) = customer.account_id {
                    cash_journal_lines.push(JournalLine::new(
                        cust_acc_id,
                        MonetaryAmount::new(Money::new(cash_amount, doc_currency.clone()), fx_rate),
                        MonetaryAmount::zero(doc_currency.clone()),
                        format!("سند دفع لعميل مرتبط بمرتجع مبيعات رقم {}", ret.return_number),
                    ).with_partner(ret.customer_id.0));
                }
            }

            cash_journal_lines.push(JournalLine::new(
                cash_account.id,
                MonetaryAmount::zero(doc_currency.clone()),
                MonetaryAmount::new(Money::new(cash_amount, doc_currency.clone()), fx_rate),
                format!("سند دفع لعميل مرتبط بمرتجع مبيعات رقم {}", ret.return_number),
            ));

            let cash_entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut cash_entry = JournalEntry::new(
                cash_entry_number.clone(),
                domain::accounting::JournalType::CustomerPaymentJournal,
                cash_journal_lines,
                Utc::now(),
                format!("سند دفع لعميل مرتبط بمرتجع المبيعات رقم {}", ret.return_number),
                None,
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            cash_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&cash_entry).await?;

            // 5. Create payment record for audit trail
            if let Some(customer) = self.customer_repo.find_by_id(&ret.customer_id).await? {
                if let Some(cust_acc_id) = customer.account_id {
                    let mut payment = Payment::new(
                        format!("SR-{}", ret.return_number),
                        PaymentType::CustomerPayment,
                        cash_amount,
                        base_currency.code.clone(),
                        Decimal::ONE,
                        Utc::now(),
                        Some(cust_acc_id),    // debit: customer account
                        Some(cash_account.id),// credit: cash
                        Some(ret.customer_id),
                        None,
                        Some(format!("return:{}", ret.id.0)),
                        Some(format!("دفعة نقدية مرتبطة بمرتجع مبيعات {}", ret.return_number)),
                    ).map_err(|e| AppError::Invalid(e.to_string()))?;
                    payment.journal_entry_number = Some(cash_entry_number);
                    self.payment_repo.save(&payment).await?;
                }
            }
        }

        // 6. Adjust partner balance: return entry decreases debit by total,
        //    cash entry (if paid now) increases debit by cash_amount → net: decrease by (total - cash)
        if let Some(customer) = self.customer_repo.find_by_id(&ret.customer_id).await? {
            let converted_total = crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                total,
                &base_currency.code,
                Decimal::ONE,
                &customer.currency.code,
                &self.currency_repo,
                &self.exchange_rate_repo,
            ).await?;
            let mut updated_customer = customer;
            updated_customer.decrease_debit(converted_total)
                .map_err(|e| AppError::Invalid(e.to_string()))?;

            if cash_actually_paid {
                let converted_cash = crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                    cash_amount,
                    &base_currency.code,
                    Decimal::ONE,
                    &updated_customer.currency.code,
                    &self.currency_repo,
                    &self.exchange_rate_repo,
                ).await?;
                updated_customer.increase_debit(converted_cash)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }

            self.customer_repo.update(&updated_customer).await?;
        }

        let dto = SalesReturnDto::from(ret);
        let queries = SalesReturnQueries::new(
            self.repo.clone(),
            self.customer_repo.clone(),
            self.material_repo.clone(),
        );
        queries.populate(dto).await
    }

    async fn compute_settlement(
        &self,
        mode: &Option<String>,
        amount: &Option<String>,
        total: Decimal,
        customer_id: &CustomerId,
    ) -> Result<(Decimal, Decimal), AppError> {
        let partner_balance = if let Some(customer) = self.customer_repo.find_by_id(customer_id).await? {
            customer.debit
        } else {
            Decimal::ZERO
        };
        match mode.as_deref() {
            Some("full_cash_return") => {
                Ok((Decimal::ZERO, total))
            }
            Some("partial_settlement") => {
                let user_cash = amount.as_ref()
                    .and_then(|a| Decimal::from_str(a).ok())
                    .unwrap_or(Decimal::ZERO);
                let min_cash = if total > partner_balance { total - partner_balance } else { Decimal::ZERO };
                let max_cash = total;
                let actual_cash = if user_cash < min_cash { min_cash } else if user_cash > max_cash { max_cash } else { user_cash };
                Ok((total - actual_cash, actual_cash))
            }
            _ => { // deduct_from_debt (default)
                if total <= partner_balance {
                    Ok((total, Decimal::ZERO))
                } else {
                    Ok((partner_balance, total - partner_balance))
                }
            }
        }
    }
}
