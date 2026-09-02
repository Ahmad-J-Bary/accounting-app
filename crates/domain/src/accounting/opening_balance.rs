use crate::accounting::account::AccountPurpose;
use crate::shared::errors::DomainError;
use crate::shared::ids::AccountId;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum MigrationStatus {
    Draft,
    Validated,
    Approved,
    Posted,
    Locked,
    Cancelled,
}

impl MigrationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "Draft",
            Self::Validated => "Validated",
            Self::Approved => "Approved",
            Self::Posted => "Posted",
            Self::Locked => "Locked",
            Self::Cancelled => "Cancelled",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "Validated" => Self::Validated,
            "Approved" => Self::Approved,
            "Posted" => Self::Posted,
            "Locked" => Self::Locked,
            "Cancelled" => Self::Cancelled,
            _ => Self::Draft,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceLine {
    pub account_id: AccountId,
    /// Positive magnitude of the opening balance. The Dr/Cr side is derived
    /// from the account's nature (assets/expenses = debit; liabilities/
    /// equity/revenue = credit) at posting time.
    pub amount: Decimal,
    pub description: Option<String>,
}

/// Explicit accounting classification for the residual equity of an opening
/// migration. The system computes the residual but never decides its nature:
/// the accountant must pick one explicitly (Sec 6 / Sec 8).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ResidualClassification {
    RetainedEarnings,
    OpeningEquityAdjustment,
    PriorPeriodAdjustment,
    OtherEquity,
    UnresolvedDifference,
}

impl ResidualClassification {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RetainedEarnings => "RetainedEarnings",
            Self::OpeningEquityAdjustment => "OpeningEquityAdjustment",
            Self::PriorPeriodAdjustment => "PriorPeriodAdjustment",
            Self::OtherEquity => "OtherEquity",
            Self::UnresolvedDifference => "UnresolvedDifference",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "RetainedEarnings" => Some(Self::RetainedEarnings),
            "OpeningEquityAdjustment" => Some(Self::OpeningEquityAdjustment),
            "PriorPeriodAdjustment" => Some(Self::PriorPeriodAdjustment),
            "OtherEquity" => Some(Self::OtherEquity),
            "UnresolvedDifference" => Some(Self::UnresolvedDifference),
            _ => None,
        }
    }

    /// Arabic label of the classification as shown to the user («ما طبيعة هذا
    /// الرصيد؟»).
    pub fn label_ar(self) -> &'static str {
        match self {
            Self::RetainedEarnings => "أرباح مبقاة",
            Self::OpeningEquityAdjustment => "تعديل حقوق ملكية افتتاحي",
            Self::PriorPeriodAdjustment => "تعديل فترة سابقة",
            Self::OtherEquity => "حقوق ملكية أخرى",
            Self::UnresolvedDifference => "فرق غير محلول",
        }
    }

    /// The ONE controlled account purpose this classification may post to —
    /// the user chooses accounting meaning, the system chooses the account.
    /// `UnresolvedDifference` has no purpose: it never carries a balance, so it
    /// blocks posting and locking.
    pub fn account_purpose(self) -> Option<AccountPurpose> {
        match self {
            Self::RetainedEarnings => Some(AccountPurpose::RetainedEarnings),
            Self::OpeningEquityAdjustment => Some(AccountPurpose::OpeningEquityAdjustment),
            Self::PriorPeriodAdjustment => Some(AccountPurpose::PriorPeriodAdjustment),
            Self::OtherEquity => Some(AccountPurpose::OtherEquity),
            Self::UnresolvedDifference => None,
        }
    }

    /// Whether a migration classified this way may be posted (and later locked).
    /// Only `UnresolvedDifference` blocks — an unclassified residual must be
    /// resolved before any posting/locking occurs.
    pub fn allows_posting(self) -> bool {
        !matches!(self, Self::UnresolvedDifference)
    }

    /// Whether the integration must show an explicit warning + confirmation
    /// before this classification is accepted (prior-period corrections are
    /// deliberate accounting judgements).
    pub fn requires_confirmation(self) -> bool {
        matches!(self, Self::PriorPeriodAdjustment)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceMigration {
    pub id: String,
    pub company_id: Option<String>,
    pub cutover_date: DateTime<Utc>,
    pub source_system: Option<String>,
    pub source_reference: Option<String>,
    pub residual_classification: Option<ResidualClassification>,
    pub residual_account_id: Option<AccountId>,
    /// Set when the residual (OBE balance) has been moved into the chosen
    /// classification account by `ApplyResidualToLedgerUseCase`.
    pub residual_applied_at: Option<DateTime<Utc>>,
    pub status: MigrationStatus,
    pub notes: Option<String>,
    pub lines: Vec<OpeningBalanceLine>,
    pub validated_by: Option<String>,
    pub validated_at: Option<DateTime<Utc>>,
    pub approved_by: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub posted_at: Option<DateTime<Utc>>,
    pub locked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl OpeningBalanceMigration {
    pub fn new(
        id: String,
        cutover_date: DateTime<Utc>,
        notes: Option<String>,
        lines: Vec<OpeningBalanceLine>,
    ) -> Result<Self, DomainError> {
        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "يجب إدخال بند واحد على الأقل في رصيد الافتتاح".into(),
            ));
        }
        for line in &lines {
            if line.amount <= Decimal::ZERO {
                return Err(DomainError::Invalid(
                    "قيم أرصدة الافتتاح يجب أن تكون أكبر من الصفر".into(),
                ));
            }
        }
        let now = Utc::now();
        Ok(Self {
            id,
            company_id: None,
            cutover_date,
            source_system: None,
            source_reference: None,
            residual_classification: None,
            residual_account_id: None,
            residual_applied_at: None,
            status: MigrationStatus::Draft,
            notes,
            lines,
            validated_by: None,
            validated_at: None,
            approved_by: None,
            approved_at: None,
            posted_at: None,
            locked_at: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn set_notes(&mut self, notes: Option<String>) {
        self.notes = notes;
        self.updated_at = Utc::now();
    }

    /// Replaces the migration's opening lines while the migration is still
    /// editable (Draft / Validated). Editing lines invalidates any prior
    /// validation: the status is reset to `Draft` and the audit trail cleared,
    /// so the wizard can go back, fix a line and re-run the lifecycle.
    pub fn replace_lines(&mut self, lines: Vec<OpeningBalanceLine>) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Draft, MigrationStatus::Validated],
            "لا يمكن تعديل بنود الترحيل بعد نشره أو قفله",
        )?;
        if lines.is_empty() {
            return Err(DomainError::Invalid(
                "يجب إدخال بند واحد على الأقل في رصيد الافتتاح".into(),
            ));
        }
        for line in &lines {
            if line.amount <= Decimal::ZERO {
                return Err(DomainError::Invalid(
                    "قيم أرصدة الافتتاح يجب أن تكون أكبر من الصفر".into(),
                ));
            }
        }
        self.lines = lines;
        self.status = MigrationStatus::Draft;
        self.validated_by = None;
        self.validated_at = None;
        self.approved_by = None;
        self.approved_at = None;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Optional metadata used to trace the migration back to its source
    /// (e.g. the prior accounting system and a local reference number).
    pub fn set_source(
        &mut self,
        company_id: Option<String>,
        source_system: Option<String>,
        source_reference: Option<String>,
    ) {
        self.company_id = company_id;
        self.source_system = source_system;
        self.source_reference = source_reference;
        self.updated_at = Utc::now();
    }

    /// Records the accountant-approved classification of the residual equity.
    /// `residual_account_id` is the ledger account (e.g. 52 retained earnings)
    /// that carries the residual line.
    pub fn set_residual_classification(
        &mut self,
        classification: Option<ResidualClassification>,
        residual_account_id: Option<AccountId>,
    ) {
        self.residual_classification = classification;
        self.residual_account_id = residual_account_id;
        self.updated_at = Utc::now();
    }

    /// Marks the residual as applied to the ledger. Only a posted migration
    /// that already carries an accountant-chosen classification plus a target
    /// account may be applied (guarded at the cluster / use-case level); the
    /// domain simply records the timestamp so the lock gate can prove the
    /// Opening Balance Control (53) was re-classified and not silently
    /// left as an unexplained difference.
    pub fn mark_residual_applied(&mut self) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Posted, MigrationStatus::Locked],
            "لا يمكن ترحيل التصنيف إلا بعد ترحيل الترحيل",
        )?;
        if self.residual_classification.is_none() || self.residual_account_id.is_none() {
            return Err(DomainError::Invalid(
                "يجب تحديد تصنيف حساب الرصيد المتبقي قبل ترحيله".into(),
            ));
        }
        self.residual_applied_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn validate(&mut self, by: &str) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Draft],
            "لا يمكن التحقق من ترحيل غير مسودة",
        )?;
        self.status = MigrationStatus::Validated;
        self.validated_by = Some(by.to_string());
        self.validated_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn approve(&mut self, by: &str) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Validated],
            "يجب التحقق من الترحيل قبل اعتماده",
        )?;
        self.status = MigrationStatus::Approved;
        self.approved_by = Some(by.to_string());
        self.approved_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn mark_posted(&mut self) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Approved],
            "يجب اعتماد الترحيل قبل ترحيله",
        )?;
        self.status = MigrationStatus::Posted;
        self.posted_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn lock(&mut self) -> Result<(), DomainError> {
        self.require_status(&[MigrationStatus::Posted], "لا يمكن قفل إلا الترحيل المرحل")?;
        self.status = MigrationStatus::Locked;
        self.locked_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn unlock(&mut self) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Locked],
            "لا يمكن إلغاء القفل إلا لترحيل مقفول",
        )?;
        self.status = MigrationStatus::Posted;
        self.locked_at = None;
        self.updated_at = Utc::now();
        Ok(())
    }

    #[inline]
    fn require_status(&self, allowed: &[MigrationStatus], msg: &str) -> Result<(), DomainError> {
        if allowed.contains(&self.status) {
            Ok(())
        } else {
            Err(DomainError::Forbidden(msg.into()))
        }
    }

    /// Voids a previously-posted migration by moving it to `Cancelled`. The
    /// caller is responsible for posting the corresponding reversing journal
    /// entry atomically with this status change.
    pub fn un_post(&mut self) -> Result<(), DomainError> {
        self.require_status(&[MigrationStatus::Posted], "لا يمكن إلغاء إلا الترحيل المرحل")?;
        self.status = MigrationStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Cancels a migration that has not yet been posted.
    pub fn cancel(&mut self) -> Result<(), DomainError> {
        self.require_status(
            &[
                MigrationStatus::Draft,
                MigrationStatus::Validated,
                MigrationStatus::Approved,
            ],
            "لا يمكن إلغاء الترحيل بعد ترحيله",
        )?;
        self.status = MigrationStatus::Cancelled;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Re-opens a previously-cancelled (pre-posting) migration back to `Draft`
    /// so its lines can be edited and the lifecycle re-run. Works only for
    /// migrations that were cancelled before posting; posted/cancelled-after-
    /// posting migrations cannot be re-opened and must be re-pathed via a fresh
    /// migration.
    pub fn reopen(&mut self) -> Result<(), DomainError> {
        self.require_status(
            &[MigrationStatus::Cancelled],
            "لا يمكن إعادة فتح إلا الترحيل الملغى قبل الترحيل",
        )?;
        self.status = MigrationStatus::Draft;
        self.validated_by = None;
        self.validated_at = None;
        self.approved_by = None;
        self.approved_at = None;
        self.posted_at = None;
        self.locked_at = None;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn total_lines_amount(&self) -> Decimal {
        self.lines.iter().map(|l| l.amount).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn sample(amount: Decimal) -> OpeningBalanceMigration {
        let line = OpeningBalanceLine {
            account_id: AccountId(uuid::Uuid::new_v4()),
            amount,
            description: None,
        };
        OpeningBalanceMigration::new("mig-1".into(), Utc::now(), None, vec![line])
            .expect("valid migration")
    }

    #[test]
    fn lifecycle_reaches_locked_and_cancels_before_post() {
        let mut m = sample(Decimal::new(1000, 2));
        assert_eq!(m.status, MigrationStatus::Draft);

        m.validate("u1").unwrap();
        assert_eq!(m.status, MigrationStatus::Validated);
        assert!(m.validated_at.is_some());
        assert_eq!(m.validated_by.as_deref(), Some("u1"));

        m.approve("u2").unwrap();
        assert_eq!(m.status, MigrationStatus::Approved);
        assert!(m.approved_at.is_some());

        m.mark_posted().unwrap();
        assert_eq!(m.status, MigrationStatus::Posted);
        assert!(m.posted_at.is_some());

        m.lock().unwrap();
        assert_eq!(m.status, MigrationStatus::Locked);
        assert!(m.locked_at.is_some());
    }

    #[test]
    fn posting_requires_approval() {
        let mut m = sample(Decimal::new(500, 0));
        assert!(m.mark_posted().is_err());

        m.validate("u1").unwrap();
        assert!(m.mark_posted().is_err());

        m.approve("u2").unwrap();
        assert!(m.mark_posted().is_ok());
    }

    #[test]
    fn locking_requires_posted() {
        let mut m = sample(Decimal::new(500, 0));
        assert!(m.lock().is_err());

        m.validate("u1").unwrap();
        m.approve("u2").unwrap();
        m.mark_posted().unwrap();
        assert!(m.lock().is_ok());

        // unlock returns to Posted
        m.unlock().unwrap();
        assert_eq!(m.status, MigrationStatus::Posted);
        assert!(m.locked_at.is_none());
    }

    #[test]
    fn cancel_allows_pre_post_states_only() {
        let mut m = sample(Decimal::new(500, 0));
        m.cancel().unwrap();
        assert_eq!(m.status, MigrationStatus::Cancelled);

        // A posted migration cannot be cancelled via cancel(); use un_post.
        let mut m2 = sample(Decimal::new(500, 0));
        m2.validate("u1").unwrap();
        m2.approve("u2").unwrap();
        m2.mark_posted().unwrap();
        assert!(m2.cancel().is_err());
        m2.un_post().unwrap();
        assert_eq!(m2.status, MigrationStatus::Cancelled);
    }

    #[test]
    fn reopen_returns_cancelled_to_draft_and_clears_audit() {
        let mut m = sample(Decimal::new(1000, 2));
        m.validate("u1").unwrap();
        m.approve("u2").unwrap();
        m.cancel().unwrap();
        assert_eq!(m.status, MigrationStatus::Cancelled);

        m.reopen().unwrap();
        assert_eq!(m.status, MigrationStatus::Draft);
        assert!(m.validated_at.is_none());
        assert!(m.approved_by.is_none());
        assert!(m.posted_at.is_none());
    }

    #[test]
    fn reopen_rejects_non_cancelled_and_posted() {
        let mut posted = sample(Decimal::new(500, 0));
        posted.validate("u1").unwrap();
        posted.approve("u2").unwrap();
        posted.mark_posted().unwrap();
        assert!(posted.reopen().is_err(), "فتح ترحيل مرحَّل مرفوض");

        let mut draft = sample(Decimal::new(500, 0));
        assert!(draft.reopen().is_err(), "فتح مسودة مرفوض");
    }

    #[test]
    fn status_round_trip() {
        for s in [
            MigrationStatus::Draft,
            MigrationStatus::Validated,
            MigrationStatus::Approved,
            MigrationStatus::Posted,
            MigrationStatus::Locked,
            MigrationStatus::Cancelled,
        ] {
            assert_eq!(MigrationStatus::from_str(s.as_str()), s);
        }
    }

    #[test]
    fn residual_classification_round_trip() {
        for c in [
            ResidualClassification::RetainedEarnings,
            ResidualClassification::OpeningEquityAdjustment,
            ResidualClassification::PriorPeriodAdjustment,
            ResidualClassification::OtherEquity,
            ResidualClassification::UnresolvedDifference,
        ] {
            assert_eq!(ResidualClassification::from_str(c.as_str()), Some(c));
        }
        assert_eq!(ResidualClassification::from_str("Unknown"), None);
    }

    #[test]
    fn set_residual_classification_persists_fields() {
        let mut m = sample(Decimal::new(1000, 2));
        let account_id = AccountId(uuid::Uuid::new_v4());
        m.set_residual_classification(
            Some(ResidualClassification::RetainedEarnings),
            Some(account_id),
        );
        assert_eq!(
            m.residual_classification,
            Some(ResidualClassification::RetainedEarnings)
        );
        assert_eq!(m.residual_account_id, Some(account_id));
    }

    #[test]
    fn mark_residual_applied_requires_posted_and_classified() {
        // Draft without classification → rejected
        let mut m = sample(Decimal::new(1000, 2));
        assert!(m.mark_residual_applied().is_err());

        // Posted but never classified → rejected (no residual_account_id)
        let mut m = sample(Decimal::new(1000, 2));
        m.validate("u1").unwrap();
        m.approve("u2").unwrap();
        m.mark_posted().unwrap();
        assert!(m.mark_residual_applied().is_err());

        // Posted + classified → accepted and timestamped
        let account_id = AccountId(uuid::Uuid::new_v4());
        let mut m = sample(Decimal::new(1000, 2));
        m.validate("u1").unwrap();
        m.approve("u2").unwrap();
        m.mark_posted().unwrap();
        m.set_residual_classification(
            Some(ResidualClassification::RetainedEarnings),
            Some(account_id),
        );
        assert!(m.mark_residual_applied().is_ok());
        assert!(m.residual_applied_at.is_some());

        // Locked + classified → still recorded (the timestamp is idempotent
        // ledger proof that 53 was re-classified before/after locking).
        let account_id = AccountId(uuid::Uuid::new_v4());
        let mut m2 = sample(Decimal::new(1000, 2));
        m2.validate("u1").unwrap();
        m2.approve("u2").unwrap();
        m2.mark_posted().unwrap();
        m2.lock().unwrap();
        m2.set_residual_classification(
            Some(ResidualClassification::OpeningEquityAdjustment),
            Some(account_id),
        );
        assert!(m2.mark_residual_applied().is_ok());
    }

    #[test]
    fn each_classification_maps_to_one_controlled_purpose_only() {
        use crate::accounting::account::AccountPurpose;
        assert_eq!(
            ResidualClassification::RetainedEarnings.account_purpose(),
            Some(AccountPurpose::RetainedEarnings)
        );
        assert_eq!(
            ResidualClassification::OpeningEquityAdjustment.account_purpose(),
            Some(AccountPurpose::OpeningEquityAdjustment)
        );
        assert_eq!(
            ResidualClassification::PriorPeriodAdjustment.account_purpose(),
            Some(AccountPurpose::PriorPeriodAdjustment)
        );
        assert_eq!(
            ResidualClassification::OtherEquity.account_purpose(),
            Some(AccountPurpose::OtherEquity)
        );
        // Unresolved difference never maps to an account.
        assert_eq!(
            ResidualClassification::UnresolvedDifference.account_purpose(),
            None
        );
    }

    #[test]
    fn unresolved_difference_blocks_posting_but_others_allow_it() {
        for c in [
            ResidualClassification::RetainedEarnings,
            ResidualClassification::OpeningEquityAdjustment,
            ResidualClassification::PriorPeriodAdjustment,
            ResidualClassification::OtherEquity,
        ] {
            assert!(c.allows_posting(), "{c:?} must allow posting");
        }
        assert!(!ResidualClassification::UnresolvedDifference.allows_posting());
    }

    #[test]
    fn prior_period_requires_confirmation_only() {
        assert!(ResidualClassification::PriorPeriodAdjustment.requires_confirmation());
        for c in [
            ResidualClassification::RetainedEarnings,
            ResidualClassification::OpeningEquityAdjustment,
            ResidualClassification::OtherEquity,
            ResidualClassification::UnresolvedDifference,
        ] {
            assert!(
                !c.requires_confirmation(),
                "{c:?} must not require confirmation"
            );
        }
    }

    #[test]
    fn classification_never_targets_operating_or_registered_capital_purpose() {
        use crate::accounting::account::AccountPurpose;
        for c in [
            ResidualClassification::RetainedEarnings,
            ResidualClassification::OpeningEquityAdjustment,
            ResidualClassification::PriorPeriodAdjustment,
            ResidualClassification::OtherEquity,
        ] {
            let purpose = c
                .account_purpose()
                .expect("real classification has a purpose");
            // The mapped purpose is always equity-family and passive.
            assert!(purpose.is_equity(), "{c:?} → {purpose:?} must be equity");
            for forbidden in [
                AccountPurpose::General,
                AccountPurpose::PartnerCapital,
                AccountPurpose::PartnerDrawings,
                AccountPurpose::Receivable,
                AccountPurpose::Payable,
                AccountPurpose::Inventory,
                AccountPurpose::FixedAsset,
                AccountPurpose::Bank,
                AccountPurpose::Loan,
                AccountPurpose::OpeningBalanceEquity,
            ] {
                assert_ne!(purpose, forbidden, "{c:?} must never map to {forbidden:?}");
            }
        }
    }
}
