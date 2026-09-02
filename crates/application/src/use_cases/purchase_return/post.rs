use crate::dto::returns_dto::PurchaseReturnDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::purchase_return_repository::PurchaseReturnRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::supplier_repository::SupplierRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{PurchaseReturnId, SupplierId};
use domain::shared::{Currency, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::str::FromStr;
use std::sync::Arc;

use super::PurchaseReturnQueries;

pub struct PostPurchaseReturnUseCase {
    repo: Arc<dyn PurchaseReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl PostPurchaseReturnUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        repo: Arc<dyn PurchaseReturnRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self {
            repo,
            movement_repo,
            journal_repo,
            account_repo,
            supplier_repo,
            material_repo,
            currency_repo,
            exchange_rate_repo,
        }
    }

    pub async fn execute(
        &self,
        id: String,
        settlement_mode: Option<String>,
        settlement_amount: Option<String>,
        is_paid: Option<bool>,
    ) -> Result<PurchaseReturnDto, AppError> {
        let rid = PurchaseReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let ret = self
            .repo
            .find_by_id(&rid)
            .await?
            .ok_or_else(|| AppError::NotFound("مرتجع المشتريات غير موجود".into()))?;

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

        // 1. Create stock movements (OUTFLOW - goods return to supplier)
        let mut movements = Vec::new();
        for line in &ret.lines {
            let material = self
                .material_repo
                .find_by_id(&line.material_id)
                .await?
                .ok_or_else(|| {
                    AppError::NotFound(format!("المادة مع المعرف {} غير موجودة", line.material_id))
                })?;

            let conversion_factor = if let Some(ref unit_id) = line.unit_id {
                material
                    .units
                    .iter()
                    .find(|u| u.id.to_string() == *unit_id)
                    .map(|u| u.conversion_factor)
                    .unwrap_or(Decimal::ONE)
            } else {
                Decimal::ONE
            };

            let effective_quantity = line.quantity * conversion_factor;

            let total_cost = line.line_total;
            let unit_cost = if effective_quantity > Decimal::ZERO {
                total_cost / effective_quantity
            } else {
                Decimal::ZERO
            };
            let unit_cost_base = unit_cost;
            let total_cost_base = total_cost;

            let custom_notes = line
                .notes
                .clone()
                .filter(|n| !n.trim().is_empty())
                .or_else(|| ret.notes.clone().filter(|n| !n.trim().is_empty()))
                .unwrap_or_default();

            let ref_no = self.movement_repo.get_next_inventory_reference().await?;
            let movement_notes = if custom_notes.is_empty() {
                format!(
                    "مرتجع مشتريات رقم {} - رقم الفاتورة {}",
                    ret.return_number, ret.return_number
                )
            } else {
                format!("{} - رقم الفاتورة {}", custom_notes, ret.return_number)
            };
            let mut movement = StockMovement::new(
                line.material_id,
                MovementType::PurchaseReturn,
                effective_quantity,
                unit_cost,
                total_cost,
                ref_no,
                movement_notes,
                Utc::now(),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.document_number = Some(ret.return_number.clone());
            movement.unit_cost_base = unit_cost_base;
            movement.total_cost_base = total_cost_base;
            movements.push(movement);
        }

        // 2. Determine settlement amounts
        let total = ret.total_amount;
        let (_partner_settlement, cash_amount) = self
            .compute_settlement(
                &settlement_mode,
                &settlement_amount,
                total,
                &ret.supplier_id,
            )
            .await?;

        // 3. Create RETURN journal entry (always debits supplier by full total)
        let mut entries = Vec::new();
        let mut payments = Vec::new();
        let mut return_journal_lines = Vec::new();

        let purchase_return_account = self
            .account_repo
            .find_by_code("32")
            .await?
            .ok_or_else(|| AppError::NotFound("حساب مرتجع المشتريات غير موجود: 32".into()))?;

        // Debit: Supplier account — total (full return value debited to supplier)
        if let Some(supplier) = self.supplier_repo.find_by_id(&ret.supplier_id).await? {
            if let Some(acc_id) = supplier.account_id {
                return_journal_lines.push(
                    JournalLine::new(
                        acc_id,
                        MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
                        MonetaryAmount::zero(doc_currency.clone()),
                        format!("مرتجع مشتريات رقم {}", ret.return_number),
                    )
                    .with_partner(ret.supplier_id.0),
                );
            }
        }

        // Credit: Purchase Returns account — total
        return_journal_lines.push(JournalLine::new(
            purchase_return_account.id,
            MonetaryAmount::zero(doc_currency.clone()),
            MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
            format!("مرتجع مشتريات رقم {}", ret.return_number),
        ));

        if !return_journal_lines.is_empty() {
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut entry = JournalEntry::new(
                entry_number,
                domain::accounting::JournalType::PurchaseReturnJournal,
                return_journal_lines,
                Utc::now(),
                format!("قيد آلي لمرتجع المشتريات رقم {}", ret.return_number),
                Some(ret.id.0.to_string()),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;
            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            entries.push(entry);
        }

        // 4. Create CASH journal entry (separate — only if cash_amount > 0 and paid now)
        //    SupplierReceiptJournal: Debit(cash, cash), Credit(supplier, cash)
        let cash_actually_paid = cash_amount > Decimal::ZERO && is_paid.unwrap_or(true);
        if cash_actually_paid {
            let cash_account = self
                .account_repo
                .find_by_code("122")
                .await?
                .ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

            let mut cash_journal_lines = Vec::new();

            cash_journal_lines.push(JournalLine::new(
                cash_account.id,
                MonetaryAmount::new(Money::new(cash_amount, doc_currency.clone()), fx_rate),
                MonetaryAmount::zero(doc_currency.clone()),
                format!(
                    "سند قبض من مورد مرتبط بمرتجع مشتريات رقم {}",
                    ret.return_number
                ),
            ));

            if let Some(supplier) = self.supplier_repo.find_by_id(&ret.supplier_id).await? {
                if let Some(supp_acc_id) = supplier.account_id {
                    cash_journal_lines.push(
                        JournalLine::new(
                            supp_acc_id,
                            MonetaryAmount::zero(doc_currency.clone()),
                            MonetaryAmount::new(
                                Money::new(cash_amount, doc_currency.clone()),
                                fx_rate,
                            ),
                            format!(
                                "سند قبض من مورد مرتبط بمرتجع مشتريات رقم {}",
                                ret.return_number
                            ),
                        )
                        .with_partner(ret.supplier_id.0),
                    );
                }
            }

            let cash_entry_number = self.journal_repo.get_next_entry_number().await?;
            let mut cash_entry = JournalEntry::new(
                cash_entry_number.clone(),
                domain::accounting::JournalType::SupplierReceiptJournal,
                cash_journal_lines,
                Utc::now(),
                format!(
                    "سند قبض من مورد مرتبط بمرتجع المشتريات رقم {}",
                    ret.return_number
                ),
                Some(ret.id.0.to_string()),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?
            .with_source_type("purchase_return_cash".into());
            cash_entry
                .post()
                .map_err(|e| AppError::Invalid(e.to_string()))?;
            entries.push(cash_entry);

            // 5. Create payment record for audit trail
            if let Some(supplier) = self.supplier_repo.find_by_id(&ret.supplier_id).await? {
                if let Some(supp_acc_id) = supplier.account_id {
                    let mut payment = Payment::new(
                        format!("SRC-{}", ret.return_number),
                        PaymentType::SupplierReceipt,
                        cash_amount,
                        base_currency.code.clone(),
                        Decimal::ONE,
                        Utc::now(),
                        Some(cash_account.id), // debit: cash
                        Some(supp_acc_id),     // credit: supplier account
                        None,
                        Some(ret.supplier_id),
                        Some(format!("return:{}", ret.id.0)),
                        Some(format!(
                            "مقبوضات نقدية مرتبطة بمرتجع مشتريات {}",
                            ret.return_number
                        )),
                    )
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                    payment.journal_entry_number = Some(cash_entry_number);
                    payments.push(payment);
                }
            }
        }

        // 6. Adjust partner balance: return entry decreases credit by total,
        //    cash entry (if paid now) increases credit by cash_amount → net: decrease by (total - cash)
        let mut supplier_mutations = Vec::new();
        if let Some(supplier) = self.supplier_repo.find_by_id(&ret.supplier_id).await? {
            let converted_total =
                crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                    total,
                    &base_currency.code,
                    Decimal::ONE,
                    &supplier.currency.code,
                    &self.currency_repo,
                    &self.exchange_rate_repo,
                )
                .await?;
            let mut updated_supplier = supplier;
            updated_supplier
                .decrease_credit(converted_total)
                .map_err(|e| AppError::Invalid(e.to_string()))?;

            if cash_actually_paid {
                let converted_cash =
                    crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                        cash_amount,
                        &base_currency.code,
                        Decimal::ONE,
                        &updated_supplier.currency.code,
                        &self.currency_repo,
                        &self.exchange_rate_repo,
                    )
                    .await?;
                updated_supplier
                    .increase_credit(converted_cash)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }

            supplier_mutations.push(updated_supplier);
        }

        // Commit stock movements + journals + payments + partner balance in
        // ONE transaction (Sec 9 atomicity).
        self.repo
            .post_with_accounting(
                &movements,
                &entries,
                payments.first(),
                &[],
                &supplier_mutations,
            )
            .await?;

        let dto = PurchaseReturnDto::from(ret);
        let queries = PurchaseReturnQueries::new(
            self.repo.clone(),
            self.supplier_repo.clone(),
            self.material_repo.clone(),
        );
        queries.populate(dto).await
    }

    async fn compute_settlement(
        &self,
        mode: &Option<String>,
        amount: &Option<String>,
        total: Decimal,
        supplier_id: &SupplierId,
    ) -> Result<(Decimal, Decimal), AppError> {
        let partner_balance =
            if let Some(supplier) = self.supplier_repo.find_by_id(supplier_id).await? {
                supplier.credit
            } else {
                Decimal::ZERO
            };
        match mode.as_deref() {
            Some("full_cash_return") => Ok((Decimal::ZERO, total)),
            Some("partial_settlement") => {
                let user_cash = amount
                    .as_ref()
                    .and_then(|a| Decimal::from_str(a).ok())
                    .unwrap_or(Decimal::ZERO);
                let min_cash = if total > partner_balance {
                    total - partner_balance
                } else {
                    Decimal::ZERO
                };
                let max_cash = total;
                let actual_cash = if user_cash < min_cash {
                    min_cash
                } else if user_cash > max_cash {
                    max_cash
                } else {
                    user_cash
                };
                Ok((total - actual_cash, actual_cash))
            }
            _ => {
                // deduct_from_debt (default)
                if total <= partner_balance {
                    Ok((total, Decimal::ZERO))
                } else {
                    Ok((partner_balance, total - partner_balance))
                }
            }
        }
    }
}
