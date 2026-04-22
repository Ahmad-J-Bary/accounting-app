use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use domain::accounting::account::{Account, AccountType};
use domain::shared::AccountId;
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

pub struct SqliteAccountRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAccountRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AccountRepository for SqliteAccountRepository {
    async fn save(&self, account: &Account) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name_ar = excluded.name_ar,
                name_en = excluded.name_en,
                account_type = excluded.account_type,
                parent_id = excluded.parent_id,
                balance = excluded.balance,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at"
        )
        .bind(account.id.0.to_string())
        .bind(&account.code)
        .bind(&account.name_ar)
        .bind(&account.name_en)
        .bind(format!("{:?}", account.account_type))
        .bind(account.parent_id.as_ref().map(|id| id.0.to_string()))
        .bind(account.balance.to_string())
        .bind(account.is_active)
        .bind(account.created_at)
        .bind(account.updated_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &AccountId) -> Result<Option<Account>, AppError> {
        let row = sqlx::query("SELECT * FROM accounts WHERE id = ?")
            .bind(id.0.to_string())
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(map_row_to_account).transpose()
    }

    async fn find_by_code(&self, code: &str) -> Result<Option<Account>, AppError> {
        let row = sqlx::query("SELECT * FROM accounts WHERE code = ?")
            .bind(code)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(map_row_to_account).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Account>, AppError> {
        let rows = sqlx::query("SELECT * FROM accounts ORDER BY code ASC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(map_row_to_account).collect()
    }

    async fn delete(&self, id: &AccountId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM accounts WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

fn map_row_to_account(row: sqlx::sqlite::SqliteRow) -> Result<Account, AppError> {
    let id_str: String = row.get("id");
    let parent_id_str: Option<String> = row.get("parent_id");
    let type_str: String = row.get("account_type");
    let balance_str: String = row.get("balance");

    let account_type = match type_str.as_str() {
        "Assets" => AccountType::Assets,
        "Liabilities" => AccountType::Liabilities,
        "Equity" => AccountType::Equity,
        "Revenue" => AccountType::Revenue,
        "Expenses" => AccountType::Expenses,
        _ => AccountType::Assets, // Fallback
    };

    Ok(Account {
        id: AccountId(Uuid::parse_str(&id_str).map_err(|e: uuid::Error| AppError::Infrastructure(e.to_string()))?),
        code: row.get("code"),
        name_ar: row.get("name_ar"),
        name_en: row.get("name_en"),
        account_type,
        parent_id: parent_id_str.map(|s| Uuid::parse_str(&s).map(AccountId).unwrap_or(AccountId(Uuid::nil()))),
        balance: Decimal::from_str(&balance_str).unwrap_or(Decimal::ZERO),
        is_active: row.get("is_active"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}
