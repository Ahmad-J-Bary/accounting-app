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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningBalanceMigration {
    pub id: String,
    pub company_id: Option<String>,
    pub cutover_date: DateTime<Utc>,
    pub source_system: Option<String>,
    pub source_reference: Option<String>,
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

    /// Optional metadata used to trace the migration back to its source
    /// (e.g. the prior accounting system and a local reference number).
    pub fn set_source(&mut self, company_id: Option<String>, source_system: Option<String>, source_reference: Option<String>) {
        self.company_id = company_id;
        self.source_system = source_system;
        self.source_reference = source_reference;
        self.updated_at = Utc::now();
    }

    pub fn validate(&mut self, by: &str) -> Result<(), DomainError> {
        self.require_status(&[MigrationStatus::Draft], "لا يمكن التحقق من ترحيل غير مسودة")?;
        self.status = MigrationStatus::Validated;
        self.validated_by = Some(by.to_string());
        self.validated_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn approve(&mut self, by: &str) -> Result<(), DomainError> {
        self.require_status(&[MigrationStatus::Validated], "يجب التحقق من الترحيل قبل اعتماده")?;
        self.status = MigrationStatus::Approved;
        self.approved_by = Some(by.to_string());
        self.approved_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn mark_posted(&mut self) -> Result<(), DomainError> {
        self.require_status(&[MigrationStatus::Approved], "يجب اعتماد الترحيل قبل ترحيله")?;
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
        self.require_status(&[MigrationStatus::Locked], "لا يمكن إلغاء القفل إلا لترحيل مقفول")?;
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
            &[MigrationStatus::Draft, MigrationStatus::Validated, MigrationStatus::Approved],
            "لا يمكن إلغاء الترحيل بعد ترحيله",
        )?;
        self.status = MigrationStatus::Cancelled;
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
        OpeningBalanceMigration::new(
            "mig-1".into(),
            Utc::now(),
            None,
            vec![line],
        )
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
}
