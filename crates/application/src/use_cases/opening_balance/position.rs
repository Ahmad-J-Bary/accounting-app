use std::collections::HashMap;
use std::sync::Arc;

use rust_decimal::Decimal;
use serde::Serialize;

use domain::accounting::account::{Account, AccountPurpose, AccountType};
use domain::accounting::opening_balance::OpeningBalanceMigration;
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::partner_repository::PartnerRepository;

/// Currency-aware Decimal tolerance for the balance check. A difference at or
/// below one penny is treated as balanced; f64 is never introduced.
fn balance_tolerance() -> Decimal {
    Decimal::new(1, 2) // 0.01
}

/// One account-level line of the opening financial position.
#[derive(Debug, Clone, Serialize)]
pub struct PositionAccountLine {
    pub account_id: String,
    pub code: String,
    pub name_ar: String,
    pub purpose: String,
    pub group_key: String,
    pub amount: Decimal,
}

/// One partner's slice of the opening equity (capital, current, drawings).
#[derive(Debug, Clone, Serialize)]
pub struct PositionPartnerRow {
    pub partner_id: String,
    pub partner_name: String,
    pub capital: Decimal,
    pub ownership_percent: Decimal,
    pub current: Decimal,
    pub drawings: Decimal,
    pub net_equity: Decimal,
}

/// Read-only summary of the opening financial position of an opening-balance
/// migration (Sec 3). Everything is derived from the migration's own opening
/// lines and the chart semantics — no journal entries are created or touched.
#[derive(Debug, Clone, Serialize)]
pub struct OpeningPositionControlDto {
    pub total_assets: Decimal,
    pub total_liabilities: Decimal,
    pub net_assets: Decimal,

    pub partner_capital: Decimal,
    pub partner_current_accounts: Decimal,
    pub retained_earnings: Decimal,
    pub opening_equity_adjustment: Decimal,
    pub other_equity: Decimal,
    pub drawings: Decimal,
    pub total_equity: Decimal,

    pub equity_difference: Decimal,
    pub is_balanced: bool,
    pub opening_historical_result: Decimal,

    /// ResidualClassification tag when the accountant already chose one.
    pub classification: Option<String>,
    /// True when the residual has been moved into the ledger.
    pub residual_applied: bool,
    /// Empty when balanced; otherwise a human-readable pointer to the existing
    /// residual workflow so the difference is never silently hidden.
    pub difference_message: Option<String>,

    pub asset_detail: Vec<PositionAccountLine>,
    pub liability_detail: Vec<PositionAccountLine>,
    pub equity_detail: Vec<PositionAccountLine>,
    pub partner_rows: Vec<PositionPartnerRow>,
}

/// Aggregated amounts per classification used to build the DTO.
#[derive(Debug, Clone, Default)]
pub struct PositionBuckets {
    pub assets: Decimal,
    pub liabilities: Decimal,
    pub partner_capital: Decimal,
    pub partner_current: Decimal,
    pub retained_earnings: Decimal,
    pub opening_equity: Decimal,
    pub other_equity: Decimal,
    pub drawings: Decimal,
    pub asset_detail: Vec<PositionAccountLine>,
    pub liability_detail: Vec<PositionAccountLine>,
    pub equity_detail: Vec<PositionAccountLine>,
    pub partner_capital_line: HashMap<AccountId, Decimal>,
    pub current_line: HashMap<AccountId, Decimal>,
    pub drawings_line: HashMap<AccountId, Decimal>,
}

/// Sums the migration opening lines, classifying every account by its
/// AccountType and AccountPurpose (Sec 46) — never by code prefix or name.
/// The Dr/Cr side follows the account's normal balance exactly like posting.
pub fn bucket_position(
    migration: &OpeningBalanceMigration,
    accounts: &HashMap<AccountId, Account>,
) -> PositionBuckets {
    let mut b = PositionBuckets::default();

    for line in &migration.lines {
        let Some(account) = accounts.get(&line.account_id) else {
            // Unknown account (never the case for a validated migration); treat
            // the amount as unclassified "Other" equity so money is never
            // dropped silently.
            b.other_equity += line.amount;
            continue;
        };
        let amount = line.amount;
        match account.account_type {
            AccountType::Assets => {
                b.assets += amount;
                b.asset_detail.push(PositionAccountLine {
                    account_id: account.id.0.to_string(),
                    code: account.code.clone(),
                    name_ar: account.name_ar.clone(),
                    purpose: purpose_str(account.purpose),
                    group_key: asset_group_key(account.purpose).to_string(),
                    amount,
                });
            }
            AccountType::Liabilities => {
                b.liabilities += amount;
                b.liability_detail.push(PositionAccountLine {
                    account_id: account.id.0.to_string(),
                    code: account.code.clone(),
                    name_ar: account.name_ar.clone(),
                    purpose: purpose_str(account.purpose),
                    group_key: liability_group_key(account.purpose).to_string(),
                    amount,
                });
            }
            AccountType::Equity => {
                let group = equity_group_key(account.purpose);
                b.equity_detail.push(PositionAccountLine {
                    account_id: account.id.0.to_string(),
                    code: account.code.clone(),
                    name_ar: account.name_ar.clone(),
                    purpose: purpose_str(account.purpose),
                    group_key: group.to_string(),
                    amount,
                });
                match account.purpose {
                    AccountPurpose::PartnerCapital => {
                        b.partner_capital += amount;
                        *b.partner_capital_line.entry(account.id).or_default() += amount;
                    }
                    AccountPurpose::PartnerDrawings => {
                        b.drawings += amount;
                        *b.drawings_line.entry(account.id).or_default() += amount;
                    }
                    AccountPurpose::PartnerCurrent => {
                        b.partner_current += amount;
                        *b.current_line.entry(account.id).or_default() += amount;
                    }
                    AccountPurpose::RetainedEarnings => b.retained_earnings += amount,
                    AccountPurpose::OpeningBalanceEquity => b.opening_equity += amount,
                    _ => b.other_equity += amount,
                }
            }
            // Revenue/Expenses never reach an opening line (create rejects
            // them); a defensive skip keeps P&L out of the balance equation.
            _ => {}
        }
    }
    b
}

fn asset_group_key(purpose: AccountPurpose) -> &'static str {
    match purpose {
        AccountPurpose::Receivable => "Receivable",
        AccountPurpose::Inventory => "Inventory",
        AccountPurpose::FixedAsset => "FixedAsset",
        _ => "Other",
    }
}

fn liability_group_key(purpose: AccountPurpose) -> &'static str {
    match purpose {
        AccountPurpose::Payable => "Payable",
        _ => "Other",
    }
}

fn equity_group_key(purpose: AccountPurpose) -> &'static str {
    match purpose {
        AccountPurpose::PartnerCapital => "PartnerCapital",
        AccountPurpose::PartnerCurrent => "PartnerCurrent",
        AccountPurpose::RetainedEarnings => "RetainedEarnings",
        AccountPurpose::OpeningBalanceEquity => "OpeningBalanceEquity",
        AccountPurpose::PartnerDrawings => "PartnerDrawings",
        _ => "Other",
    }
}

fn purpose_str(purpose: AccountPurpose) -> String {
    purpose_to_str(purpose).to_string()
}

fn purpose_to_str(purpose: AccountPurpose) -> &'static str {
    match purpose {
        AccountPurpose::General => "general",
        AccountPurpose::PartnerCapital => "partner_capital",
        AccountPurpose::PartnerDrawings => "partner_drawings",
        AccountPurpose::PartnerCurrent => "partner_current",
        AccountPurpose::Receivable => "receivable",
        AccountPurpose::Payable => "payable",
        AccountPurpose::Inventory => "inventory",
        AccountPurpose::FixedAsset => "fixed_asset",
        AccountPurpose::RetainedEarnings => "retained_earnings",
        AccountPurpose::OpeningBalanceEquity => "opening_balance_equity",
    }
}

fn classification_label(classification: Option<domain::accounting::ResidualClassification>) -> Option<String> {
    classification.map(|c| c.as_str().to_string())
}

/// Final accounting-equation computation over the bucket totals. Pure: takes
/// the migration (for residual classification metadata) and the buckets and
/// returns the DTO without partner rows (filled by the use case afterwards).
pub fn compute_dto(
    migration: &OpeningBalanceMigration,
    buckets: PositionBuckets,
) -> OpeningPositionControlDto {
    let PositionBuckets {
        assets,
        liabilities,
        partner_capital,
        partner_current,
        retained_earnings,
        opening_equity,
        other_equity,
        drawings,
        asset_detail,
        liability_detail,
        equity_detail,
        ..
    } = buckets;

    let net_assets = assets - liabilities;
    let total_equity = partner_capital
        + partner_current
        + retained_earnings
        + opening_equity
        + other_equity
        - drawings;
    let equity_difference = net_assets - total_equity;
    let is_balanced = equity_difference.abs() <= balance_tolerance();

    // Explicit equity that is not registered/contributed partner capital and not
    // the retained-earnings result itself. Drawn from the same buckets (never
    // re-added); the derived historical result is informational only.
    let explicit_other_equity = partner_current + opening_equity + other_equity - drawings;
    let opening_historical_result = (net_assets - partner_capital - explicit_other_equity).round_dp(2);

    let difference_message = if is_balanced {
        None
    } else {
        Some(format!(
            "يوجد فرق غير مصنف في المركز الافتتاحي ({}) — صنّف الرصيد المتبقي عبر سير عمل تصنيف الرصيد المتبقي",
            equity_difference
        ))
    };

    OpeningPositionControlDto {
        total_assets: assets,
        total_liabilities: liabilities,
        net_assets,
        partner_capital,
        partner_current_accounts: partner_current,
        retained_earnings,
        opening_equity_adjustment: opening_equity,
        other_equity,
        drawings,
        total_equity,
        equity_difference,
        is_balanced,
        opening_historical_result,
        classification: classification_label(migration.residual_classification),
        residual_applied: migration.residual_applied_at.is_some(),
        difference_message,
        asset_detail,
        liability_detail,
        equity_detail,
        partner_rows: vec![],
    }
}

/// Read-use-case over a single opening-balance migration. READ ONLY: it only
/// reads the migration, the chart and partners — it never writes a journal.
pub struct GetOpeningPositionControlUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
    partner_repo: Arc<dyn PartnerRepository>,
}

impl GetOpeningPositionControlUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
        partner_repo: Arc<dyn PartnerRepository>,
    ) -> Self {
        Self {
            migration_repo,
            account_repo,
            partner_repo,
        }
    }

    pub async fn execute(&self, migration_id: String) -> Result<OpeningPositionControlDto, AppError> {
        let migration = self.migration_repo.find_by_id(&migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Resolve every account referenced by the migration lines once.
        let mut accounts: HashMap<AccountId, Account> = HashMap::new();
        for line in &migration.lines {
            if accounts.contains_key(&line.account_id) {
                continue;
            }
            if let Some(account) = self.account_repo.find_by_id(&line.account_id).await? {
                accounts.insert(line.account_id, account);
            }
        }

        let buckets = bucket_position(&migration, &accounts);
        let partner_rows = self.partner_rows(&buckets).await?;
        let mut dto = compute_dto(&migration, buckets);
        dto.partner_rows = partner_rows;

        Ok(dto)
    }

    /// Per-partner slice of the opening equity, read from the same migration
    /// line buckets via the partner's linked capital/current/drawings accounts.
    /// Ownership % is relative to THIS migration's contributed capital only
    /// (the decision for v0.9.9), never the partner master's amount_local.
    async fn partner_rows(&self, buckets: &PositionBuckets) -> Result<Vec<PositionPartnerRow>, AppError> {
        let partners = self.partner_repo.list_all(false).await?;

        let total_partner_capital: Decimal =
            buckets.partner_capital_line.values().copied().sum();

        let mut rows = Vec::new();
        for partner in &partners {
            let capital = partner
                .linked_account_id
                .and_then(|id| buckets.partner_capital_line.get(&id))
                .copied()
                .unwrap_or_default();
            let current = partner
                .current_account_id
                .and_then(|id| buckets.current_line.get(&id))
                .copied()
                .unwrap_or_default();
            let drawings = partner
                .drawings_account_id
                .and_then(|id| buckets.drawings_line.get(&id))
                .copied()
                .unwrap_or_default();

            if capital == Decimal::ZERO && current == Decimal::ZERO && drawings == Decimal::ZERO {
                continue;
            }

            let ownership_percent = if total_partner_capital > Decimal::ZERO {
                ((capital / total_partner_capital) * Decimal::new(100, 0)).round_dp(2)
            } else {
                Decimal::ZERO
            };

            rows.push(PositionPartnerRow {
                partner_id: partner.id.to_string(),
                partner_name: partner.name.clone(),
                capital,
                ownership_percent,
                current,
                drawings,
                net_equity: capital + current - drawings,
            });
        }

        rows.sort_by(|a, b| a.partner_name.cmp(&b.partner_name));
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{Account, AccountCategory};
    use domain::accounting::opening_balance::OpeningBalanceLine;
    use domain::shared::currency::Currency;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn test_currency() -> Currency {
        Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
    }

    fn account(code: &str, account_type: AccountType, purpose: AccountPurpose) -> Account {
        Account::new(
            code.to_string(),
            format!("حساب {}", code),
            format!("Account {}", code),
            account_type,
            None,
            AccountCategory::Detail,
            3,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            test_currency(),
            Decimal::ONE,
            None,
        )
        .unwrap()
        .with_purpose(purpose)
    }

    fn migration(lines: Vec<OpeningBalanceLine>) -> OpeningBalanceMigration {
        OpeningBalanceMigration::new(
            Uuid::new_v4().to_string(),
            chrono::Utc::now(),
            None,
            lines,
        )
        .expect("valid migration")
    }

    fn line(account: &Account, amount: Decimal) -> OpeningBalanceLine {
        OpeningBalanceLine {
            account_id: account.id,
            amount,
            description: None,
        }
    }

    fn accounts_map(accounts: &[Account]) -> HashMap<AccountId, Account> {
        accounts.iter().map(|a| (a.id, a.clone())).collect()
    }

    #[test]
    fn test1_balanced_position() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let suppliers = account("2203", AccountType::Liabilities, AccountPurpose::Payable);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);
        let retained = account("5201", AccountType::Equity, AccountPurpose::RetainedEarnings);

        let m = migration(vec![
            line(&cash, dec!(100000)),
            line(&suppliers, dec!(40000)),
            line(&capital, dec!(50000)),
            line(&retained, dec!(10000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, suppliers, capital, retained]));
        let dto = compute_dto(&m, buckets);

        assert_eq!(dto.total_assets, dec!(100000));
        assert_eq!(dto.total_liabilities, dec!(40000));
        assert_eq!(dto.net_assets, dec!(60000));
        assert_eq!(dto.partner_capital, dec!(50000));
        assert_eq!(dto.retained_earnings, dec!(10000));
        assert_eq!(dto.total_equity, dec!(60000));
        assert_eq!(dto.equity_difference, dec!(0));
        assert!(dto.is_balanced, "Test 1 must be balanced");
    }

    #[test]
    fn test2_unbalanced_difference() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let suppliers = account("2203", AccountType::Liabilities, AccountPurpose::Payable);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);
        let retained = account("5201", AccountType::Equity, AccountPurpose::RetainedEarnings);

        let m = migration(vec![
            line(&cash, dec!(100000)),
            line(&suppliers, dec!(40000)),
            line(&capital, dec!(50000)),
            line(&retained, dec!(5000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, suppliers, capital, retained]));
        let dto = compute_dto(&m, buckets);

        assert_eq!(dto.net_assets, dec!(60000));
        assert_eq!(dto.total_equity, dec!(55000));
        assert_eq!(dto.equity_difference, dec!(5000));
        assert!(!dto.is_balanced, "Test 2 must be unbalanced");
        assert!(dto.difference_message.is_some(), "difference must be surfaced");
    }

    #[test]
    fn test3_drawings_are_never_pnl_or_assets() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);
        let drawings = account("4401", AccountType::Equity, AccountPurpose::PartnerDrawings);

        let m = migration(vec![
            line(&cash, dec!(100000)),
            line(&capital, dec!(100000)),
            line(&drawings, dec!(5000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, capital, drawings]));
        let dto = compute_dto(&m, buckets);

        assert_eq!(dto.drawings, dec!(5000));
        assert_eq!(dto.total_assets, dec!(100000), "drawings must not become an asset");
        assert_eq!(dto.total_equity, dec!(95000), "drawings reduce equity (contra)");
        // No Revenue/Expenses anywhere: only Asset/Liability/Equity lines exist.
        assert!(dto.asset_detail.iter().all(|l| l.group_key != "Drawings"));
    }

    #[test]
    fn test4_current_account_not_added_twice() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);
        let current = account("5401", AccountType::Equity, AccountPurpose::PartnerCurrent);

        let m = migration(vec![
            line(&cash, dec!(120000)),
            line(&capital, dec!(100000)),
            line(&current, dec!(20000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, capital, current]));
        let dto = compute_dto(&m, buckets);

        // current appears once in total_equity and once as a line.
        assert_eq!(dto.partner_current_accounts, dec!(20000));
        assert_eq!(dto.total_equity, dec!(120000));
        assert_eq!(dto.net_assets, dec!(120000));
        // The derived historical result excludes the current account.
        assert_eq!(dto.opening_historical_result, dec!(0));
    }

    #[test]
    fn test5_retained_earnings_not_double_counted() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);
        let retained = account("5201", AccountType::Equity, AccountPurpose::RetainedEarnings);

        let m = migration(vec![
            line(&cash, dec!(150000)),
            line(&capital, dec!(100000)),
            line(&retained, dec!(50000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, capital, retained]));
        let dto = compute_dto(&m, buckets);

        // retained counted once; derived historical result equals it (not added again).
        assert_eq!(dto.retained_earnings, dec!(50000));
        assert_eq!(dto.opening_historical_result, dec!(50000));
        assert_eq!(dto.total_equity, dec!(150000));
        assert!(dto.is_balanced);
    }

    #[test]
    fn test8_zero_historical_result() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);

        let m = migration(vec![line(&cash, dec!(100000)), line(&capital, dec!(100000))]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, capital]));
        let dto = compute_dto(&m, buckets);

        assert_eq!(dto.opening_historical_result, dec!(0));
        assert!(dto.is_balanced);
    }

    #[test]
    fn tolerance_treats_subpenny_as_balanced() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);

        // 0.005 drift is within the 0.01 tolerance.
        let m = migration(vec![
            line(&cash, dec!(100.005)),
            line(&capital, dec!(100.000)),
        ]);
        let buckets = bucket_position(&m, &accounts_map(&[cash, capital]));
        let dto = compute_dto(&m, buckets);
        assert!(dto.is_balanced, "sub-penny drift must still be balanced");
    }

    #[test]
    fn grouping_uses_semantics() {
        let cash = account("1001", AccountType::Assets, AccountPurpose::General);
        let customers = account("1203", AccountType::Assets, AccountPurpose::Receivable);
        let inventory = account("1204", AccountType::Assets, AccountPurpose::Inventory);
        let fixed = account("1101", AccountType::Assets, AccountPurpose::FixedAsset);
        let suppliers = account("2203", AccountType::Liabilities, AccountPurpose::Payable);
        let capital = account("5101", AccountType::Equity, AccountPurpose::PartnerCapital);

        let m = migration(vec![
            line(&cash, dec!(10)),
            line(&customers, dec!(20)),
            line(&inventory, dec!(30)),
            line(&fixed, dec!(40)),
            line(&suppliers, dec!(50)),
            line(&capital, dec!(50)),
        ]);
        let accounts = [cash, customers, inventory, fixed, suppliers, capital];
        let buckets = bucket_position(&m, &accounts_map(&accounts));

        let groups: Vec<&str> = buckets.asset_detail.iter().map(|l| l.group_key.as_str()).collect();
        assert!(groups.contains(&"Other"));
        assert!(groups.contains(&"Receivable"));
        assert!(groups.contains(&"Inventory"));
        assert!(groups.contains(&"FixedAsset"));
        assert!(buckets.liability_detail.iter().any(|l| l.group_key == "Payable"));
    }
}
