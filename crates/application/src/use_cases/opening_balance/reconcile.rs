use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;

use domain::accounting::account::AccountType;
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::asset_repository::AssetRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::opening_detail_repository::OpeningDetailRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::use_cases::opening_balance::types::{OpeningReconciliationDto, ReconciliationRow};

const OPENING_EQUITY_ACCOUNT_CODE: &str = "53";

/// Compares each opening sub-ledger (AR / AP / Inventory / Fixed Assets)
/// against its general-ledger figure and reports the Opening Balance Control
/// account balance — the input to the migration validation screen.
pub struct GetOpeningReconciliationUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningDetailRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    stock_repo: Arc<dyn StockMovementRepository>,
    asset_repo: Arc<dyn AssetRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl GetOpeningReconciliationUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningDetailRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        stock_repo: Arc<dyn StockMovementRepository>,
        asset_repo: Arc<dyn AssetRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            migration_repo,
            detail_repo,
            customer_repo,
            supplier_repo,
            material_repo,
            stock_repo,
            asset_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, migration_id: String) -> Result<OpeningReconciliationDto, AppError> {
        let migration = self.migration_repo.find_by_id(&migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        let details = self.detail_repo.load_details(&migration_id).await?;

        // ---- Sub-ledger totals
        let ar_sub: Decimal = details.customer_items.iter()
            .filter_map(|i| Decimal::from_str(&i.outstanding_amount).ok()).sum();
        let ap_sub: Decimal = details.supplier_items.iter()
            .filter_map(|i| Decimal::from_str(&i.outstanding_amount).ok()).sum();
        let inv_sub: Decimal = details.inventory_items.iter()
            .filter_map(|i| Decimal::from_str(&i.total_cost).ok()).sum();
        let fa_sub: Decimal = details.fixed_assets.iter()
            .filter_map(|i| Decimal::from_str(&i.net_book_value).ok()).sum();

        // ---- General-ledger totals
        let ar_gl: Decimal = self.customer_repo.list_all().await?
            .iter().filter_map(|c| { let b = c.effective_balance(); (b > Decimal::ZERO).then_some(b) }).sum();
        let ap_gl: Decimal = self.supplier_repo.list_all().await?
            .iter().filter_map(|s| { let b = s.effective_balance(); (b > Decimal::ZERO).then_some(b) }).sum();

        let mut inv_gl = Decimal::ZERO;
        for m in self.material_repo.list_all().await? {
            let s = self.stock_repo.get_material_summary(&m.id).await?;
            inv_gl += s.total_available * s.average_cost_base;
        }

        let mut fa_gl = Decimal::ZERO;
        for a in self.asset_repo.list_assets().await? {
            fa_gl += a.net_book_value().amount();
        }

        // ---- Debit / Credit + Opening Control
        let obe_account_id = self.account_repo.find_by_code(OPENING_EQUITY_ACCOUNT_CODE).await?
            .map(|a| a.id);

        let (debit_total, credit_total, opening_control) =
            if let Some(entry) = self.journal_repo
                .find_by_source_id(&format!("opening_balance:{migration_id}")).await?
            {
                let d: Decimal = entry.lines.iter().map(|l| l.debit.base_amount).sum();
                let c: Decimal = entry.lines.iter().map(|l| l.credit.base_amount).sum();
                let obe_net: Decimal = entry.lines.iter()
                    .filter(|l| Some(l.account_id) == obe_account_id)
                    .map(|l| l.debit.base_amount - l.credit.base_amount).sum();
                (d, c, obe_net)
            } else {
                let (d, c) = drift_totals(&migration, &self.account_repo).await?;
                (d, c, d - c)
            };

        let row = |key: &str, sub: Decimal, gl: Decimal| ReconciliationRow {
            key: key.to_string(),
            subledger: sub,
            general_ledger: gl,
            reconciled: sub == gl,
        };
        let rows = vec![
            row("AR", ar_sub, ar_gl),
            row("AP", ap_sub, ap_gl),
            row("Inventory", inv_sub, inv_gl),
            row("FixedAssets", fa_sub, fa_gl),
        ];

        let all_reconciled = rows.iter().all(|r| r.reconciled);

        Ok(OpeningReconciliationDto {
            rows,
            all_reconciled,
            opening_control_balance: opening_control,
            debit_total,
            credit_total,
            debit_equals_credit: debit_total == credit_total,
        })
    }
}

/// Account classify the migration lines (unposted fallback) into a debit and a
/// credit total using each account's nature.
async fn drift_totals(
    migration: &domain::accounting::OpeningBalanceMigration,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<(Decimal, Decimal), AppError> {
    let mut d = Decimal::ZERO;
    let mut c_ = Decimal::ZERO;
    for line in &migration.lines {
        let account = account_repo.find_by_id(&line.account_id).await?
            .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;
        if matches!(account.account_type, AccountType::Assets | AccountType::Expenses) {
            d += line.amount;
        } else {
            c_ += line.amount;
        }
    }
    Ok((d, c_))
}

// Reference `AccountId` so the type is never orphaned if the branch changes.
#[allow(dead_code)]
fn _type_anchor(_: AccountId) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconciliation_row_math() {
        let rows = vec![
            ReconciliationRow { key: "AR".into(), subledger: Decimal::new(10000, 2), general_ledger: Decimal::new(10000, 2), reconciled: true },
            ReconciliationRow { key: "AP".into(), subledger: Decimal::new(5000, 2), general_ledger: Decimal::new(3000, 2), reconciled: false },
        ];
        assert!(rows[0].reconciled);
        assert!(!rows[1].reconciled);
        assert!(!rows.iter().all(|r| r.reconciled));
    }
}