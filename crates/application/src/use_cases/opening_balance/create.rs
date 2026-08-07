use std::sync::Arc;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::str::FromStr;
use domain::accounting::{OpeningBalanceMigration, OpeningBalanceLine};
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::{CreateOpeningBalanceMigrationCommand, OpeningMigrationDto};

pub struct CreateOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl CreateOpeningBalanceUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, cmd: CreateOpeningBalanceMigrationCommand) -> Result<OpeningMigrationDto, AppError> {
        let cutover = DateTime::parse_from_rfc3339(&cmd.cutover_date)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|_| AppError::Invalid("تاريخ الترحيل غير صالح".into()))?;

        let mut lines = Vec::with_capacity(cmd.lines.len());
        for l in cmd.lines {
            let amount = Decimal::from_str(&l.amount)
                .map_err(|_| AppError::Invalid("قيمة البند غير صالحة".into()))?;
            let account_id = AccountId::from_str(&l.account_id)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
            lines.push(OpeningBalanceLine {
                account_id,
                amount,
                description: l.description,
            });
        }

        let id = uuid::Uuid::new_v4().to_string();
        let migration = OpeningBalanceMigration::new(id, cutover, cmd.notes, lines)
            .map_err(AppError::Domain)?;
        self.repo.create(&migration).await?;

        Ok(OpeningMigrationDto(migration))
    }
}