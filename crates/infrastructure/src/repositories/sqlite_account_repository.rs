use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use domain::accounting::account::{Account, AccountType, AccountCategory};
use domain::shared::AccountId;
use std::sync::Arc;
use uuid::Uuid;
use crate::db::mapper::{map_uuid, map_decimal};

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
        let category_str = match account.category {
            AccountCategory::Summary => "Summary",
            AccountCategory::Detail => "Detail",
        };

        sqlx::query(
            "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, notes, is_active, is_default, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                code = excluded.code,
                name_ar = excluded.name_ar,
                name_en = excluded.name_en,
                account_type = excluded.account_type,
                parent_id = excluded.parent_id,
                category = excluded.category,
                level = excluded.level,
                opening_balance = excluded.opening_balance,
                balance = excluded.balance,
                notes = excluded.notes,
                is_active = excluded.is_active,
                is_default = excluded.is_default,
                updated_at = excluded.updated_at"
        )
        .bind(account.id.0.to_string())
        .bind(&account.code)
        .bind(&account.name_ar)
        .bind(&account.name_en)
        .bind(format!("{:?}", account.account_type))
        .bind(account.parent_id.as_ref().map(|id| id.0.to_string()))
        .bind(category_str)
        .bind(account.level)
        .bind(account.opening_balance.to_string())
        .bind(account.balance.to_string())
        .bind(&account.notes)
        .bind(account.is_active)
        .bind(account.is_default)
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

        if let Some(row) = row {
            Ok(Some(map_row_to_account(row)?))
        } else {
            Ok(None)
        }
    }

    async fn find_by_code(&self, code: &str) -> Result<Option<Account>, AppError> {
        let row = sqlx::query("SELECT * FROM accounts WHERE code = ?")
            .bind(code)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            Ok(Some(map_row_to_account(row)?))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<Account>, AppError> {
        let rows = sqlx::query("SELECT * FROM accounts ORDER BY code ASC")
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut accounts = Vec::new();
        for row in rows {
            accounts.push(map_row_to_account(row)?);
        }
        Ok(accounts)
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
    let type_str: String = row.get("account_type");
    
    let account_type = match type_str.as_str() {
        "Assets" => AccountType::Assets,
        "Liabilities" => AccountType::Liabilities,
        "Equity" => AccountType::Equity,
        "Revenue" => AccountType::Revenue,
        "Expenses" => AccountType::Expenses,
        _ => AccountType::Assets, // Fallback
    };

    let category_str: Option<String> = row.get("category");
    let category = match category_str.as_deref() {
        Some("Summary") => AccountCategory::Summary,
        _ => AccountCategory::Detail,
    };

    Ok(Account {
        id: AccountId(map_uuid(&row, "id")),
        code: row.get("code"),
        name_ar: row.get("name_ar"),
        name_en: row.get("name_en"),
        account_type,
        parent_id: row.get::<Option<String>, _>("parent_id").and_then(|s| Uuid::parse_str(&s).ok()).map(AccountId),
        category,
        level: row.get::<Option<i32>, _>("level").unwrap_or(1),
        opening_balance: map_decimal(&row, "opening_balance"),
        balance: map_decimal(&row, "balance"),
        notes: row.get("notes"),
        is_active: row.get("is_active"),
        is_default: row.get::<Option<bool>, _>("is_default").unwrap_or(false),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}
