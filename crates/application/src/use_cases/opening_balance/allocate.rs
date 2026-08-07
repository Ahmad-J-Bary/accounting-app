use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::partner::ProfitSharingType;
use domain::accounting::MigrationStatus;
use domain::shared::{Currency, MonetaryAmount};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::use_cases::opening_balance::types::{
    AllocateNetProfitCommand, NetProfitAllocationDto, PartnerAllocationShare,
};

/// Retained-earnings account used as the debit source when distributing profit.
const RETAINED_EARNINGS_ACCOUNT_CODE: &str = "52";

/// Rounds each raw share to 2 decimals, then adjusts the largest-magnitude share
/// so the total exactly equals `target` (absorbs the rounding remainder). If every
/// share is zero it is returned untouched (an inherently unbucketable case).
fn adjust_shares_to_sum(raw: Vec<Decimal>, target: Decimal) -> Vec<Decimal> {
    let mut shares: Vec<Decimal> = raw.into_iter().map(|s| s.round_dp(2)).collect();
    if shares.iter().all(|s| s.is_zero()) {
        return shares;
    }
    let total: Decimal = shares.iter().sum();
    let gap = target - total;
    if !gap.is_zero() {
        if let Some(biggest) = shares
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.abs().cmp(&b.1.abs()))
            .map(|(i, _)| i)
        {
            shares[biggest] += gap;
        }
    }
    shares
}

/// Allocation ratio (%) for a partner: Manual ratio wins, otherwise the
/// capital-weighted ratio.
fn ratio_for(capital: Decimal, total_capital: Decimal, is_manual: bool, manual_ratio: Option<Decimal>) -> Decimal {
    if is_manual {
        manual_ratio.unwrap_or(Decimal::ZERO)
    } else if total_capital.is_zero() {
        Decimal::ZERO
    } else {
        (capital / total_capital) * Decimal::new(100, 0)
    }
}

pub struct AllocateNetProfitUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    partner_repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl AllocateNetProfitUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        partner_repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { migration_repo, partner_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, cmd: AllocateNetProfitCommand) -> Result<NetProfitAllocationDto, AppError> {
        let net_profit = Decimal::from_str(&cmd.net_profit)
            .map_err(|_| AppError::Invalid("قيمة صافي الربح غير صالحة".into()))?;

        let migration = self.migration_repo.find_by_id(&cmd.migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        if migration.status != MigrationStatus::Posted {
            return Err(AppError::Forbidden("يجب ترحيل الرصيد الافتتاحي قبل توزيع الأرباح".into()));
        }

        if net_profit == Decimal::ZERO {
            return Ok(NetProfitAllocationDto {
                entry_number: String::new(),
                net_profit,
                allocated_total: Decimal::ZERO,
                shares: vec![],
            });
        }

        let partners = self.partner_repo.list_all(false).await?;
        if partners.is_empty() {
            return Err(AppError::Invalid("لا يوجد شركاء لاستلام توزيع الأرباح".into()));
        }

        let total_capital: Decimal = partners.iter().map(|p| p.amount_local).sum();

        // Pass 1: compute ratio + raw share for each partner.
        struct Pending {
            partner: usize,
            name: String,
            capital: Decimal,
            ratio_percent: Decimal,
            raw_share: Decimal,
        }
        let mut pendings: Vec<Pending> = Vec::with_capacity(partners.len());
        for (idx, p) in partners.iter().enumerate() {
            let ratio = ratio_for(
                p.amount_local,
                total_capital,
                p.profit_sharing_type == ProfitSharingType::Manual,
                p.profit_sharing_ratio,
            );
            let raw_share = net_profit * (ratio / Decimal::new(100, 0));
            pendings.push(Pending {
                partner: idx,
                name: p.name.clone(),
                capital: p.amount_local,
                ratio_percent: ratio.round_dp(2),
                raw_share,
            });
        }

        let shares = adjust_shares_to_sum(pendings.iter().map(|p| p.raw_share).collect(), net_profit);
        if shares.iter().all(|s| s.is_zero()) {
            return Err(AppError::Invalid("نسب توزيع الأرباح تساوي صفراً؛ تحقق من نسب الشركاء".into()));
        }

        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
        let equity = self.account_repo.find_by_code(RETAINED_EARNINGS_ACCOUNT_CODE).await?
            .ok_or_else(|| AppError::NotFound(
                format!("حساب الأرباح المبقاة غير موجود: {RETAINED_EARNINGS_ACCOUNT_CODE}")
            ))?;

        // Pass 2: build journal lines + DTO shares.
        let mut lines: Vec<JournalLine> = Vec::with_capacity(partners.len() + 1);
        let mut dto_shares: Vec<PartnerAllocationShare> = Vec::with_capacity(shares.len());

        for (p, share_dec) in pendings.iter().zip(shares.iter()) {
            let capital_account = partners[p.partner].linked_account_id
                .ok_or(AppError::Invalid(format!("الشريك {} لا يملك حساب رأس مال مرتبط", p.name)))?;

            let amount = MonetaryAmount::from_base(share_dec.abs(), base_currency.clone());
            let zero = MonetaryAmount::zero(base_currency.clone());
            if *share_dec < Decimal::ZERO {
                lines.push(JournalLine::new(
                    capital_account,
                    amount.clone(),
                    zero.clone(),
                    format!("نصيب الشريك من الخسارة: {}", p.name),
                ));
            } else {
                lines.push(JournalLine::new(
                    capital_account,
                    zero.clone(),
                    amount.clone(),
                    format!("نصيب الشريك من الأرباح: {}", p.name),
                ));
            }

            dto_shares.push(PartnerAllocationShare {
                partner_id: partners[p.partner].id.0.to_string(),
                partner_name: p.name.clone(),
                capital: p.capital,
                ratio_percent: p.ratio_percent,
                share: *share_dec,
            });
        }

        // Retained-earnings leg balances the pot (reverses for a loss).
        let net_amount = MonetaryAmount::from_base(net_profit.abs(), base_currency.clone());
        let zero_net = MonetaryAmount::zero(base_currency.clone());
        if net_profit < Decimal::ZERO {
            lines.insert(0, JournalLine::new(equity.id, net_amount, zero_net, "توزيع خسارة على الشركاء".to_string()));
        } else {
            lines.insert(0, JournalLine::new(equity.id, zero_net, net_amount, "توزيع أرباح على الشركاء".to_string()));
        }

        let entry_number = self.journal_repo.get_next_entry_number().await?;
        let mut entry = JournalEntry::new(
            entry_number.clone(),
            JournalType::ProfitDistribution,
            lines,
            migration.cutover_date,
            "توزيع صافي أرباح الترحيل على الشركاء".to_string(),
            Some(format!("profit_distribution:{}", migration.id)),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.journal_repo.save(&entry).await?;

        let final_total: Decimal = dto_shares.iter().map(|s| s.share).sum();
        Ok(NetProfitAllocationDto {
            entry_number,
            net_profit,
            allocated_total: final_total,
            shares: dto_shares,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn rounded_shares_sum_to_target() {
        let net = Decimal::new(10000, 2);
        let raw = vec![
            net * Decimal::from_str("0.33333").unwrap(),
            net * Decimal::from_str("0.33333").unwrap(),
            net * Decimal::from_str("0.33334").unwrap(),
        ];
        let sums = adjust_shares_to_sum(raw, net);
        let total: Decimal = sums.iter().sum();
        assert_eq!(total, net);
    }

    #[test]
    fn zero_shares_stay_zero() {
        let sums = adjust_shares_to_sum(vec![Decimal::ZERO, Decimal::ZERO], Decimal::new(10000, 2));
        assert_eq!(sums.iter().sum::<Decimal>(), Decimal::ZERO);
    }

    #[test]
    fn manual_ratio_is_respected() {
        let r = ratio_for(Decimal::new(100, 0), Decimal::new(200, 0), true, Some(Decimal::new(60, 0)));
        assert_eq!(r, Decimal::new(60, 0));
    }

    #[test]
    fn capital_ratio_is_weighted_and_zero_safe() {
        let r = ratio_for(Decimal::new(40, 0), Decimal::new(200, 0), false, None);
        assert_eq!(r, Decimal::new(20, 0));
        assert_eq!(ratio_for(Decimal::new(40, 0), Decimal::ZERO, false, None), Decimal::ZERO);
    }
}