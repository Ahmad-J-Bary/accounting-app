use std::collections::HashMap;
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::partner::ProfitSharingType;
use domain::accounting::MigrationStatus;
use domain::shared::{Currency, MonetaryAmount, AccountId};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::use_cases::fiscal_period::types::AUTH_ALLOCATION_SOURCE_PREFIX;
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

/// Profit-sharing ratio (%) for a partner.
///
/// - `Manual`: an explicit per-partner ratio wins (Sec 45).
/// - `BasedOnCapitalLocal`: the ratio of the partner's LOCAL (base-currency)
///   capital to the total local capital.
/// - `BasedOnCapitalOriginal`: the ratio of the partner's ORIGINAL (foreign /
///   own-currency) capital to the total original capital.
///
/// `OriginalCapital` is a percentage of *own-currency* amounts, which is
/// currency-independent even when partners hold different currencies.
fn ratio_for(
    sharing: ProfitSharingType,
    manual_ratio: Option<Decimal>,
    capital_local: Decimal,
    capital_original: Decimal,
    total_local: Decimal,
    total_original: Decimal,
) -> Decimal {
    match sharing {
        ProfitSharingType::Manual => manual_ratio.unwrap_or(Decimal::ZERO),
        ProfitSharingType::BasedOnCapitalLocal => {
            if total_local.is_zero() {
                Decimal::ZERO
            } else {
                (capital_local / total_local) * Decimal::new(100, 0)
            }
        }
        ProfitSharingType::BasedOnCapitalOriginal => {
            if total_original.is_zero() {
                Decimal::ZERO
            } else {
                (capital_original / total_original) * Decimal::new(100, 0)
            }
        }
    }
}

/// Tolerance (in percentage points) below which a ratio sum is accepted as
/// exactly 100%. Legal decimal accumulation (e.g. 33.33+33.33+33.34) is fine;
/// a real deviation (99.5% or 101%) is rejected.
fn ratio_sum_tolerance() -> Decimal {
    Decimal::new(1, 2) // 0.01
}

/// Per-§15: a partner configured with Manual profit sharing must carry an
/// explicit ratio — a missing ratio is rejected up front.
fn ensure_manual_ratios(
    partners: &[(String, ProfitSharingType, Option<Decimal>)],
) -> Result<(), AppError> {
    for (name, sharing, ratio) in partners {
        if *sharing == ProfitSharingType::Manual && ratio.is_none() {
            return Err(AppError::Invalid(format!(
                "الشريك {name} مكوّن على التوزيع اليدوي دون نسبة محددة — حدّد نسبة التوزيع أولاً"
            )));
        }
    }
    Ok(())
}

/// Per-§15: the effective ratios (derived from the Manual value or the chosen
/// capital basis) must be non-negative and sum to 100% (± tolerance). Returns
/// the total when valid.
fn validate_ratio_list(ratios: &[(String, Decimal)]) -> Result<Decimal, AppError> {
    let mut total = Decimal::ZERO;
    for (name, ratio) in ratios {
        if ratio.is_sign_negative() {
            return Err(AppError::Invalid(format!("نسبة توزيع أرباح الشريك {name} سالبة")));
        }
        total += ratio;
    }
    if (total - Decimal::new(100, 0)).abs() > ratio_sum_tolerance() {
        return Err(AppError::Invalid(format!(
            "مجموع نسب توزيع الأرباح يجب أن يساوي 100% (المجموع الحالي: {total})"
        )));
    }
    Ok(total)
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

        // Profit distribution keys on the migration: re-running the command for
        // the same migration must resolve to the already-posted distribution
        // instead of creating a second journal (Sec 8 / Sec 10 / Sec 45). The
        // DB-level UNIQUE(source_type, source_id) backs this up.
        let source_id = format!("{AUTH_ALLOCATION_SOURCE_PREFIX}{}", migration.id);
        if let Some(existing) = self.journal_repo.find_by_source_id(&source_id).await? {
            return self.dto_from_existing(&existing, net_profit).await;
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

        let total_local: Decimal = partners.iter().map(|p| p.amount_local).sum();
        let total_original: Decimal = partners.iter().map(|p| p.amount_original).sum();

        // Per-§15: every participating partner must carry a valid sharing
        // configuration before an allocation journal is created.
        let sharing_config: Vec<(String, ProfitSharingType, Option<Decimal>)> = partners
            .iter()
            .map(|p| (p.name.clone(), p.profit_sharing_type, p.profit_sharing_ratio))
            .collect();
        ensure_manual_ratios(&sharing_config)?;

        // Pass 1: compute ratio + raw share for each partner.
        struct Pending {
            partner: usize,
            name: String,
            capital: Decimal,
            ratio_percent: Decimal,
            raw_share: Decimal,
        }
        let mut pendings: Vec<Pending> = Vec::with_capacity(partners.len());
        let mut effective_ratios: Vec<(String, Decimal)> = Vec::with_capacity(partners.len());
        for (idx, p) in partners.iter().enumerate() {
            let ratio = ratio_for(
                p.profit_sharing_type,
                p.profit_sharing_ratio,
                p.amount_local,
                p.amount_original,
                total_local,
                total_original,
            );
            effective_ratios.push((p.name.clone(), ratio));
            let raw_share = net_profit * (ratio / Decimal::new(100, 0));
            pendings.push(Pending {
                partner: idx,
                name: p.name.clone(),
                capital: p.amount_local,
                ratio_percent: ratio.round_dp(2),
                raw_share,
            });
        }

        // Strict-§15: negative or non-100% ratio totals are rejected
        // (99.5% / 101% fail; accumulation artifacts up to 0.01pp pass).
        validate_ratio_list(&effective_ratios)?;

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
            // Profit allocations accrue to the partner's CURRENT (profit)
            // account, keeping registered capital un-polluted (Sec 4 / Sec 13).
            let current_account = partners[p.partner].current_account_id
                .ok_or(AppError::Invalid(format!("الشريك {} لا يملك حساباً جارياً مرتبطاً", p.name)))?;

            let amount = MonetaryAmount::from_base(share_dec.abs(), base_currency.clone());
            let zero = MonetaryAmount::zero(base_currency.clone());
            if *share_dec < Decimal::ZERO {
                lines.push(JournalLine::new(
                    current_account,
                    amount.clone(),
                    zero.clone(),
                    format!("نصيب الشريك من الخسارة: {}", p.name),
                ));
            } else {
                lines.push(JournalLine::new(
                    current_account,
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

        // Retained-earnings leg balances the pot: distributing profit debits
        // retained earnings (52) and credits each partner's current account.
        let net_amount = MonetaryAmount::from_base(net_profit.abs(), base_currency.clone());
        let zero_net = MonetaryAmount::zero(base_currency.clone());
        if net_profit < Decimal::ZERO {
            lines.insert(0, JournalLine::new(equity.id, zero_net, net_amount, "توزيع خسارة على الشركاء".to_string()));
        } else {
            lines.insert(0, JournalLine::new(equity.id, net_amount, zero_net, "توزيع أرباح على الشركاء".to_string()));
        }

        let entry_number = self.journal_repo.get_next_entry_number().await?;
        let mut entry = JournalEntry::new(
            entry_number.clone(),
            JournalType::ProfitDistribution,
            lines,
            migration.cutover_date,
            "توزيع صافي أرباح الترحيل على الشركاء".to_string(),
            Some(source_id),
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

    /// Rebuilds the allocation DTO from an already-posted profit-distribution
    /// journal of the same migration, so a re-run returns a stable result
    /// instead of double-posting. The share of each partner is the amount on the
    /// line hitting that partner's current (profit) account.
    async fn dto_from_existing(
        &self,
        entry: &JournalEntry,
        requested_net_profit: Decimal,
    ) -> Result<NetProfitAllocationDto, AppError> {
        let partners = self.partner_repo.list_all(false).await?;
        let mut by_account: HashMap<AccountId, &domain::accounting::partner::Partner> = HashMap::new();
        for p in &partners {
            if let Some(aid) = p.current_account_id {
                by_account.insert(aid, p);
            }
        }

        let mut shares: Vec<PartnerAllocationShare> = Vec::new();
        let mut allocated_total = Decimal::ZERO;
        for line in &entry.lines {
            if line.base_debit().is_zero() && line.base_credit().is_zero() {
                continue;
            }
            let Some(p) = by_account.get(&line.account_id) else { continue };
            let share = if line.base_credit().is_zero() {
                -line.base_debit()
            } else {
                line.base_credit()
            };
            allocated_total += share;
            let ratio = if requested_net_profit.is_zero() {
                Decimal::ZERO
            } else {
                (share / requested_net_profit) * Decimal::new(100, 0)
            };
            shares.push(PartnerAllocationShare {
                partner_id: p.id.0.to_string(),
                partner_name: p.name.clone(),
                capital: p.amount_local,
                ratio_percent: ratio.round_dp(2),
                share,
            });
        }

        Ok(NetProfitAllocationDto {
            entry_number: entry.entry_number.clone(),
            net_profit: requested_net_profit,
            allocated_total,
            shares,
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
        let r = ratio_for(
            ProfitSharingType::Manual,
            Some(Decimal::new(60, 0)),
            Decimal::new(100, 0),
            Decimal::new(100, 0),
            Decimal::new(200, 0),
            Decimal::new(200, 0),
        );
        assert_eq!(r, Decimal::new(60, 0));
    }

    #[test]
    fn local_capital_ratio_is_weighted_and_zero_safe() {
        // Local = 40 of 200 → 20%.
        let r = ratio_for(
            ProfitSharingType::BasedOnCapitalLocal,
            None,
            Decimal::new(40, 0),
            Decimal::new(999, 0),
            Decimal::new(200, 0),
            Decimal::new(999, 0),
        );
        assert_eq!(r, Decimal::new(20, 0));
        let zero = ratio_for(
            ProfitSharingType::BasedOnCapitalLocal,
            None,
            Decimal::new(40, 0),
            Decimal::new(999, 0),
            Decimal::ZERO,
            Decimal::new(999, 0),
        );
        assert_eq!(zero, Decimal::ZERO);
    }

    #[test]
    fn original_capital_ratio_uses_own_currency_amounts() {
        // Two partners in different currencies, both holding 100 in their own
        // currency: each gets 50% even though the local (converted) totals
        // differ. Original ratio must be currency-independent.
        let partner_a = ratio_for(
            ProfitSharingType::BasedOnCapitalOriginal,
            None,
            Decimal::new(3_750, 0), // SAR 3750 local for USD 1000 @3.75
            Decimal::new(1_000, 0), // USD 1000 original
            Decimal::new(7_750, 0),
            Decimal::new(2_000, 0),
        );
        assert_eq!(partner_a, Decimal::new(50, 0));
    }

    #[test]
    fn manual_partner_requires_explicit_ratio() {
        let ok = ensure_manual_ratios(&[
            ("A".into(), ProfitSharingType::Manual, Some(Decimal::new(60, 0))),
            ("B".into(), ProfitSharingType::Manual, Some(Decimal::new(40, 0))),
        ]);
        assert!(ok.is_ok());

        let missing = ensure_manual_ratios(&[
            ("A".into(), ProfitSharingType::Manual, None),
        ]);
        assert!(missing.is_err(), "manual partner without ratio must be rejected");
    }

    #[test]
    fn ratio_sum_100_is_accepted() {
        let r = validate_ratio_list(&[
            ("A".into(), Decimal::new(60, 0)),
            ("B".into(), Decimal::new(40, 0)),
        ]);
        assert!(r.is_ok());
        assert_eq!(r.unwrap(), Decimal::new(100, 0));
    }

    #[test]
    fn ratio_sum_below_and_above_100_rejected() {
        // 99.5% — rejected.
        assert!(validate_ratio_list(&[
            ("A".into(), Decimal::new(60, 0)),
            ("B".into(), Decimal::new(3950, 2)),
        ]).is_err());
        // 101% — rejected.
        assert!(validate_ratio_list(&[
            ("A".into(), Decimal::new(60, 0)),
            ("B".into(), Decimal::new(41, 0)),
        ]).is_err());
    }

    #[test]
    fn negative_ratio_is_rejected() {
        assert!(validate_ratio_list(&[
            ("A".into(), Decimal::new(-5, 0)),
            ("B".into(), Decimal::new(105, 0)),
        ]).is_err());
    }

    #[test]
    fn rounding_accumulation_tolerance_accepts_100() {
        // 33.33 + 33.33 + 33.34 = 100.00 — accumulation artifact, accepted.
        let r = validate_ratio_list(&[
            ("A".into(), Decimal::new(3333, 2)),
            ("B".into(), Decimal::new(3333, 2)),
            ("C".into(), Decimal::new(3334, 2)),
        ]);
        assert!(r.is_ok());
    }
}